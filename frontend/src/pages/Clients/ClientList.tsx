import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../services/api'
import { useDebounce } from '../../hooks/useDebounce'
import { mascararCPF } from '../../utils/cpf'
import type { Client, ClientListResponse } from '../../types/client'

export default function ClientList() {
  const navigate = useNavigate()
  const [clientes, setClientes] = useState<Client[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [pages, setPages]       = useState(1)
  const [busca, setBusca]       = useState('')
  const [status, setStatus]     = useState('')
  const [carregando, setCarregando] = useState(false)

  const buscaDebounced = useDebounce(busca, 300)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const { data } = await api.get<ClientListResponse>('/api/clients', {
        params: { page, limit: 20, busca: buscaDebounced, status: status || undefined },
      })
      setClientes(data.data)
      setTotal(data.total)
      setPages(data.pages)
    } catch { /* erros tratados pelo interceptor */ }
    finally { setCarregando(false) }
  }, [page, buscaDebounced, status])

  useEffect(() => { void carregar() }, [carregar])
  useEffect(() => { setPage(1) }, [buscaDebounced, status])

  async function gerarLinkIntake(clientId: string) {
    try {
      const { data } = await api.post('/api/intake/generate', { client_id: clientId })
      await navigator.clipboard.writeText(data.link)
      alert('Link de intake copiado para a área de transferência!')
    } catch { alert('Erro ao gerar link de intake.') }
  }

  return (
    <div className="content-page">
      <div className="content">
        <div className="container-fluid">

          <div className="row">
            <div className="col-12">
              <div className="page-title-box">
                <h4 className="page-title">Clientes</h4>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-body">

                  <div className="row mb-3 align-items-center">
                    <div className="col-md-5">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Buscar por nome, CPF ou e-mail..."
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                        <option value="">Todos os status</option>
                        <option value="ativo">Ativo</option>
                        <option value="inativo">Inativo</option>
                      </select>
                    </div>
                    <div className="col-md-4 text-end">
                      <button className="btn btn-primary" onClick={() => navigate('/clients/new')}>
                        + Novo Cliente
                      </button>
                    </div>
                  </div>

                  {carregando ? (
                    <div className="text-center py-4"><div className="spinner-border text-primary" /></div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover align-middle">
                        <thead>
                          <tr>
                            <th>Nome</th>
                            <th>CPF</th>
                            <th>Contato</th>
                            <th>Processos</th>
                            <th>Status</th>
                            <th>Cadastro</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientes.length === 0 ? (
                            <tr><td colSpan={7} className="text-center text-muted py-4">Nenhum cliente encontrado</td></tr>
                          ) : clientes.map(c => (
                            <tr key={c.id}>
                              <td className="fw-medium">{c.full_name}</td>
                              <td className="text-muted">{c.cpf ? mascararCPF(c.cpf) : '—'}</td>
                              <td className="text-muted">{c.whatsapp || c.phone || c.email || '—'}</td>
                              <td>{c._count?.processes ?? 0}</td>
                              <td>
                                <span className={`badge ${c.status === 'ativo' ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`}>
                                  {c.status}
                                </span>
                              </td>
                              <td className="text-muted fs-13">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                              <td>
                                <div className="d-flex gap-1">
                                  <button className="btn btn-sm btn-outline-secondary" title="Ver ficha" onClick={() => navigate(`/clients/${c.id}`)}>
                                    <i className="ri-eye-line" />
                                  </button>
                                  <button className="btn btn-sm btn-outline-secondary" title="Editar" onClick={() => navigate(`/clients/${c.id}/edit`)}>
                                    <i className="ri-pencil-line" />
                                  </button>
                                  <button className="btn btn-sm btn-outline-primary" title="Gerar link intake" onClick={() => gerarLinkIntake(c.id)}>
                                    <i className="ri-link" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Paginação */}
                  {pages > 1 && (
                    <div className="d-flex justify-content-between align-items-center mt-3">
                      <small className="text-muted">{total} cliente(s) encontrado(s)</small>
                      <ul className="pagination pagination-sm mb-0">
                        <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
                          <button className="page-link" onClick={() => setPage(p => p - 1)}>‹</button>
                        </li>
                        {Array.from({ length: Math.min(5, pages) }, (_, i) => i + 1).map(p => (
                          <li key={p} className={`page-item ${p === page ? 'active' : ''}`}>
                            <button className="page-link" onClick={() => setPage(p)}>{p}</button>
                          </li>
                        ))}
                        <li className={`page-item ${page >= pages ? 'disabled' : ''}`}>
                          <button className="page-link" onClick={() => setPage(p => p + 1)}>›</button>
                        </li>
                      </ul>
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
