export function validarCPF(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const calc = (slice: string, factor: number) => {
    let sum = 0
    for (let i = 0; i < slice.length; i++) sum += parseInt(slice[i]!) * (factor - i)
    const rem = (sum * 10) % 11
    return rem >= 10 ? 0 : rem
  }
  return calc(d.slice(0, 9), 10) === parseInt(d[9]!) && calc(d.slice(0, 10), 11) === parseInt(d[10]!)
}

export function mascararCPF(cpf: string): string {
  const d = cpf.replace(/\D/g, '')
  return d.length === 11 ? `${d.slice(0,3)}.${d.slice(3,6)}.***-**` : cpf
}

export function formatarCPF(cpf: string): string {
  const d = cpf.replace(/\D/g, '')
  return d.length === 11 ? `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}` : cpf
}

export function aplicarMascaraCPF(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}
