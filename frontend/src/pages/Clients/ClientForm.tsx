import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../services/api'
import { validarCPF, aplicarMascaraCPF, formatarCPF } from '../../utils/cpf'
import type { Client, ProcuracaoCheck } from '../../types/client'

const CAMPOS_OBRIGATORIOS: Array<keyof ProcuracaoCheck['obrigatorios']> = [
  'full_name', 'cpf', 'rg_ou_cnh', 'address', 'city', 'state', 'zip_code',
]
const LABEL_CAMPO: Record<string, string> = {
  full_name: 'Nome completo', cpf: 'CPF válido', rg_ou_cnh: 'RG ou CNH',
  address: 'Endereço', city: 'Cidade', state: 'Estado', zip_code: 'CEP',
}
const LABEL_REC: Record<string, string> = {
  gender: 'Gênero', profession: 'Profissão', marital_status: 'Estado civil', social_name: 'Nome social',
}

export default function ClientForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id

  const [form, setForm] = useState<Partial<Client>>({
    nationality: 'Brasileiro',
    status: 'ativo',
  })
  const [cpfInput, setCpfInput] = useState('')
  const [cpfErro, setCpfErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [procCheck, setProcCheck] = useState<ProcuracaoCheck | null>(null)
  const [gerandoProc, setGerandoProc] = useState(false)

  useEffect(() => {
    if (isEdit) {
      api.get<Client>(`/api/clients/${id}`).then(({ data }) => {
        setForm(data)
        setCpfInput(data.cpf ? formatarCPF(data.cpf) : '')
      })
    }
  }, [id, isEdit])

  useEffect(() => {
    if (isEdit && id) {
      api.get<ProcuracaoCheck>(`/api/clients/${id}/check-procuracao`)
        .then(({ data }) => setProcCheck(data))
        .catch(() => null)
    }
  }, [id, isEdit, form])

  const set = (field: keyof Client, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  async function buscarCEP(cep: string) {
    const c = cep.replace(/\D/g, '')
    if (c.length !== 8) return
    try {
      const r = await fetch(`https://viacep.com.br/ws/${c}/json/`)
      const data = await r.json() as { logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: boolean }
      if (!data.erro) {
        setForm(prev => ({
          ...prev,
          address: data.logradouro ?? prev.address,
          neighborhood: data.bairro ?? prev.neighborhood,
          city: data.localidade ?? prev.city,
          state: data.uf ?? prev.state,
        }))
      }
    } catch { /* ViaCEP indisponível — não bloqueia */ }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (cpfInput && !validarCPF(cpfInput)) { setCpfErro('CPF inválido'); return }

    setSalvando(true)
    setErro('')
    try {
      const payload = { ...form, cpf: cpfInput.replace(/\D/g, '') || undefined }
      if (isEdit) {
        await api.put(`/api/clients/${id}`, payload)
      } else {
        const { data } = await api.post('/api/clients', payload)
        navigate(`/clients/${data.id as string}`)
        return
      }
      navigate(`/clients/${id}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { erro?: string } } }).response?.data?.erro ?? 'Erro ao salvar cliente.'
      setErro(msg)
    } finally { setSalvando(false) }
  }

  async function gerarProcuracao() {
    if (!id || !procCheck?.pronto) return
    setGerandoProc(true)
    try {
      const { data } = await api.post<{ downloadUrl: string }>(`/api/clients/${id}/generate-procuracao`)
      window.open(data.downloadUrl, '_blank')
    } catch { alert('Erro ao gerar procuração.') }
    finally { setGerandoProc(false) }
  }

  return (
    <div className="content-page">
      <div className="content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <div className="page-title-box d-flex align-items-center gap-2">
                <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate('/clients')}>‹</button>
                <h4 className="page-title mb-0">{isEdit ? 'Editar Cliente' : 'Novo Cliente'}</h4>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="row">
              {/* Formulário principal */}
              <div className={isEdit ? 'col-lg-8' : 'col-12'}>
                <div className="card">
                  <div className="card-body">
                    <h5 className="card-title mb-3">Dados Pessoais</h5>
                    <div className="row g-3">

                      <div className="col-md-6">
                        <label className="form-label">Nome completo *</label>
                        <input className="form-control" value={form.full_name ?? ''} onChange={e => set('full_name', e.target.value)} required />
                      </div>

                      <div className="col-md-3">
                        <label className="form-label">Nome social</label>
                        <input className="form-control" value={form.social_name ?? ''} onChange={e => set('social_name', e.target.value)} placeholder="Opcional" />
                      </div>

                      <div className="col-md-3">
                        <label className="form-label">Identidade de Gênero</label>
                        <select className="form-select" value={form.gender ?? ''} onChange={e => set('gender', e.target.value)}>
                          <option value="">Não informado</option>
                          <option value="M">Masculino</option>
                          <option value="F">Feminino</option>
                          <option value="NB">Não-binário</option>
                          <option value="outro">Outro</option>
                        </select>
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">CPF</label>
                        <input
                          className={`form-control ${cpfErro ? 'is-invalid' : cpfInput && validarCPF(cpfInput) ? 'is-valid' : ''}`}
                          value={cpfInput}
                          onChange={e => {
                            const v = aplicarMascaraCPF(e.target.value)
                            setCpfInput(v)
                            setCpfErro(v && !validarCPF(v) ? 'CPF inválido' : '')
                          }}
                          placeholder="000.000.000-00"
                        />
                        {cpfErro && <div className="invalid-feedback">{cpfErro}</div>}
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">RG</label>
                        <input className="form-control" value={form.rg ?? ''} onChange={e => set('rg', e.target.value)} />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">Data de Nascimento</label>
                        <input className="form-control" type="date" value={form.birth_date ? form.birth_date.slice(0,10) : ''} onChange={e => set('birth_date', e.target.value)} />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">Estado civil</label>
                        <select className="form-select" value={form.marital_status ?? ''} onChange={e => set('marital_status', e.target.value)}>
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
                        <input className="form-control" value={form.profession ?? ''} onChange={e => set('profession', e.target.value)} />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">Nacionalidade</label>
                        <input className="form-control" value={form.nationality ?? 'Brasileiro'} onChange={e => set('nationality', e.target.value)} />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">E-mail</label>
                        <input className="form-control" type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">Telefone</label>
                        <input className="form-control" value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">WhatsApp</label>
                        <input className="form-control" value={form.whatsapp ?? ''} onChange={e => set('whatsapp', e.target.value)} />
                      </div>

                    </div>

                    <h5 className="card-title mt-4 mb-3">Endereço</h5>
                    <div className="row g-3">

                      <div className="col-md-3">
                        <label className="form-label">CEP</label>
                        <input
                          className="form-control"
                          value={form.zip_code ?? ''}
                          onChange={e => {
                            const v = e.target.value.replace(/\D/g, '').slice(0, 8)
                            set('zip_code', v)
                            void buscarCEP(v)
                          }}
                          placeholder="00000000"
                        />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label">Endereço</label>
                        <input className="form-control" value={form.address ?? ''} onChange={e => set('address', e.target.value)} />
                      </div>

                      <div className="col-md-3">
                        <label className="form-label">Número</label>
                        <input className="form-control" value={form.address_number ?? ''} onChange={e => set('address_number', e.target.value)} />
                      </div>

                      <div className="col-md-3">
                        <label className="form-label">Complemento</label>
                        <input className="form-control" value={form.complement ?? ''} onChange={e => set('complement', e.target.value)} />
                      </div>

                      <div className="col-md-3">
                        <label className="form-label">Bairro</label>
                        <input className="form-control" value={form.neighborhood ?? ''} onChange={e => set('neighborhood', e.target.value)} />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">Cidade</label>
                        <input className="form-control" value={form.city ?? ''} onChange={e => set('city', e.target.value)} />
                      </div>

                      <div className="col-md-2">
                        <label className="form-label">Estado</label>
                        <input className="form-control" value={form.state ?? ''} onChange={e => set('state', e.target.value)} maxLength={2} />
                      </div>

                    </div>
                  </div>
                </div>

                {erro && <div className="alert alert-danger">{erro}</div>}

                <div className="d-flex gap-2 mb-4">
                  <button className="btn btn-primary" type="submit" disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button className="btn btn-outline-secondary" type="button" onClick={() => navigate('/clients')}>
                    Cancelar
                  </button>
                </div>
              </div>

              {/* Card de Procuração (só no modo edição) */}
              {isEdit && procCheck && (
                <div className="col-lg-4">
                  <div className="card">
                    <div className="card-body">
                      <h6 className="card-title">Gerar Procuração</h6>
                      <ul className="list-unstyled mb-3">
                        {CAMPOS_OBRIGATORIOS.map(campo => (
                          <li key={campo} className="d-flex align-items-center gap-2 mb-1">
                            <span className={procCheck.obrigatorios[campo] ? 'text-success' : 'text-danger'}>
                              {procCheck.obrigatorios[campo] ? '✓' : '✗'}
                            </span>
                            <span className="fs-13">{LABEL_CAMPO[campo]}</span>
                          </li>
                        ))}
                        {Object.entries(procCheck.recomendados).map(([campo, ok]) => (
                          <li key={campo} className="d-flex align-items-center gap-2 mb-1">
                            <span className={ok ? 'text-success' : 'text-warning'}>
                              {ok ? '✓' : '⚠'}
                            </span>
                            <span className="fs-13 text-muted">{LABEL_REC[campo] ?? campo}</span>
                          </li>
                        ))}
                      </ul>
                      {!procCheck.pronto && (
                        <div className="alert alert-warning py-2 fs-13">Preencha todos os campos obrigatórios para gerar a procuração.</div>
                      )}
                      <button
                        className="btn btn-success w-100"
                        disabled={!procCheck.pronto || gerandoProc}
                        onClick={gerarProcuracao}
                        type="button"
                      >
                        {gerandoProc ? 'Gerando...' : '⬇ Gerar Procuração PDF'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
