import axios from 'axios'

export class EvolutionAPIService {
  private baseUrl: string
  private headers: Record<string, string>

  constructor(
    private instanceName: string,
    apiUrl: string,
    apiKey: string,
  ) {
    this.baseUrl = apiUrl.replace(/\/$/, '')
    this.headers = { apikey: apiKey, 'Content-Type': 'application/json' }
  }

  async createInstance(): Promise<{ qrcode?: { base64?: string }; instance?: { state?: string } }> {
    const { data } = await axios.post(
      `${this.baseUrl}/instance/create`,
      { instanceName: this.instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' },
      { headers: this.headers },
    )
    return data
  }

  async getQRCode(): Promise<string | null> {
    try {
      const { data } = await axios.get(
        `${this.baseUrl}/instance/connect/${this.instanceName}`,
        { headers: this.headers },
      )
      return (data as { base64?: string }).base64 ?? null
    } catch { return null }
  }

  async getConnectionState(): Promise<'open' | 'connecting' | 'close'> {
    try {
      const { data } = await axios.get(
        `${this.baseUrl}/instance/connectionState/${this.instanceName}`,
        { headers: this.headers },
      )
      const state = (data as { instance?: { state?: string } }).instance?.state ?? 'close'
      if (state === 'open') return 'open'
      if (state === 'connecting') return 'connecting'
      return 'close'
    } catch { return 'close' }
  }

  async sendText(phone: string, text: string): Promise<void> {
    const number = phone.replace(/\D/g, '')
    await axios.post(
      `${this.baseUrl}/message/sendText/${this.instanceName}`,
      { number, options: { delay: 1200 }, textMessage: { text } },
      { headers: this.headers },
    )
  }

  async logout(): Promise<void> {
    await axios.delete(
      `${this.baseUrl}/instance/logout/${this.instanceName}`,
      { headers: this.headers },
    )
  }

  async deleteInstance(): Promise<void> {
    await axios.delete(
      `${this.baseUrl}/instance/delete/${this.instanceName}`,
      { headers: this.headers },
    ).catch(() => null)
  }

  async setWebhook(webhookUrl: string): Promise<void> {
    await axios.post(
      `${this.baseUrl}/webhook/set/${this.instanceName}`,
      {
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          webhookBase64: false,
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        },
      },
      { headers: this.headers },
    )
  }
}
