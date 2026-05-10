export function sanitizarCEP(cep: string): string {
  return cep.replace(/\D/g, '')
}

export function sanitizarWhatsApp(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function sanitizarTelefone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function formatarDataExtenso(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
