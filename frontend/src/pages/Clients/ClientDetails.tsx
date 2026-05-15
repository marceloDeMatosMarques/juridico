import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import { mascararCPF } from '../../utils/cpf'
import type { Client } from '../../types/client'
import WhatsAppChat from './WhatsAppChat'

type Process = {
  id: string
  case_title: string
  process_number: string | null
  status: string
  open_date: string
  pending_deadline: string | null
}

const STATUS_ATIVOS  = ['aberto', 'em_andamento', 'aguardando_audiencia']
const STATUS_HIST    = ['encerrado', 'ganho', 'perdido', 'acordo', 'arquivado']

const STATUS_BADGE: Record<string, string> = {
  aberto: 'bg-primary-subtle text-primary',
  em_andamento: 'bg-info-subtle text-info',
  aguardando_audiencia: 'bg-warning-subtle text-warning',
  encerrado: 'bg-secondary-subtle text-secondary',
  ganho: 'bg-success-subtle text-success',
  perdido: 'bg-danger-subtle text-danger',
  acordo: 'bg-teal-subtle text-teal',
  arquivado: 'bg-secondary-subtle text-secondary',
}

export default function ClientDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [cliente, setCliente] = useState<Client & { processes: Process[] } | null>(null)
  const [abaAtiva, setAbaAtiva] = useState<'ativos' | 'historico'>('ativos')
  const [showChat, setShowChat] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [activatingPortal, setActivatingPortal] = useState(false)
  const [resendingPortal, setResendingPortal] = useState(false)
  const [portalCredentials, setPortalCredentials] = useState<{ email: string; password: string } | null>(null)

  useEffect(() => {
    if (!id) return
    api.get<Client & { processes: Process[] }>(`/api/clients/${id}`)
      .then(({ data }) => setCliente(data))
      .finally(() => setCarregando(false))
  }, [id])

  async function ativarPortal() {
    if (!id) return
    if (!confirm('Ativar o portal para este cliente?')) return
    setActivatingPortal(true)
    try {
      const { data } = await api.post<{ email: string; password: string }>(`/api/clients/${id}/activate-portal`)
      setCliente(prev => prev ? { ...prev, portal_enabled: true } : prev)
      setPortalCredentials({ email: data.email, password: data.password })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { erro?: string } } }).response?.data?.erro
      alert(msg ?? 'Erro ao ativar portal.')
    } finally {
      setActivatingPortal(false)
    }
  }

  async function reenviarPortal() {
    if (!id) return
    if (!confirm('Gerar nova senha e reenviar acesso ao portal via WhatsApp?')) return
    setResendingPortal(true)
    try {
      const { data } = await api.post<{ email: string; password: string }>(`/api/clients/${id}/resend-portal`)
      setPortalCredentials({ email: data.email, password: data.password })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { erro?: string } } }).response?.data?.erro
      alert(msg ?? 'Erro ao reenviar credenciais.')
    } finally {
      setResendingPortal(false)
    }
  }

  async function excluirCliente() {
    if (!id || !cliente) return
    if (!confirm(`Excluir o cliente "${cliente.full_name}"? Esta ação não pode ser desfeita.`)) return
    try {
      await api.delete(`/api/clients/${id}`)
      navigate('/clients')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { erro?: string } } }).response?.data?.erro
      alert(msg ?? 'Erro ao excluir cliente.')
    }
  }

  async function gerarLinkIntake(processId?: string) {
    if (!id) return
    try {
      const { data } = await api.post('/api/intake/generate', { client_id: id, process_id: processId })
      await navigator.clipboard.writeText(data.link)
      alert('Link copiado para a área de transferência!')
    } catch { alert('Erro ao gerar link.') }
  }

  if (carregando) return <div className="content-page"><div className="content p-4"><div className="spinner-border text-primary" /></div></div>
  if (!cliente)   return <div className="content-page"><div className="content p-4"><div className="alert alert-danger">Cliente não encontrado.</div></div></div>

  const processos = cliente.processes ?? []
  const ativos    = processos.filter(p => STATUS_ATIVOS.includes(p.status))
  const historico = processos.filter(p => STATUS_HIST.includes(p.status))
  const lista     = abaAtiva === 'ativos' ? ativos : historico

  return (
    <div className="content-page">
      <div className="content">
        <div className="container-fluid">

          <div className="row">
            <div className="col-12">
              <div className="page-title-box d-flex align-items-center gap-2">
                <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate('/clients')}>‹</button>
                <h4 className="page-title mb-0">{cliente.full_name}</h4>
                <span className={`badge ms-2 ${cliente.status === 'ativo' ? 'bg-success' : 'bg-secondary'}`}>
                  {cliente.status}
                </span>
              </div>
            </div>
          </div>

          <div className="row">
            {/* Dados pessoais */}
            <div className="col-md-4">
              <div className="card">
                <div className="card-body">
                  <h6 className="card-title">Dados Pessoais</h6>
                  <ul className="list-unstyled mb-0 fs-14">
                    {cliente.social_name && <li><strong>Nome social:</strong> {cliente.social_name}</li>}
                    <li><strong>CPF:</strong> {cliente.cpf ? mascararCPF(cliente.cpf) : '—'}</li>
                    {cliente.rg && <li><strong>RG:</strong> {cliente.rg}</li>}
                    {cliente.email && <li><strong>E-mail:</strong> {cliente.email}</li>}
                    {cliente.phone && <li><strong>Telefone:</strong> {cliente.phone}</li>}
                    {cliente.whatsapp && <li><strong>WhatsApp:</strong> {cliente.whatsapp}</li>}
                    {cliente.profession && <li><strong>Profissão:</strong> {cliente.profession}</li>}
                    {cliente.marital_status && <li><strong>Estado civil:</strong> {cliente.marital_status}</li>}
                    {(cliente.city || cliente.state) && (
                      <li><strong>Cidade:</strong> {cliente.city}{cliente.state ? ` / ${cliente.state}` : ''}</li>
                    )}
                  </ul>
                  <div className="d-flex gap-2 mt-3 flex-wrap">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate(`/clients/${cliente.id}/edit`)}>
                      Editar
                    </button>
                    <button className="btn btn-sm btn-outline-primary" onClick={() => gerarLinkIntake()}>
                      Gerar Link Intake
                    </button>
                    {(cliente.whatsapp || cliente.phone) && (
                      <button
                        className={`btn btn-sm ${showChat ? 'btn-success' : 'btn-outline-success'}`}
                        onClick={() => setShowChat(p => !p)}
                      >
                        <iconify-icon icon="solar:chat-round-like-linear" className="me-1" />WhatsApp
                      </button>
                    )}
                    <button className="btn btn-sm btn-outline-danger" onClick={excluirCliente}>
                      <iconify-icon icon="solar:trash-bin-linear" className="me-1" />Excluir
                    </button>
                    {!cliente.portal_enabled ? (
                      <button className="btn btn-sm btn-outline-info" onClick={ativarPortal} disabled={activatingPortal}>
                        {activatingPortal ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                        Ativar Portal
                      </button>
                    ) : (
                      <button className="btn btn-sm btn-info" onClick={reenviarPortal} disabled={resendingPortal} title="Gerar nova senha e reenviar via WhatsApp">
                        {resendingPortal ? <span className="spinner-border spinner-border-sm me-1" /> : <iconify-icon icon="solar:key-linear" className="me-1" />}
                        Portal ativo
                      </button>
                    )}
                  </div>
                  {showChat && (
                    <WhatsAppChat clientId={cliente.id} onClose={() => setShowChat(false)} />
                  )}
                  {portalCredentials && (
                    <div className="alert alert-success mt-3 mb-0 p-3">
                      <div className="d-flex justify-content-between align-items-start">
                        <strong className="fs-13">Portal ativado!</strong>
                        <button type="button" className="btn-close btn-close-sm" onClick={() => setPortalCredentials(null)} />
                      </div>
                      <div className="mt-2 fs-13">
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <span className="text-muted" style={{ minWidth: 50 }}>E-mail:</span>
                          <code className="flex-fill">{portalCredentials.email}</code>
                          <button className="btn btn-xs btn-outline-secondary" onClick={() => navigator.clipboard.writeText(portalCredentials.email)}>
                            <iconify-icon icon="solar:copy-linear" />
                          </button>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <span className="text-muted" style={{ minWidth: 50 }}>Senha:</span>
                          <code className="flex-fill">{portalCredentials.password}</code>
                          <button className="btn btn-xs btn-outline-secondary" onClick={() => navigator.clipboard.writeText(portalCredentials.password)}>
                            <iconify-icon icon="solar:copy-linear" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Processos */}
            <div className="col-md-8">
              <div className="card">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="card-title mb-0">Processos</h6>
                    <button className="btn btn-sm btn-primary" onClick={() => navigate(`/processes/new?client=${cliente.id}`)}>
                      + Novo Processo
                    </button>
                  </div>

                  <ul className="nav nav-tabs nav-bordered mb-3">
                    <li className="nav-item">
                      <button className={`nav-link ${abaAtiva === 'ativos' ? 'active' : ''}`} onClick={() => setAbaAtiva('ativos')}>
                        Ativos <span className="badge bg-primary ms-1">{ativos.length}</span>
                      </button>
                    </li>
                    <li className="nav-item">
                      <button className={`nav-link ${abaAtiva === 'historico' ? 'active' : ''}`} onClick={() => setAbaAtiva('historico')}>
                        Histórico <span className="badge bg-secondary ms-1">{historico.length}</span>
                      </button>
                    </li>
                  </ul>

                  {lista.length === 0 ? (
                    <p className="text-muted text-center py-3">Nenhum processo nesta aba.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm align-middle">
                        <thead>
                          <tr><th>Título</th><th>Nº Processo</th><th>Status</th><th>Prazo</th><th>Ações</th></tr>
                        </thead>
                        <tbody>
                          {lista.map(p => (
                            <tr key={p.id}>
                              <td className="fw-medium">{p.case_title}</td>
                              <td className="text-muted fs-13">{p.process_number ?? '—'}</td>
                              <td><span className={`badge ${STATUS_BADGE[p.status] ?? 'bg-secondary-subtle text-secondary'}`}>{p.status.replace(/_/g, ' ')}</span></td>
                              <td className="text-muted fs-13">
                                {p.pending_deadline
                                  ? <span className={new Date(p.pending_deadline) < new Date() ? 'text-danger fw-semibold' : ''}>
                                      {new Date(p.pending_deadline).toLocaleDateString('pt-BR')}
                                    </span>
                                  : '—'}
                              </td>
                              <td>
                                <div className="d-flex gap-1">
                                  <button className="btn btn-xs btn-outline-secondary" title="Ver processo" onClick={() => navigate(`/processes/${p.id}`)}>
                                    <iconify-icon icon="solar:eye-linear" />
                                  </button>
                                  {!p.process_number && (
                                    <button className="btn btn-xs btn-outline-primary" title="Intake interno" onClick={() => navigate(`/clients/${cliente.id}/intake?process=${p.id}`)}>
                                      <iconify-icon icon="solar:folder-open-linear" />
                                    </button>
                                  )}
                                  <button className="btn btn-xs btn-outline-success" title="Montar petição" onClick={() => navigate(`/processes/${p.id}/petition`)}>
                                    <iconify-icon icon="solar:document-text-linear" />
                                  </button>
                                  <button className="btn btn-xs btn-outline-primary" title="Gerar link intake" onClick={() => void gerarLinkIntake(p.id)}>
                                    <iconify-icon icon="solar:link-circle-linear" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
