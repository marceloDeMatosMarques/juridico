import { google } from 'googleapis'
import { prisma } from '../config/database'
import { createOAuth2Client } from '../config/google'

export class GoogleAPIService {
  constructor(private userId: string) {}

  async getClient() {
    const user = await prisma.user.findUnique({
      where: { id: this.userId },
      select: {
        google_access_token: true,
        google_refresh_token: true,
        google_token_expires_at: true,
      },
    })

    if (!user?.google_access_token) {
      throw new Error('Conta Google não conectada')
    }

    const oauth2Client = createOAuth2Client()
    oauth2Client.setCredentials({
      access_token: user.google_access_token,
      refresh_token: user.google_refresh_token ?? undefined,
      expiry_date: user.google_token_expires_at?.getTime(),
    })

    // Renova automaticamente se necessário
    oauth2Client.on('tokens', async (tokens) => {
      await prisma.user.update({
        where: { id: this.userId },
        data: {
          google_access_token: tokens.access_token ?? user.google_access_token,
          google_refresh_token: tokens.refresh_token ?? user.google_refresh_token,
          google_token_expires_at: tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : user.google_token_expires_at,
        },
      })
    })

    return oauth2Client
  }

  async getProfile(): Promise<{ name: string; email: string }> {
    const auth = await this.getClient()
    const oauth2 = google.oauth2({ version: 'v2', auth })
    const { data } = await oauth2.userinfo.get()
    return { name: data.name ?? '', email: data.email ?? '' }
  }

  async getStorageQuota(): Promise<{ remaining: number; total: number }> {
    const auth = await this.getClient()
    const drive = google.drive({ version: 'v3', auth })
    const { data } = await drive.about.get({ fields: 'storageQuota' })
    const quota = data.storageQuota
    const total = Number(quota?.limit ?? 0)
    const used = Number(quota?.usage ?? 0)
    return { remaining: total - used, total }
  }
}
