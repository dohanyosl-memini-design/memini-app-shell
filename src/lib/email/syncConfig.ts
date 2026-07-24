// A szinkron környezeti konfigurációja. A TITKOK (IMAP-jelszó / OAuth) a futtató
// környezet (cPanel) env-változóiban élnek, SOHA nem a repóban.

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
  const require = (key: string): string => {
    const value = env[key]
    if (!value) throw new Error(`Hiányzó környezeti változó: ${key}`)
    return value
  }
  const authMode = (env.IMAP_AUTH_MODE ?? 'password') === 'oauth2' ? 'oauth2' : 'password'
  return {
    host: require('IMAP_HOST'),
    port: Number(env.IMAP_PORT ?? 993),
    secure: (env.IMAP_SECURE ?? 'true') !== 'false',
    user: require('IMAP_USER'),
    password: env.IMAP_PASSWORD,
    authMode,
    oauth: {
      accessToken: env.IMAP_OAUTH2_ACCESS_TOKEN,
      tokenUrl: env.OAUTH2_TOKEN_URL,
      clientId: env.OAUTH2_CLIENT_ID,
      clientSecret: env.OAUTH2_CLIENT_SECRET,
      refreshToken: env.OAUTH2_REFRESH_TOKEN,
      scope: env.OAUTH2_SCOPE,
    },
    inboxFolder: env.IMAP_INBOX_FOLDER ?? 'INBOX',
    sentFolder: env.IMAP_SENT_FOLDER,
    extraFolders: csv(env.IMAP_EXTRA_FOLDERS),
    ownAddresses: csv(env.MEMINI_EMAIL_ADDRESSES),
    ownDomains: csv(env.MEMINI_EMAIL_DOMAINS),
    initialSyncLimit: Number(env.IMAP_INITIAL_SYNC_LIMIT ?? 500),
    maxAttachmentBytes: Number(env.IMAP_MAX_ATTACHMENT_BYTES ?? 26214400),
  }
}
