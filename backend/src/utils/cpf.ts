export function validarCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false

  const calcDigit = (slice: string, factor: number) => {
    let sum = 0
    for (let i = 0; i < slice.length; i++) {
      sum += parseInt(slice[i]!) * (factor - i)
    }
    const rem = (sum * 10) % 11
    return rem === 10 || rem === 11 ? 0 : rem
  }

  const d1 = calcDigit(digits.slice(0, 9), 10)
  const d2 = calcDigit(digits.slice(0, 10), 11)
  return d1 === parseInt(digits[9]!) && d2 === parseInt(digits[10]!)
}

export function sanitizarCPF(cpf: string): string {
  return cpf.replace(/\D/g, '')
}

export function mascararCPF(cpf: string): string {
  const d = sanitizarCPF(cpf)
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.***-**` : cpf
}
