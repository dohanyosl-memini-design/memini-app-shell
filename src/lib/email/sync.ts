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
  async syncOnce(overrideLimit?: number): Promise<number> {
    await this.ensureAccount()
    const folders = await this.withClient((c) => this.discoverFolders(c))
    let total = 0
    for (const folder of folders) total += await this.syncFolder(folder, overrideLimit)
    return total
  }

  private async syncFolder(folder: string, overrideLimit?: number): Promise<number> {
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
        const stateValid = state ? state.uidValidity === uidValidity : false
        const limit = overrideLimit ?? this.config.initialSyncLimit
        const initialStart = Math.max(1, uidNext - limit)
        const startUid = stateValid ? Number(state!.lastSeenUid) + 1 : initialStart

        if (startUid >= uidNext) {
          await this.saveState(accountId, folder, uidValidity, stateValid ? Number(state!.lastSeenUid) : 0)
          return 0
        }

        let processed = 0
        let maxProcessedUid = stateValid ? Number(state!.lastSeenUid) : startUid - 1
        let firstFailedUid: number | null = null

        for await (const message of client.fetch(`${startUid}:*`, { uid: true, source: true }, { uid: true })) {
          if (!message.source || !message.uid) continue
          const uid = message.uid
          let ok = false
          for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
            try {
              await this.persistMessage(accountId, folder, uidValidity, uid, message.source)
              ok = true
            } catch (e) {
              if (attempt < 3) await new Promise((r) => setTimeout(r, 250 * 2 ** (attempt - 1)))
              else this.log('Üzenet feldolgozása sikertelen', { folder, uid, err: errMsg(e) })
            }
          }
          if (ok) { maxProcessedUid = Math.max(maxProcessedUid, uid); processed++ }
          else if (firstFailedUid === null) firstFailedUid = uid
        }

        // A kurzort nem visszük az első hibás UID elé — a dedup miatt a
        // következő futás biztonságosan újrapróbálja onnan.
        const advanceTo = firstFailedUid !== null ? firstFailedUid - 1 : maxProcessedUid
        await this.saveState(accountId, folder, uidValidity, advanceTo)
        this.log('Mappa szinkronizálva', { folder, processed })
        return processed
      } finally {
        lock.release()
      }
    })
  }

  private async saveState(accountId: string, folder: string, uidValidity: bigint, lastSeenUid: number) {
    await this.prisma.emailFolderState.upsert({
      where: { accountId_folderName: { accountId, folderName: folder } },
      update: { uidValidity, lastSeenUid: BigInt(Math.max(0, lastSeenUid)), lastSyncedAt: new Date() },
      create: {
        accountId, folderName: folder, uidValidity,
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

    const email = await this.prisma.email.create({
      data: {
        accountId, threadId,
        messageId: parsed.messageId, inReplyTo: parsed.inReplyTo, references: parsed.references,
        fallbackHash, subject: parsed.subject, normalizedSubject: parsed.normalizedSubject,
        textBody: parsed.textBody, htmlBody: parsed.htmlBody, snippet: parsed.snippet,
        direction, folderName: folder, imapUid: BigInt(uid), uidValidity,
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
    const [agg, last, current] = await Promise.all([
      this.prisma.email.aggregate({
        where: { threadId }, _count: true, _min: { sentAt: true }, _max: { sentAt: true },
      }),
      this.prisma.email.findFirst({
        where: { threadId }, orderBy: { sentAt: 'desc' }, select: { direction: true },
      }),
      this.prisma.emailThread.findUnique({
        where: { id: threadId }, select: { replyStatus: true },
      }),
    ])
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
      },
    })
  }
}
