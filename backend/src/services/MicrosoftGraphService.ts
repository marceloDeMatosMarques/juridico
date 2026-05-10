import axios from 'axios'
import { prisma } from '../config/database'
import { microsoftConfig, MS_TOKEN_URL } from '../config/microsoft'

export class MicrosoftGraphService {
  constructor(private userId: string) {}

  async getValidToken(): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: this.userId },
      select: {
        microsoft_access_token: true,
        microsoft_refresh_token: true,
        microsoft_token_expires_at: true,
      },
    })

    if (!user?.microsoft_access_token) {
      throw new Error('Conta Microsoft não conectada')
    }

    const isExpired =
      !user.microsoft_token_expires_at ||
      user.microsoft_token_expires_at <= new Date(Date.now() + 60_000)

    if (!isExpired) return user.microsoft_access_token

    return this.refreshToken(user.microsoft_refresh_token)
  }

  async refreshToken(refreshToken: string | null): Promise<string> {
    if (!refreshToken) throw new Error('Refresh token Microsoft não disponível')

    const params = new URLSearchParams({
      client_id: microsoftConfig.clientId,
      client_secret: microsoftConfig.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: microsoftConfig.scopes.join(' '),
    })

    const { data } = await axios.post(MS_TOKEN_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    const expiresAt = new Date(Date.now() + data.expires_in * 1000)

    await prisma.user.update({
      where: { id: this.userId },
      data: {
        microsoft_access_token: data.access_token,
        microsoft_refresh_token: data.refresh_token ?? refreshToken,
        microsoft_token_expires_at: expiresAt,
      },
    })

    return data.access_token
  }

  async getProfile(): Promise<{ displayName: string; mail: string }> {
    const token = await this.getValidToken()
    const { data } = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return data
  }

  async getStorageQuota(): Promise<{ remaining: number; total: number }> {
    const token = await this.getValidToken()
    const { data } = await axios.get('https://graph.microsoft.com/v1.0/me/drive', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return {
      remaining: data.quota?.remaining ?? 0,
      total: data.quota?.total ?? 0,
    }
  }
}
