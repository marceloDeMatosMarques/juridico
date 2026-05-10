import { useState, useEffect, FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { validarCPF, aplicarMascaraCPF } from '../../utils/cpf'

type IntakeStatus = {
  token: string; expires_at: string; process_id?: string
  client?: { full_name: string; email?: string } | null
  advogado?: { name: string; oab_number?: string; oab_state?: string } | null
}
type DocExistente = { id: string; file_name: string; document_type: string; upload_date: string }

export default function IntakeForm() {
  const { token } = useParams<{ token: string }>()
  const [status, setStatus]   = useState<IntakeStatus | null>(null)
  const [erroToken, setErroToken] = useState('')
  const [docs, setDocs]       = useState<DocExistente[]>([])
  const [cpfInput, setCpfInput]   = useState('')
  const [cpfErro, setCpfErro]     = useState('')
  const [lgpdOk, setLgpdOk]       = useState(false)
  const [enviando, setEnviando]   = useState(false)
  const [concluido, setConcluido] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState('')
  const [reqPassword, setReqPassword] = useState(false)
  const [senhaModal, setSenhaModal]   = useState('')
  const [arquivoPendente, setArquivoPendente] = useState<File | null>(null)
  const [tipoPendente, setTipoPendente] = useState('')

  const [form, setForm] = useState({
    full_name: '', rg: '', birth_date: '', email: '', phone: '', whatsapp: '',
    address: '', address_number: '', complement: '', neighborhood: '', city: '', state: '', zip_code: '',
    gender: '', social_name: '', marital_status: '', nationality: 'Brasileiro', profession: '',
    case_description: '',
  })

  useEffect(() => {
    if (!token) return
    fetch(`/api/intake/${token}/status`)
      .then(r => r.json())
      .then((d: IntakeStatus & { erro?: string }) => {
        if (d.erro) { setErroToken(d.erro); return }
        setStatus(d)
        if (d.client?.full_name) setForm(prev => ({ ...prev, full_name: d.client!.full_name, email: d.client?.email ?? '' }))
      })
      .catch(() => setErroToken('Erro ao carregar formulário.'))
  }, [token])

  useEffect(() => {
    if (!token || !status?.process_id) return
    fetch(`/api/intake/${token}/documents`)
      .then(r => r.json())
      .then((d: { documents: DocExistente[] }) => setDocs(d.documents))
      .catch(() => null)
  }, [token, status?.process_id])

  const set = (k: keyof typeof form, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  async function buscarCEP(cep: string) {
    const c = cep.replace(/\D/g, '')
    if (c.length !== 8) return
    try {
      const r = await fetch(`https://viacep.com.br/ws/${c}/json/`)
      const d = await r.json() as { logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: boolean }
      if (!d.erro) setForm(prev => ({ ...prev, address: d.logradouro ?? prev.address, neighborhood: d.bairro ?? prev.neighborhood, city: d.localidade ?? prev.city, state: d.uf ?? prev.state }))
    } catch { /* silencioso */ }
  }

  async function baixarTempProcuracao() {
    if (!token) return
    const r = await fetch(`/api/intake/${token}/generate-temp-procuracao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, cpf: cpfInput.replace(/\D/g, '') }),
    })
    const d = await r.json() as { downloadUrl?: string }
    if (d.downloadUrl) window.open(d.downloadUrl, '_blank')
  }

  async function handleUpload(file: File, documentType: string, senha?: string) {
    if (!token) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('document_type', documentType)
    if (senha) fd.append('password', senha)

    const r = await fetch(`/api/intake/${token}/upload`, { method: 'POST', body: fd })
    const d = await r.json() as { requiresPassword?: boolean; filename?: string }
    if (d.requiresPassword) {
      setArquivoPendente(file)
      setTipoPendente(documentType)
      setReqPassword(true)
      return
    }
    setDocs(prev => [...prev, { id: d.filename ?? '', file_name: file.name, document_type: documentType, upload_date: new Date().toISOString() }])
  }

  async function confirmarSenha() {
    if (arquivoPendente) {
      await handleUpload(arquivoPendente, tipoPendente, senhaModal)
      setReqPassword(false)
      setSenhaModal('')
      setArquivoPendente(null)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validarCPF(cpfInput)) { setCpfErro('CPF inválido'); return }
    if (!lgpdOk) return
    setEnviando(true)
    try {
      const r = await fetch(`/api/intake/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, cpf: cpfInput.replace(/\D/g, ''), lgpd_consent: true }),
      })
      const d = await r.json() as { downloadUrl?: string; erro?: string }
      if (d.erro) { alert(d.erro); return }
      setDownloadUrl(d.downloadUrl ?? '')
      setConcluido(true)
    } catch { alert('Erro ao enviar. Tente novamente.') }
    finally { setEnviando(false) }
  }

  if (erroToken) return (
    <div className="container mt-5 text-center">
      <div className="alert alert-danger">{erroToken}</div>
    </div>
  )

  if (!status) return (
    <div className="container mt-5 text-center">
      <div className="spinner-border text-primary" />
    </div>
  )

  if (concluido) return (
    <div className="container mt-5 text-center">
      <div className="alert alert-success mb-4">
        <h5>Dados enviados com sucesso!</h5>
        <p>Obrigado. Seu advogado receberá as informações e entrará em contato.</p>
      </div>
      {downloadUrl && (
        <a href={downloadUrl} className="btn btn-primary" target="_blank" rel="noreferrer">
          ⬇ Baixar Procuração (assinar e devolver)
        </a>
      )}
    </div>
  )

  const camposPreenchidos = form.full_name && form.address && form.city
  const cpfValido = validarCPF(cpfInput)
  const podeBaixarTemp = cpfValido && camposPreenchidos

  return (
    <div className="container py-4" style={{ maxWidth: 720 }}>
      {status.advogado && (
        <div className="mb-4 text-center">
          <h5>Formulário de Cadastro</h5>
          <p className="text-muted">Escritório: {status.advogado.name}{status.advogado.oab_number ? ` | OAB/${status.advogado.oab_state} ${status.advogado.oab_number}` : ''}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Seção 1 — Dados pessoais */}
        <div className="card mb-3">
          <div className="card-body">
            <h6 className="card-title">1. Dados Pessoais</h6>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Nome completo *</label>
                <input className="form-control" value={form.full_name} onChange={e => set('full_name', e.target.value)} required />
              </div>
              <div className="col-md-6">
                <label className="form-label">Nome social (opcional)</label>
                <input className="form-control" value={form.social_name} onChange={e => set('social_name', e.target.value)} />
              </div>
              <div className="col-md-4">
                <label className="form-label">CPF *</label>
                <input
                  className={`form-control ${cpfErro ? 'is-invalid' : cpfInput && cpfValido ? 'is-valid' : ''}`}
                  value={cpfInput}
                  onChange={e => { const v = aplicarMascaraCPF(e.target.value); setCpfInput(v); setCpfErro(v && !validarCPF(v) ? 'CPF inválido' : '') }}
                  placeholder="000.000.000-00"
                  required
                />
                {cpfErro && <div className="invalid-feedback">{cpfErro}</div>}
              </div>
              <div className="col-md-4">
                <label className="form-label">RG</label>
                <input className="form-control" value={form.rg} onChange={e => set('rg', e.target.value)} />
              </div>
              <div className="col-md-4">
                <label className="form-label">Data de nascimento</label>
                <input className="form-control" type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} />
              </div>
              <div className="col-md-4">
                <label className="form-label">Gênero</label>
                <select className="form-select" value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="">Prefiro não informar</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                  <option value="NB">Não-binário</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Estado civil</label>
                <select className="form-select" value={form.marital_status} onChange={e => set('marital_status', e.target.value)}>
                  <option value="">Não informado</option>
                  <option value="solteiro">Solteiro(a)</option>
                  <option value="casado">Casado(a)</option>
                  <option value="divorciado">Divorciado(a)</option>
                  <option value="viuvo">Viúvo(a)</option>
                  <option value="uniao_estavel">União Estável</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Profissão</label>
                <input className="form-control" value={form.profession} onChange={e => set('profession', e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label">E-mail</label>
                <input className="form-control" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Telefone</label>
                <input className="form-control" value={form.phone} onChange={e => set('phone', e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label">WhatsApp</label>
                <input className="form-control" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} />
              </div>
            </div>

            {podeBaixarTemp && (
              <button type="button" className="btn btn-outline-secondary btn-sm mt-3" onClick={baixarTempProcuracao}>
                ⬇ Baixar procuração para assinar (provisória)
              </button>
            )}
          </div>
        </div>

        {/* Seção 2 — Endereço */}
        <div className="card mb-3">
          <div className="card-body">
            <h6 className="card-title">2. Endereço</h6>
            <div className="row g-3">
              <div className="col-md-3">
                <label className="form-label">CEP *</label>
                <input className="form-control" value={form.zip_code} onChange={e => { const v = e.target.value.replace(/\D/g,'').slice(0,8); set('zip_code', v); void buscarCEP(v) }} required />
              </div>
              <div className="col-md-6">
                <label className="form-label">Endereço *</label>
                <input className="form-control" value={form.address} onChange={e => set('address', e.target.value)} required />
              </div>
              <div className="col-md-3">
                <label className="form-label">Número</label>
                <input className="form-control" value={form.address_number} onChange={e => set('address_number', e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Complemento</label>
                <input className="form-control" value={form.complement} onChange={e => set('complement', e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label">Bairro</label>
                <input className="form-control" value={form.neighborhood} onChange={e => set('neighborhood', e.target.value)} />
              </div>
              <div className="col-md-4">
                <label className="form-label">Cidade *</label>
                <input className="form-control" value={form.city} onChange={e => set('city', e.target.value)} required />
              </div>
              <div className="col-md-2">
                <label className="form-label">UF *</label>
                <input className="form-control" value={form.state} onChange={e => set('state', e.target.value)} maxLength={2} required />
              </div>
            </div>
          </div>
        </div>

        {/* Seção 3 — Documentos (só com process_id) */}
        {status.process_id && (
          <div className="card mb-3">
            <div className="card-body">
              <h6 className="card-title">3. Documentos</h6>
              {[
                { tipo: 'procuracao', label: 'Procuração assinada (escanear e enviar)' },
                { tipo: 'identidade', label: 'RG ou CNH' },
                { tipo: 'comprovante_residencia', label: 'Comprovante de residência' },
                { tipo: 'extra', label: 'Documentos do caso (opcional)' },
              ].map(({ tipo, label }) => (
                <div key={tipo} className="mb-3">
                  <label className="form-label fs-14">{label}</label>
                  <input
                    type="file"
                    className="form-control form-control-sm"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
                    onChange={e => { const f = e.target.files?.[0]; if (f) void handleUpload(f, tipo) }}
                  />
                </div>
              ))}
              {docs.length > 0 && (
                <ul className="list-group list-group-sm mt-2">
                  {docs.map(d => (
                    <li key={d.id} className="list-group-item py-1 fs-13">
                      ✓ {d.file_name} <span className="text-muted">({d.document_type})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Seção 4 — Resumo (só com process_id) */}
        {status.process_id && (
          <div className="card mb-3">
            <div className="card-body">
              <h6 className="card-title">4. Resumo do caso (opcional)</h6>
              <textarea className="form-control" rows={4} value={form.case_description} onChange={e => set('case_description', e.target.value)} placeholder="Descreva brevemente o que aconteceu..." />
            </div>
          </div>
        )}

        {/* Seção 5 — LGPD */}
        <div className="card mb-3">
          <div className="card-body">
            <div className="form-check">
              <input className="form-check-input" type="checkbox" id="lgpd" checked={lgpdOk} onChange={e => setLgpdOk(e.target.checked)} required />
              <label className="form-check-label fs-13" htmlFor="lgpd">
                Autorizo o escritório a utilizar meus dados pessoais para gestão do processo judicial, conforme a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
              </label>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary w-100"
          disabled={enviando || !cpfValido || !lgpdOk}
        >
          {enviando ? 'Enviando...' : 'Confirmar e Enviar'}
        </button>
      </form>

      {/* Modal senha PDF */}
      {reqPassword && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="modal-dialog modal-sm">
            <div className="modal-content">
              <div className="modal-header">
                <h6 className="modal-title">PDF protegido por senha</h6>
              </div>
              <div className="modal-body">
                <input className="form-control" type="password" placeholder="Informe a senha do PDF" value={senhaModal} onChange={e => setSenhaModal(e.target.value)} />
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary btn-sm" onClick={() => { setReqPassword(false); setSenhaModal('') }}>Cancelar</button>
                <button className="btn btn-primary btn-sm" onClick={() => void confirmarSenha()}>Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
