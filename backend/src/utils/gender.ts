export type Gender = 'M' | 'F' | 'NB' | 'outro'

export interface GenderTerms {
  outorgante: string
  nacionalidade: string
  dr: string
  artigo: string
}

export function resolveGenderTerms(gender: Gender | null | undefined): GenderTerms {
  switch (gender) {
    case 'M':
      return { outorgante: 'o Outorgante', nacionalidade: 'brasileiro', dr: 'Dr.', artigo: 'o' }
    case 'F':
      return { outorgante: 'a Outorgante', nacionalidade: 'brasileira', dr: 'Dra.', artigo: 'a' }
    case 'NB':
    case 'outro':
    default:
      return { outorgante: 'o/a Outorgante', nacionalidade: 'brasileiro(a)', dr: 'Dr(a).', artigo: 'o(a)' }
  }
}

export function resolveMaritalStatus(
  status: string | null | undefined,
  gender: Gender | null | undefined
): string {
  if (!status) return 'não informado'
  const isFem = gender === 'F'
  const map: Record<string, string> = {
    solteiro:       isFem ? 'solteira' : 'solteiro',
    casado:         isFem ? 'casada'   : 'casado',
    divorciado:     isFem ? 'divorciada' : 'divorciado',
    viuvo:          isFem ? 'viúva'    : 'viúvo',
    uniao_estavel:  'em união estável',
  }
  return map[status] ?? status
}

const NATIONALITY_FEM: Record<string, string> = {
  'Brasileiro': 'Brasileira', 'Argentino': 'Argentina', 'Americano': 'Americana',
  'Italiano': 'Italiana', 'Português': 'Portuguesa', 'Francês': 'Francesa',
  'Espanhol': 'Espanhola', 'Alemão': 'Alemã', 'Japonês': 'Japonesa',
  'Chinês': 'Chinesa', 'Colombiano': 'Colombiana', 'Chileno': 'Chilena',
  'Peruano': 'Peruana', 'Mexicano': 'Mexicana', 'Uruguaio': 'Uruguaia',
  'Paraguaio': 'Paraguaia', 'Boliviano': 'Boliviana', 'Venezuelano': 'Venezuelana',
}

export function resolveNationality(
  nationality: string | null | undefined,
  gender: Gender | null | undefined
): string {
  const nat = (nationality ?? 'Brasileiro').trim()
  if (gender !== 'F') return nat
  return NATIONALITY_FEM[nat] ?? nat
}

export function resolveDisplayName(client: { full_name: string; social_name?: string | null }): string {
  return client.social_name?.trim() || client.full_name
}
