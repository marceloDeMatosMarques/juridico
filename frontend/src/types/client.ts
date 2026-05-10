export type ClientStatus = 'ativo' | 'inativo'
export type Gender = 'M' | 'F' | 'NB' | 'outro'
export type MaritalStatus = 'solteiro' | 'casado' | 'divorciado' | 'viuvo' | 'uniao_estavel'
export type DocumentType =
  | 'procuracao' | 'identidade' | 'cpf' | 'cnh' | 'comprovante_residencia'
  | 'nota_fiscal' | 'contrato' | 'foto_evidencia' | 'video_link'
  | 'pdf_unificado' | 'pdf_videos' | 'extra'

export interface Client {
  id: string
  full_name: string
  cpf?: string
  rg?: string
  birth_date?: string
  email?: string
  phone?: string
  whatsapp?: string
  address?: string
  address_number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  zip_code?: string
  notes?: string
  gender?: Gender
  social_name?: string
  marital_status?: MaritalStatus
  nationality?: string
  profession?: string
  status: ClientStatus
  portal_enabled?: boolean
  deleted_at?: string
  created_at: string
  updated_at: string
  _count?: { processes: number }
}

export interface ClientListResponse {
  data: Client[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface ProcuracaoCheck {
  pronto: boolean
  obrigatorios: Record<string, boolean>
  recomendados: Record<string, boolean>
}

export interface IntakeToken {
  id: string
  token: string
  process_id?: string
  expires_at: string
  used_at?: string
}
