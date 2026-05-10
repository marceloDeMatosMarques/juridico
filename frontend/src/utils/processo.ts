// Mask: NNNNNNN-DD.AAAA.J.TT.OOOO (20 digits)
export function aplicarMascaraProcesso(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 20)
  if (d.length <= 7) return d
  if (d.length <= 9)  return `${d.slice(0,7)}-${d.slice(7)}`
  if (d.length <= 13) return `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9)}`
  if (d.length <= 14) return `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d.slice(13)}`
  if (d.length <= 16) return `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d.slice(13,14)}.${d.slice(14)}`
  return `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d.slice(13,14)}.${d.slice(14,16)}.${d.slice(16)}`
}

// CNJ format: NNNNNNN-DD.AAAA.J.TT.OOOO  (J=segment, TT=tribunal code)
const TJ_CODE: Record<string, string> = {
  '01': 'AC', '02': 'AL', '03': 'AP', '04': 'AM', '05': 'BA',
  '06': 'CE', '07': 'DF', '08': 'ES', '09': 'GO', '10': 'MA',
  '11': 'MT', '12': 'MS', '13': 'MG', '14': 'PA', '15': 'PB',
  '16': 'PR', '17': 'PE', '18': 'PI', '19': 'RJ', '20': 'RN',
  '21': 'RS', '22': 'RO', '23': 'RR', '24': 'SC', '25': 'SE',
  '26': 'SP', '27': 'TO',
}

function decodeState(num: string): string | null {
  const d = num.replace(/[.\-]/g, '')
  if (d.length !== 20) return null
  if (d[13] === '8') return null  // federal (TRF) — handled separately
  return TJ_CODE[d.slice(14, 16)] ?? null
}

export function generateCourtLink(process: {
  process_number?: string | null
  court_system?: string | null
  state?: string | null
}): string | null {
  const num = process.process_number
  if (!num) return null
  const numRaw = num.replace(/[.\-]/g, '')

  const state = (process.state ?? decodeState(num) ?? '').toUpperCase()
  const sys   = process.court_system ?? ''

  // PJe — all state courts follow the same URL pattern
  const PJE_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SE','SP','TO','MS']
  if (sys === 'pje' && PJE_STATES.includes(state)) {
    return `https://pje.tj${state.toLowerCase()}.jus.br/pjekz/processo/${num}`
  }

  // eProc — TRF and state courts
  const EPROC: Record<string, string> = {
    RJ:   `https://eproc.tjrj.jus.br/eprocV2/controlador.php?acao=processo_selecionar&num_processo=${numRaw}`,
    SC:   `https://eproc.tjsc.jus.br/eprocV2/controlador.php?acao=processo_selecionar&num_processo=${numRaw}`,
    RS:   `https://eproc.tjrs.jus.br/eprocV2/controlador.php?acao=processo_selecionar&num_processo=${numRaw}`,
    TRF1: `https://eproc1.trf1.jus.br/eproc/externo_controlador.php?acao=processo_consulta_publica&num_processo=${numRaw}`,
    TRF4: `https://eproc.trf4.jus.br/eproc/externo_controlador.php?acao=processo_consulta_publica&num_processo=${numRaw}`,
  }
  if (sys === 'eproc' && EPROC[state]) return EPROC[state]

  // ESAJ — São Paulo, Santa Catarina, MS, CE
  const ESAJ: Record<string, string> = {
    SP: `https://esaj.tjsp.jus.br/cpopg/show.do?processo.foro=1&processo.numero=${num}`,
    SC: `https://esaj.tjsc.jus.br/cpopg/show.do?processo.foro=1&processo.numero=${num}`,
    MS: `https://esaj.tjms.jus.br/cpopg4/show.do?processo.foro=1&processo.numero=${num}`,
  }
  if (sys === 'esaj' && ESAJ[state]) return ESAJ[state]

  // PROJUDI — PR, GO, AM
  const PROJUDI: Record<string, string> = {
    PR: `https://projudi.tjpr.jus.br/projudi/abrirConsultaProcessos.do?_tjpr_tap_dispatch=true&numero=${num}`,
    GO: `https://projudi.tjgo.jus.br/projudi/abrirConsultaProcessos.do?numero=${num}`,
    AM: `https://projudi.tjam.jus.br/projudi/abrirConsultaProcessos.do?numero=${num}`,
  }
  if (sys === 'projudi' && PROJUDI[state]) return PROJUDI[state]

  // CNJ public search as universal fallback
  return `https://www.cnj.jus.br/pjecnj/Processo/ConsultaPublica/listView.seam?numeroProcesso=${num}`
}
