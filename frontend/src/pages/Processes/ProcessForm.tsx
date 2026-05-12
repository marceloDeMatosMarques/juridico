import { useState, useEffect, FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Select, { type StylesConfig } from 'react-select'
import { api } from '../../services/api'
import { aplicarMascaraProcesso } from '../../utils/processo'

type FormData = {
  client_id: string
  case_title: string
  process_number: string
  process_type: string
  status: string
  court: string
  judge: string
  opposing_party: string
  court_system: string
  court_email_domain: string
  pending_deadline: string
  case_description: string
}

type Client = { id: string; full_name: string }
type ClientOption = { value: string; label: string }

const selectStyles: StylesConfig<ClientOption> = {
  control: (base, state) => ({
    ...base,
    minHeight: 'calc(1.5em + 0.75rem + 2px)',
    borderColor: state.isFocused ? '#86b7fe' : '#dee2e6',
    boxShadow: state.isFocused ? '0 0 0 0.25rem rgba(13,110,253,.25)' : 'none',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    '&:hover': { borderColor: state.isFocused ? '#86b7fe' : '#dee2e6' },
  }),
  valueContainer: (base) => ({ ...base, padding: '0.25rem 0.75rem' }),
  input: (base) => ({ ...base, margin: 0, padding: 0 }),
  placeholder: (base) => ({ ...base, color: '#6c757d' }),
  menu: (base) => ({ ...base, zIndex: 9999, fontSize: '0.875rem' }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? '#0d6efd' : state.isFocused ? '#e9ecef' : 'white',
    color: state.isSelected ? 'white' : '#212529',
    cursor: 'pointer',
  }),
  singleValue: (base) => ({ ...base, color: '#212529' }),
  indicatorSeparator: () => ({ display: 'none' }),
}

const PROCESS_TYPES = [
  { value: 'civil_consumidor', label: 'Civil — Consumidor' },
  { value: 'civil_indenizatorio', label: 'Civil — Indenizatório' },
  { value: 'civil_obrigacional', label: 'Civil — Obrigacional' },
  { value: 'trabalhista', label: 'Trabalhista' },
  { value: 'criminal', label: 'Criminal' },
  { value: 'previdenciario', label: 'Previdenciário' },
  { value: 'familia', label: 'Família' },
  { value: 'tributario', label: 'Tributário' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'outro', label: 'Outro' },
]

const COURT_SYSTEMS = [
  { value: 'pje', label: 'PJe' },
  { value: 'eproc', label: 'Eproc' },
  { value: 'projudi', label: 'Projudi' },
  { value: 'saj', label: 'SAJ' },
  { value: 'esaj', label: 'eSAJ' },
  { value: 'manual', label: 'Manual' },
]

const EMPTY: FormData = {
  client_id: '', case_title: '', process_number: '', process_type: 'civil_consumidor',
  status: 'aberto', court: '', judge: '', opposing_party: '', court_system: '',
  court_email_domain: '', pending_deadline: '', case_description: '',
}

export default function ProcessForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const isEdit = !!id

  const [form, setForm] = useState<FormData>({ ...EMPTY, client_id: searchParams.get('client') ?? '' })
  const [clients, setClients] = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    api.get<{ data: Client[] }>('/api/clients?limit=100')
      .then(({ data }) => setClients(data.data ?? []))
      .catch(() => setErro('Não foi possível carregar a lista de clientes. Recarregue a página.'))
      .finally(() => setLoadingClients(false))
  }, [])

  useEffect(() => {
    if (isEdit) {
      api.get<FormData & { client: Client }>(`/api/processes/${id}`)
        .then(({ data }) => {
          setForm({
            client_id:          data.client_id ?? '',
            case_title:         data.case_title ?? '',
            process_number:     data.process_number ?? '',
            process_type:       data.process_type ?? 'civil_consumidor',
            status:             data.status ?? 'aberto',
            court:              data.court ?? '',
            judge:              data.judge ?? '',
            opposing_party:     data.opposing_party ?? '',
            court_system:       data.court_system ?? '',
            court_email_domain: data.court_email_domain ?? '',
            pending_deadline:   data.pending_deadline ? String(data.pending_deadline).slice(0, 10) : '',
            case_description:   data.case_description ?? '',
          })
        })
    }
  }, [id, isEdit])

  const set = (field: keyof FormData, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isEdit && !form.client_id) {
      setErro('Selecione um cliente antes de salvar.')
      return
    }
    setSalvando(true)
    setErro('')
    try {
      const payload = {
        ...form,
        process_number: form.process_number || undefined,
        court_system: form.court_system || undefined,
        pending_deadline: form.pending_deadline || undefined,
      }
      if (isEdit) {
        await api.put(`/api/processes/${id}`, payload)
        navigate(`/processes/${id}`)
      } else {
        const { data } = await api.post<{ id: string }>('/api/processes', payload)
        navigate(`/processes/${data.id}`)
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { erro?: string } } }).response?.data?.erro ?? 'Erro ao salvar processo.'
      setErro(msg)
    } finally { setSalvando(false) }
  }

  return (
    <div className="content-page">
      <div className="content">
        <div className="container-fluid">
          <div className="row">
            <div className="col-12">
              <div className="page-title-box d-flex align-items-center gap-2">
                <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate(-1)}>‹</button>
                <h4 className="page-title mb-0">{isEdit ? 'Editar Processo' : 'Novo Processo'}</h4>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col">
                <div className="card mb-3">
                  <div className="card-body">
                    <h5 className="card-title mb-3">Dados do Processo</h5>
                    <div className="row g-3">

                      {!isEdit && (
                        <div className="col-md-12">
                          <label className="form-label">Cliente *</label>
                          <Select<ClientOption>
                            options={clients.map(c => ({ value: c.id, label: c.full_name }))}
                            value={form.client_id
                              ? { value: form.client_id, label: clients.find(c => c.id === form.client_id)?.full_name ?? '' }
                              : null}
                            onChange={opt => set('client_id', opt?.value ?? '')}
                            placeholder={loadingClients ? 'Carregando clientes...' : 'Buscar cliente...'}
                            isSearchable
                            isDisabled={loadingClients}
                            isLoading={loadingClients}
                            noOptionsMessage={() => 'Nenhum cliente encontrado'}
                            loadingMessage={() => 'Carregando...'}
                            styles={selectStyles}
                          />
                        </div>
                      )}

                      <div className="col-md-8">
                        <label className="form-label">Título do caso *</label>
                        <input className="form-control" value={form.case_title} onChange={e => set('case_title', e.target.value)} required />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">Nº do Processo</label>
                        <input
                          className="form-control"
                          placeholder="0000000-00.0000.0.00.0000"
                          value={form.process_number}
                          onChange={e => set('process_number', aplicarMascaraProcesso(e.target.value))}
                        />
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">Tipo</label>
                        <select className="form-select" value={form.process_type} onChange={e => set('process_type', e.target.value)}>
                          {PROCESS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">Status</label>
                        <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                          <option value="aberto">Aberto</option>
                          <option value="em_andamento">Em andamento</option>
                          <option value="aguardando_audiencia">Aguardando audiência</option>
                          <option value="encerrado">Encerrado</option>
                          <option value="ganho">Ganho</option>
                          <option value="perdido">Perdido</option>
                          <option value="acordo">Acordo</option>
                          <option value="arquivado">Arquivado</option>
                        </select>
                      </div>

                      <div className="col-md-4">
                        <label className="form-label">Sistema judicial</label>
                        <select className="form-select" value={form.court_system} onChange={e => set('court_system', e.target.value)}>
                          <option value="">Selecione</option>
                          {COURT_SYSTEMS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>

                      <div className="col-md-6">
                        <label className="form-label">Vara / Tribunal</label>
                        <input className="form-control" value={form.court} onChange={e => set('court', e.target.value)} />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label">Juiz(a)</label>
                        <input className="form-control" value={form.judge} onChange={e => set('judge', e.target.value)} />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label">Parte contrária</label>
                        <input className="form-control" value={form.opposing_party} onChange={e => set('opposing_party', e.target.value)} />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label">Prazo pendente</label>
                        <input className="form-control" type="date" value={form.pending_deadline} onChange={e => set('pending_deadline', e.target.value)} />
                      </div>

                      <div className="col-md-6">
                        <label className="form-label">Domínio de e-mail do tribunal</label>
                        <input className="form-control" placeholder="@pje.jus.br" value={form.court_email_domain} onChange={e => set('court_email_domain', e.target.value)} />
                      </div>

                      <div className="col-12">
                        <label className="form-label">Resumo do caso</label>
                        <textarea className="form-control" rows={4} value={form.case_description} onChange={e => set('case_description', e.target.value)} />
                      </div>

                    </div>
                  </div>
                </div>

                {erro && <div className="alert alert-danger">{erro}</div>}

                <div className="d-flex gap-2 mb-4">
                  <button className="btn btn-primary" type="submit" disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button className="btn btn-outline-secondary" type="button" onClick={() => navigate(-1)}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
