import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { portalApi } from '../../services/portalApi'
import { usePortalStore } from '../../store/portalStore'

export default function PortalChangePassword() {
  const navigate         = useNavigate()
  const setPasswordChanged = usePortalStore((s) => s.setPasswordChanged)
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [erro, setErro]           = useState('')
  const [success, setSuccess]     = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setErro('Senha deve ter pelo menos 6 caracteres.'); return }
    if (password !== confirm) { setErro('As senhas não conferem.'); return }
    setLoading(true)
    setErro('')
    try {
      await portalApi.put('/api/portal/me/password', { password })
      setPasswordChanged()
      setSuccess(true)
    } catch {
      setErro('Erro ao alterar senha.')
    } finally {
      setLoading(false)
    }
  }

  if (success) return (
    <div className="text-center py-5">
      <div className="fs-40 mb-3">✅</div>
      <h5 className="fw-bold">Senha alterada com sucesso!</h5>
      <button className="btn btn-primary mt-2" onClick={() => navigate('/portal/dashboard')}>Ir para meus processos</button>
    </div>
  )

  return (
    <div className="card border-0 shadow-sm" style={{ maxWidth: 400 }}>
      <div className="card-body p-4">
        <h5 className="fw-bold mb-4">Criar nova senha</h5>
        {erro && <div className="alert alert-danger py-2 fs-13">{erro}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label fs-13">Nova senha</label>
            <input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <div className="mb-4">
            <label className="form-label fs-13">Confirmar senha</label>
            <input type="password" className="form-control" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <button className="btn btn-primary w-100" disabled={loading}>
            {loading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
            Salvar nova senha
          </button>
        </form>
      </div>
    </div>
  )
}
