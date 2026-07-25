// A szinkron környezeti konfigurációja. A TITKOK (IMAP-jelszó / OAuth) a futtató
// környezet (Vercel / cPanel) env-változóiban élnek, SOHA nem a repóban.
//
// Minden értéket levágunk (trim): másoláskor gyakran becsúszik egy tab vagy
// szóköz (pl. tabbal elválasztott táblázatból), és egy elgépelt hoszt/user
// némán elrontja a kapcsolatot.

export interface SyncConfig {
  host: string
  port: number
  secure: boolean
  user: string
  password?: string
  authMode: 'password' | 'oauth2'
  oauth: {
    accessToken?: string
    tokenUrl?: string
    clientId?: string
    clientSecret?: string
    refreshToken?: string
    scope?: string
  }
  inboxFolder: string
  sentFolder?: string
  extraFolders: string[]
  ownAddresses: string[]
  ownDomains: string[]
  initialSyncLimit: number
  maxAttachmentBytes: number
}

export const csv = (value: string | undefined): string[] =>
  (value ?? '').split(',').map((v) => v.trim()).filter(Boolean)

export function loadSyncConfig(env: NodeJS.ProcessEnv = process.env): SyncConfig {
  // Minden string-értéket trim-elünk (a véletlen tab/szóköz ellen).
  const get = (key: string): string | undefined => {
    const value = env[key]
    const trimmed = typeof value === 'string' ? value.trim() : undefined
    return trimmed ? trimmed : undefined
  }
  const required = (key: string): string => {
    const value = get(key)
    if (!value) throw new Error(`Hiányzó környezeti változó: ${key}`)
    return value
  }
  const authMode = (get('IMAP_AUTH_MODE') ?? 'password') === 'oauth2' ? 'oauth2' : 'password'
  return {
    host: required('IMAP_HOST'),
    port: Number(get('IMAP_PORT') ?? 993),
    secure: (get('IMAP_SECURE') ?? 'true') !== 'false',
    user: required('IMAP_USER'),
    password: get('IMAP_PASSWORD'),
    authMode,
    oauth: {
      accessToken: get('IMAP_OAUTH2_ACCESS_TOKEN'),
      tokenUrl: get('OAUTH2_TOKEN_URL'),
      clientId: get('OAUTH2_CLIENT_ID'),
      clientSecret: get('OAUTH2_CLIENT_SECRET'),
      refreshToken: get('OAUTH2_REFRESH_TOKEN'),
      scope: get('OAUTH2_SCOPE'),
    },
    inboxFolder: get('IMAP_INBOX_FOLDER') ?? 'INBOX',
    sentFolder: get('IMAP_SENT_FOLDER'),
    extraFolders: csv(env.IMAP_EXTRA_FOLDERS),
    ownAddresses: csv(env.MEMINI_EMAIL_ADDRESSES),
    ownDomains: csv(env.MEMINI_EMAIL_DOMAINS),
    initialSyncLimit: Number(get('IMAP_INITIAL_SYNC_LIMIT') ?? 500),
    maxAttachmentBytes: Number(get('IMAP_MAX_ATTACHMENT_BYTES') ?? 26214400),
  }
}
