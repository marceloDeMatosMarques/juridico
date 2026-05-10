import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortalStore } from '../../store/portalStore'

export default function PortalLogin() {
  const navigate  = useNavigate()
  const login     = usePortalStore((s) => s.login)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [erro, setErro]         = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/portal/dashboard', { replace: true })
    } catch {
      setErro('E-mail ou senha inválidos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
      <div className="card border-0 shadow" style={{ width: 380 }}>
        <div className="card-body p-4">
          <div className="text-center mb-4">
            <div className="fs-28 mb-2">⚖️</div>
            <h5 className="fw-bold mb-0">Portal do Cliente</h5>
            <p className="text-muted fs-13">Acompanhe seus processos</p>
          </div>

          {erro && <div className="alert alert-danger py-2 fs-13">{erro}</div>}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label fs-13">E-mail</label>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="mb-4">
              <label className="form-label fs-13">Senha</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary w-100" disabled={loading}>
              {loading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
              Entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
