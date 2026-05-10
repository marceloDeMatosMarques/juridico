export type Role = 'advogado' | 'assistente' | 'cliente'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: Role
  client_id?: string
  password_changed?: boolean
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  role: Role
  name: string
}

export interface ProvidersStatus {
  microsoft: { conectado: boolean; expira_em: string | null }
  google: { conectado: boolean; email: string | null }
  storage_provider: string
  calendar_provider: string
}
