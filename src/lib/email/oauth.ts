// OAuth2 access-token szolgáltató IMAP-hoz (Gmail/Microsoft) — a
// memini-mail-bridge OAuth2TokenProvider portja, a SyncConfig-ra hangolva.

import type { SyncConfig } from './syncConfig'

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

export class OAuth2TokenProvider {
  private cached?: { value: string; expiresAt: number }

  constructor(private readonly oauth: SyncConfig['oauth']) {}

  async getAccessToken(): Promise<string> {
    if (this.oauth.accessToken) return this.oauth.accessToken
    if (this.cached && this.cached.expiresAt > Date.now() + 60_000) return this.cached.value
    if (!this.oauth.tokenUrl || !this.oauth.clientId || !this.oauth.refreshToken) {
      throw new Error('OAuth2 hiányos: tokenUrl, clientId és refreshToken kötelező.')
    }
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.oauth.clientId,
      refresh_token: this.oauth.refreshToken,
    })
    if (this.oauth.clientSecret) body.set('client_secret', this.oauth.clientSecret)
    if (this.oauth.scope) body.set('scope', this.oauth.scope)
    const response = await fetch(this.oauth.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(15_000),
    })
    const payload = (await response.json()) as TokenResponse
    if (!response.ok || !payload.access_token) {
      throw new Error(
        `OAuth2 token-frissítés sikertelen: ${payload.error_description ?? payload.error ?? response.status}`,
      )
    }
    this.cached = {
      value: payload.access_token,
      expiresAt: Date.now() + Math.max(60, payload.expires_in ?? 3600) * 1000,
    }
    return this.cached.value
  }
}
