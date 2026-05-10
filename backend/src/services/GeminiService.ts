import { GoogleGenerativeAI } from '@google/generative-ai'

export type ParsedCourtEmail = {
  notification_type: 'despacho' | 'intimacao' | 'sentenca' | 'acordao' | 'audiencia_agendada' | 'juntada_peca' | 'determinacao' | 'outro'
  summary: string
  deadline_date: string | null
  is_urgent: boolean
  deadline_days_remaining: number | null
}

const DOCUMENT_TYPES = [
  'procuracao', 'identidade', 'cpf', 'cnh', 'comprovante_residencia',
  'nota_fiscal', 'contrato', 'foto_evidencia', 'extra',
]

export class GeminiService {
  private genAI: GoogleGenerativeAI

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
  }

  private enabled() { return Boolean(process.env.GEMINI_API_KEY) }

  private async ask(prompt: string): Promise<string | null> {
    if (!this.enabled()) return null
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
      const result = await model.generateContent(prompt)
      return result.response.text().trim()
    } catch { return null }
  }

  private parseJson<T>(text: string): T | null {
    try {
      const json = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      return JSON.parse(json) as T
    } catch { return null }
  }

  async parseCourtEmail(subject: string, body: string): Promise<ParsedCourtEmail | null> {
    const today = new Date().toISOString().slice(0, 10)
    const text = await this.ask(
      `Você é um assistente jurídico. Analise este email de tribunal brasileiro e extraia as informações.\n` +
      `Responda APENAS com JSON válido (sem markdown), com este formato exato:\n` +
      `{"notification_type":"despacho|intimacao|sentenca|acordao|audiencia_agendada|juntada_peca|determinacao|outro","summary":"resumo em 1-2 frases","deadline_date":"YYYY-MM-DD ou null","is_urgent":true,"deadline_days_remaining":0}\n\n` +
      `Data de hoje: ${today}\nAssunto: ${subject}\nCorpo:\n${body.slice(0, 3000)}`
    )
    return text ? this.parseJson<ParsedCourtEmail>(text) : null
  }

  // Returns one of the DocumentType enum values (or null if uncertain)
  async classifyDocument(fileName: string, mimeType: string): Promise<string | null> {
    const text = await this.ask(
      `Você é um assistente jurídico brasileiro. Classifique o documento abaixo.\n` +
      `Nome do arquivo: "${fileName}"\nTipo MIME: "${mimeType}"\n\n` +
      `Responda APENAS com uma dessas categorias (sem explicação): ${DOCUMENT_TYPES.join(', ')}\n` +
      `Se não tiver certeza, responda: extra`
    )
    if (!text) return null
    const clean = text.toLowerCase().trim().split(/\s/)[0] ?? ''
    return DOCUMENT_TYPES.includes(clean) ? clean : null
  }

  // Generates a professional narrative summary for a process
  async generateProcessSummary(data: {
    case_title: string
    process_type: string
    status: string
    client_name: string
    case_description?: string | null
    court?: string | null
    opposing_party?: string | null
    pending_deadline?: string | null
  }): Promise<string | null> {
    return this.ask(
      `Você é um advogado brasileiro redigindo um resumo interno de processo.\n` +
      `Escreva 2-3 parágrafos objetivos e profissionais com as informações abaixo.\n\n` +
      `Título: ${data.case_title}\n` +
      `Tipo: ${data.process_type}\n` +
      `Status: ${data.status}\n` +
      `Cliente: ${data.client_name}\n` +
      (data.court ? `Vara/Tribunal: ${data.court}\n` : '') +
      (data.opposing_party ? `Parte contrária: ${data.opposing_party}\n` : '') +
      (data.pending_deadline ? `Prazo: ${data.pending_deadline}\n` : '') +
      (data.case_description ? `\nDescrição do caso:\n${data.case_description.slice(0, 1000)}` : '')
    )
  }

  // Generates ai_summary from intake form data
  async summarizeIntake(clientName: string, caseDescription: string, profession?: string | null): Promise<string | null> {
    return this.ask(
      `Você é um advogado brasileiro resumindo o relato de um cliente recebido via formulário de intake.\n` +
      `Escreva 1-2 parágrafos objetivos e profissionais, sem revelar dados pessoais sensíveis.\n\n` +
      `Cliente: ${clientName}\n` +
      (profession ? `Profissão: ${profession}\n` : '') +
      `Relato:\n${caseDescription.slice(0, 2000)}`
    )
  }

  // Generates an intelligent bot reply for unrecognized WhatsApp messages
  async classifyWhatsAppIntent(message: string, clientName: string, processContext: string): Promise<string | null> {
    return this.ask(
      `Você é o assistente virtual de um escritório de advocacia brasileiro.\n` +
      `Responda de forma profissional, empática e breve (máximo 3 linhas) à mensagem do cliente.\n` +
      `Não revele detalhes jurídicos internos. Use o nome do cliente.\n\n` +
      `Cliente: ${clientName}\n` +
      `Contexto: ${processContext}\n` +
      `Mensagem: "${message}"`
    )
  }
}

export const geminiService = new GeminiService()
