// IMAP → CRM levél-szinkron. A memini-mail-bridge EmailSyncService
// orchestrációjának (imapflow fetch-hurok, UID-kurzor, dedup, szál-párosítás)
// portja — a KÜLÖNBSÉG: a tárolás Supabase-kliens helyett Prisma, a CRM
// sémájára és a VALÓDI Company/Contact partnerekre.
//
// Szándékos egyszerűsítések a bridge-hez képest (Etap 1):
//  - a csatolmányoknál egyelőre csak a metaadatot tároljuk (blobUrl null);
//    a bináris tárolás (Vercel Blob) külön szelet lesz.
//  - külön hibasor-tábla helyett: 3 próbálkozás/üzenet, és a kurzort nem
//    léptetjük az első hibás UID elé — a következő futás onnan újrapróbál
//    (a dedup miatt a már feldolgozottak olcsón kimaradnak).

import { ImapFlow } from 'imapflow'
import type { PrismaClient } from '@prisma/client'
import { parseEmail } from './parse'
import { OAuth2TokenProvider } from './oauth'
import {
  chooseThread, determineDirection, fallbackEmailHash, matchCrm,
  type CompanyRecord, type ContactRecord, type ThreadCandidate,
} from './matching'
import { normalizeEmail } from './normalize'
import { classifyEmail, threadCategory } from './classify'
import type { SyncConfig } from './syncConfig'
import type { ParsedEmail } from './types'

type Log = (msg: string, extra?: Record<string, unknown>) => void
const noop: Log = () => {}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

// Cégdomain kinyerése a CRM Company-ból (nincs dedikált domain-mező): előbb az
// e-mail címből, majd a website hostjából.
function companyDomain(email: string | null, website: string | null): string | null {
  if (email && email.includes('@')) return email.split('@')[1].toLowerCase()
  if (website) {
    try {
      const host = new URL(website.startsWith('http') ? website : `https://${website}`).hostname
      return host.replace(/^www\./, '').toLowerCase()
    } catch { /* ignore */ }
  }
  return null
}

export class EmailSyncService {
  private readonly oauth: OAuth2TokenProvider
  private contacts: ContactRecord[] | null = null
  private companies: CompanyRecord[] | null = null
  private accountId: string | null = null

  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: SyncConfig,
    private readonly log: Log = noop,
  ) {
    this.oauth = new OAuth2TokenProvider(config.oauth)
  }

  private async createClient(): Promise<ImapFlow> {
    const auth =
      this.config.authMode === 'oauth2'
        ? { user: this.config.user, accessToken: await this.oauth.getAccessToken() }
        : { user: this.config.user, pass: this.config.password! }
    const client = new ImapFlow({
      host: this.config.host, port: this.config.port, secure: this.config.secure,
      auth, disableAutoIdle: true, logger: false, emitLogs: false,
      // Gyors, olvasható hiba egy rossz/lassú kapcsolatnál (ne akassza a 60 mp-et).
      greetingTimeout: 9000, socketTimeout: 25000, connectionTimeout: 9000,
      clientInfo: { name: 'Memini CRM', version: '1.0.0' },
    })
    client.on('error', (e) => this.log('IMAP hiba', { err: e.message }))
    return client
  }

  private async withClient<T>(task: (c: ImapFlow) => Promise<T>): Promise<T> {
    const client = await this.createClient()
    try {
      await client.connect()
      return await task(client)
    } finally {
      if (client.usable) await client.logout().catch(() => undefined)
    }
  }

  private async ensureAccount(): Promise<string> {
    if (this.accountId) return this.accountId
    const account = await this.prisma.emailAccount.upsert({
      where: { address: this.config.user.toLowerCase() },
      update: {},
      create: { address: this.config.user.toLowerCase(), label: 'Memini Postafiók' },
    })
    this.accountId = account.id
    return account.id
  }

  // A CRM matching-halmazok egyszeri betöltése futásonként.
  private async loadCrm(): Promise<{ contacts: ContactRecord[]; companies: CompanyRecord[] }> {
    if (!this.contacts || !this.companies) {
      const [contacts, companies] = await Promise.all([
        this.prisma.contact.findMany({
          where: { email: { not: null } },
          select: { id: true, email: true, companyId: true },
        }),
        this.prisma.company.findMany({ select: { id: true, email: true, website: true } }),
      ])
      this.contacts = contacts
        .filter((c) => c.email)
        .map((c) => ({ id: c.id, companyId: c.companyId, emailAddresses: [c.email!] }))
      this.companies = companies.map((c) => ({ id: c.id, domain: companyDomain(c.email, c.website) }))
    }
    return { contacts: this.contacts, companies: this.companies }
  }

  // Diagnosztika: az ÖSSZES postafiók-mappa listája, darabszámmal és a
  // legfrissebb levél dátumával — hogy kiderüljön, hová érkezik a friss mail
  // (pl. egy szerveroldali szabály almappába szűri, nem az INBOX-ba).
  async listFolders(): Promise<Array<Record<string, unknown>>> {
    return this.withClient(async (client) => {
      const list = await client.list()
      const out: Array<Record<string, unknown>> = []
      for (const item of list.slice(0, 60)) {
        try {
          const lock = await client.getMailboxLock(item.path)
          try {
            const mb = client.mailbox
            const messages = mb ? mb.exists : 0
            let newest: string | null = null
            if (messages > 0) {
              const msg = await client.fetchOne('*', { envelope: true })
              const d = msg && typeof msg !== 'boolean' ? msg.envelope?.date : undefined
              newest = d ? new Date(d).toISOString() : null
            }
            out.push({ path: item.path, specialUse: item.specialUse ?? null, messages, newest })
          } finally {
            lock.release()
          }
        } catch (e) {
          out.push({ path: item.path, error: errMsg(e) })
        }
      }
      return out
    })
  }

  private async discoverFolders(client: ImapFlow): Promise<string[]> {
    const listed = await client.list()
    const inbox =
      listed.find((i) => i.specialUse === '\\Inbox')?.path ?? this.config.inboxFolder
    const sent =
      listed.find((i) => i.specialUse === '\\Sent')?.path ??
      this.config.sentFolder ??
      ['Sent', 'Sent Items', 'Gesendet'].find((n) => listed.some((i) => i.path === n))
    return Array.from(
      new Set([inbox, sent, ...this.config.extraFolders].filter(Boolean) as string[]),
    )
  }

  // Egy teljes szinkron-ciklus: minden érintett mappa növekményesen.
  //  - backfillLimit: a kezdeti behúzás ablaka (levél/mappa)
  //  - maxMessages: hívásonkénti FELSŐ korlát (a Vercel 60 mp-es limitje miatt);
  //    ha elérjük, a kurzort az utolsó feldolgozottnál mentjük, és a következő
  //    hívás onnan folytatja.
  async syncOnce(
    opts: {
      backfillLimit?: number
      maxMessages?: number
      maxSeconds?: number
      restart?: boolean
    } = {},
  ): Promise<number> {
    await this.ensureAccount()
    const folders = await this.withClient((c) => this.discoverFolders(c))
    // "Kezdd elölről": a kurzort a mappa elejére állítjuk, hogy a RÉGI levelek
    // is bejöjjenek (a kurzor magától sosem megy visszafelé). A dedup miatt
    // biztonságos: a már beolvasott levelek kimaradnak, duplikátum nem lesz.
    if (opts.restart) {
      // Teljes újraolvasás: a folder-állapotokat töröljük, így a következő
      // forward-fázis a legutóbbi levelektől indul, a backfill pedig onnan
      // lefelé végigmegy a teljes historyn. A dedup miatt duplikátum nincs.
      const accountId = await this.ensureAccount()
      await this.prisma.emailFolderState.deleteMany({ where: { accountId } })
      this.log('Szinkron-állapot törölve — legújabbtól indul, history visszafelé')
    }
    const budget = { remaining: opts.maxMessages ?? Number.POSITIVE_INFINITY }
    // Óra-alapú határidő: a szinkron ELŐBB áll meg magától, mint hogy a Vercel
    // levágja (504). A kurzort menti, a következő hívás onnan folytatja.
    const deadline = Date.now() + (opts.maxSeconds ?? 50) * 1000
    let total = 0

    // 1. FÁZIS — ÚJ levelek minden mappában (ez a fontos: a mai posta azonnal
    //    bejöjjön). Kevés levél, gyors; így az Elküldött sem éhezik ki.
    for (const folder of folders) {
      if (budget.remaining <= 0 || Date.now() >= deadline) break
      total += await this.syncForward(folder, budget, deadline)
    }

    // 2. FÁZIS — a maradék idővel a RÉGI history töltése visszafelé (a
    //    legújabbtól a legrégebbi felé haladva).
    for (const folder of folders) {
      if (budget.remaining <= 0 || Date.now() >= deadline) break
      total += await this.syncBackfill(folder, budget, deadline)
    }
    return total
  }

  // Egy UID-tartomány feldolgozása. A hibás leveleket naplózza és ÁTUGORJA
  // (egy "mérgezett" levél nem akaszthatja meg a szinkront).
  private async processRange(
    client: ImapFlow, accountId: string, folder: string, uidValidity: bigint,
    range: string, budget: { remaining: number }, deadline: number,
    onUid?: (uid: number) => void,
  ): Promise<{ processed: number; failed: number }> {
    let processed = 0
    let failed = 0
    for await (const message of client.fetch(range, { uid: true, source: true }, { uid: true })) {
      if (!message.source || !message.uid) continue
      const uid = message.uid
      let ok = false
      let lastErr: unknown
      for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
        try {
          await this.persistMessage(accountId, folder, uidValidity, uid, message.source)
          ok = true
        } catch (e) {
          lastErr = e
          if (attempt < 2) await new Promise((r) => setTimeout(r, 250))
        }
      }
      if (ok) processed++
      else {
        failed++
        this.log('Levél kihagyva (hiba)', { folder, uid, err: errMsg(lastErr).slice(0, 200) })
      }
      onUid?.(uid)
      if (--budget.remaining <= 0 || Date.now() >= deadline) break
    }
    return { processed, failed }
  }

  // 1. FÁZIS — ÚJ levelek: a vízszint (lastSeenUid) fölötti UID-ek.
  // Első futásnál a vízszintet a mappa VÉGÉRE állítjuk, és csak a legutóbbi
  // néhány levelet hozzuk — a régi history a 2. fázis dolga.
  private async syncForward(
    folder: string, budget: { remaining: number }, deadline: number,
  ): Promise<number> {
    const accountId = await this.ensureAccount()
    return this.withClient(async (client) => {
      const lock = await client.getMailboxLock(folder)
      try {
        const mailbox = client.mailbox
        if (!mailbox) throw new Error(`A mappa nem nyitható: ${folder}`)
        const uidValidity = mailbox.uidValidity
        const uidNext = Number(mailbox.uidNext)

        const state = await this.prisma.emailFolderState.findUnique({
          where: { accountId_folderName: { accountId, folderName: folder } },
        })
        const stateValid = !!state && state.uidValidity === uidValidity

        // Első futás (vagy UIDVALIDITY-váltás): a legutóbbi 40 levéltől
        // indulunk, a backfill-kurzort pedig ez alá tesszük.
        const firstBatch = 40
        const startUid = stateValid
          ? Number(state!.lastSeenUid) + 1
          : Math.max(1, uidNext - firstBatch)

        if (startUid >= uidNext) {
          if (!stateValid) {
            await this.saveState(accountId, folder, uidValidity, uidNext - 1, startUid - 1)
          }
          return 0
        }

        let cursorUid = startUid - 1
        const { processed, failed } = await this.processRange(
          client, accountId, folder, uidValidity, `${startUid}:*`, budget, deadline,
          (uid) => { cursorUid = Math.max(cursorUid, uid) },
        )
        // Első futásnál a backfill innen indul lefelé; később marad, ami volt.
        const backfillFrom = stateValid ? undefined : startUid - 1
        await this.saveState(accountId, folder, uidValidity, cursorUid, backfillFrom)
        if (processed || failed) this.log('Új levelek', { folder, processed, kihagyva: failed })
        return processed
      } finally {
        lock.release()
      }
    })
  }

  // 2. FÁZIS — RÉGI history LEFELÉ: a backfill-kurzortól visszafelé haladva,
  // adagonként. Így a friss posta sosem várakozik az archívum mögött.
  private async syncBackfill(
    folder: string, budget: { remaining: number }, deadline: number,
  ): Promise<number> {
    const accountId = await this.ensureAccount()
    const state = await this.prisma.emailFolderState.findUnique({
      where: { accountId_folderName: { accountId, folderName: folder } },
    })
    // null = még nem indult (a forward beállítja), 0 = kész, nincs több régi.
    if (!state || state.backfillUid === null || Number(state.backfillUid) <= 0) return 0

    return this.withClient(async (client) => {
      const lock = await client.getMailboxLock(folder)
      try {
        const mailbox = client.mailbox
        if (!mailbox || mailbox.uidValidity !== state.uidValidity) return 0

        const top = Number(state.backfillUid)
        const chunk = Math.max(1, Math.min(budget.remaining, 100))
        const bottom = Math.max(1, top - chunk + 1)

        const { processed, failed } = await this.processRange(
          client, accountId, folder, state.uidValidity, `${bottom}:${top}`, budget, deadline,
        )
        // A feldolgozott ablak alá lépünk; 0 = a history teljesen bejött.
        const nextBackfill = bottom <= 1 ? 0 : bottom - 1
        await this.prisma.emailFolderState.update({
          where: { accountId_folderName: { accountId, folderName: folder } },
          data: { backfillUid: BigInt(nextBackfill), lastSyncedAt: new Date() },
        })
        if (processed || failed) {
          this.log('Régi levelek (visszafelé)', { folder, processed, kihagyva: failed, következő: nextBackfill })
        }
        return processed
      } finally {
        lock.release()
      }
    })
  }

  private async saveState(
    accountId: string, folder: string, uidValidity: bigint, lastSeenUid: number,
    backfillUid?: number,
  ) {
    const backfill = backfillUid === undefined
      ? {}
      : { backfillUid: BigInt(Math.max(0, backfillUid)) }
    await this.prisma.emailFolderState.upsert({
      where: { accountId_folderName: { accountId, folderName: folder } },
      update: { uidValidity, lastSeenUid: BigInt(Math.max(0, lastSeenUid)), lastSyncedAt: new Date(), ...backfill },
      create: {
        accountId, folderName: folder, uidValidity, ...backfill,
        lastSeenUid: BigInt(Math.max(0, lastSeenUid)), lastSyncedAt: new Date(),
      },
    })
  }

  private async persistMessage(
    accountId: string, folder: string, uidValidity: bigint, uid: number, raw: Buffer,
  ): Promise<void> {
    // Dedup 1: ugyanaz az UID ebben a mappában.
    const byUid = await this.prisma.email.findUnique({
      where: {
        accountId_folderName_uidValidity_imapUid: {
          accountId, folderName: folder, uidValidity, imapUid: BigInt(uid),
        },
      },
      select: { id: true },
    })
    if (byUid) return

    const parsed = await parseEmail(raw)

    // Dedup 2: Message-ID a fiókon belül.
    if (parsed.messageId) {
      const byMsg = await this.prisma.email.findFirst({
        where: { accountId, messageId: parsed.messageId }, select: { id: true },
      })
      if (byMsg) return
    }
    // Dedup 3: fallback-hash (ha nincs Message-ID).
    const fallbackHash = fallbackEmailHash(parsed)
    const byHash = await this.prisma.email.findFirst({
      where: { accountId, fallbackHash }, select: { id: true },
    })
    if (byHash) return

    const direction = determineDirection(
      parsed,
      [this.config.user, ...this.config.ownAddresses],
      this.config.ownDomains,
    )
    const threadId = await this.resolveThread(parsed)

    // Osztályozás: valódi beszélgetés / automatikus / spam (a "Válaszra vár"
    // csak beszélgetést mutasson). Kimenő = mindig beszélgetés.
    const category = direction === 'outbound'
      ? 'conversation'
      : classifyEmail(parsed.headers, parsed.from?.address ?? null)

    const email = await this.prisma.email.create({
      data: {
        accountId, threadId,
        messageId: parsed.messageId, inReplyTo: parsed.inReplyTo, references: parsed.references,
        fallbackHash, subject: parsed.subject, normalizedSubject: parsed.normalizedSubject,
        textBody: parsed.textBody, htmlBody: parsed.htmlBody, snippet: parsed.snippet,
        direction, category, folderName: folder, imapUid: BigInt(uid), uidValidity,
        sentAt: parsed.sentAt, receivedAt: parsed.receivedAt,
        rawHeaders: parsed.headers as object,
      },
      select: { id: true },
    })

    await this.persistParticipants(email.id, threadId, parsed, direction)
    await this.persistAttachments(email.id, parsed)
    await this.refreshThread(threadId)
  }

  // Melyik szálhoz? Message-ID/References, majd tárgy+résztvevő+idő heurisztika.
  private async resolveThread(parsed: ParsedEmail): Promise<string> {
    const refIds = [parsed.inReplyTo, ...parsed.references].filter(Boolean) as string[]
    const priorEmails = await this.prisma.email.findMany({
      where: refIds.length
        ? { messageId: { in: refIds } }
        : { normalizedSubject: parsed.normalizedSubject },
      orderBy: { sentAt: 'desc' },
      take: 200,
      select: {
        threadId: true, messageId: true,
        thread: { select: { normalizedSubject: true, lastMessageAt: true } },
        participants: { select: { emailAddress: true } },
      },
    })
    const grouped = new Map<string, ThreadCandidate>()
    for (const row of priorEmails) {
      const cur = grouped.get(row.threadId) ?? {
        id: row.threadId,
        normalizedSubject: row.thread.normalizedSubject,
        participantEmails: [],
        lastMessageAt: row.thread.lastMessageAt,
        messageIds: [],
      }
      if (row.messageId) cur.messageIds.push(row.messageId)
      cur.participantEmails.push(...row.participants.map((p) => p.emailAddress))
      grouped.set(row.threadId, cur)
    }
    const selected = chooseThread(parsed, Array.from(grouped.values()))
    if (selected) return selected

    const thread = await this.prisma.emailThread.create({
      data: {
        subject: parsed.subject, normalizedSubject: parsed.normalizedSubject,
        firstMessageAt: parsed.sentAt, lastMessageAt: parsed.sentAt, messageCount: 0,
      },
      select: { id: true },
    })
    return thread.id
  }

  private async persistParticipants(
    emailId: string, threadId: string, parsed: ParsedEmail, direction: string,
  ): Promise<void> {
    const { contacts, companies } = await this.loadCrm()
    const matches = new Map<string, ReturnType<typeof matchCrm>>()
    const rows = (['from', 'to', 'cc', 'bcc'] as const).flatMap((type) => {
      const items = type === 'from' ? (parsed.from ? [parsed.from] : []) : parsed[type]
      return items.map((item) => {
        const match = matchCrm(item.address, contacts, companies)
        matches.set(item.address, match)
        return {
          emailId, type, emailAddress: item.address, displayName: item.name ?? null,
          contactId: match.contactId, companyId: match.companyId,
        }
      })
    })
    if (rows.length) await this.prisma.emailParticipant.createMany({ data: rows })

    // A szál partnerének beállítása a KÜLSŐ résztvevő egyezéséből.
    const own = new Set([this.config.user, ...this.config.ownAddresses].map((v) => v.toLowerCase()))
    const ownDom = new Set(this.config.ownDomains.map((v) => v.toLowerCase()))
    const preferred = direction === 'inbound' ? (parsed.from ? [parsed.from] : []) : parsed.to
    const external = preferred.find((i) => {
      const dom = i.address.split('@')[1] ?? ''
      return !own.has(normalizeEmail(i.address)) && !ownDom.has(dom)
    })
    if (!external) return
    const m = matches.get(external.address)
    if (m?.contactId || m?.companyId) {
      await this.prisma.emailThread.update({
        where: { id: threadId },
        data: { contactId: m.contactId ?? undefined, companyId: m.companyId ?? undefined },
      })
    }
  }

  // Csatolmányok — Etap 1: csak metaadat (a bináris tárolás külön szelet).
  private async persistAttachments(emailId: string, parsed: ParsedEmail): Promise<void> {
    const rows = parsed.attachments
      .filter((a) => a.sizeBytes <= this.config.maxAttachmentBytes)
      .map((a) => ({
        emailId, filename: a.filename, contentType: a.contentType,
        sizeBytes: BigInt(a.sizeBytes), contentId: a.contentId, isInline: a.isInline,
        blobUrl: null,
      }))
    if (rows.length) await this.prisma.emailAttachment.createMany({ data: rows })
  }

  // Szál-aggregátumok újraszámolása (nincs DB-trigger, ezért kódból).
  private async refreshThread(threadId: string): Promise<void> {
    const [agg, msgs, current] = await Promise.all([
      this.prisma.email.aggregate({
        where: { threadId }, _count: true, _min: { sentAt: true }, _max: { sentAt: true },
      }),
      this.prisma.email.findMany({
        where: { threadId }, orderBy: { sentAt: 'desc' },
        select: { direction: true, category: true },
      }),
      this.prisma.emailThread.findUnique({
        where: { id: threadId }, select: { replyStatus: true },
      }),
    ])
    const last = msgs[0]
    // Kézi státuszt (lezárva / nem kell válasz) nem írunk felül.
    const keep = current && ['closed', 'no_reply_needed'].includes(current.replyStatus)
    const replyStatus = keep
      ? current!.replyStatus
      : last?.direction === 'outbound' ? 'answered' : 'unanswered'
    await this.prisma.emailThread.update({
      where: { id: threadId },
      data: {
        messageCount: agg._count,
        firstMessageAt: agg._min.sentAt ?? undefined,
        lastMessageAt: agg._max.sentAt ?? undefined,
        replyStatus,
        category: threadCategory(msgs),
      },
    })
  }
}
