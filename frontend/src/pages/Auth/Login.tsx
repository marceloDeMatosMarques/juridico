import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function Login() {
  const { login, register } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  function switchMode(next: 'login' | 'register') {
    setMode(next)
    setErro('')
    setName('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setErro('As senhas não coincidem.')
        return
      }
      if (password.length < 8) {
        setErro('A senha deve ter pelo menos 8 caracteres.')
        return
      }
    }

    setCarregando(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(name, email, password)
      }
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { erro?: string } } }).response?.data?.erro
        ?? (err instanceof Error ? err.message : 'Ocorreu um erro. Tente novamente.')
      setErro(msg)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="account-page">
      <div className="container-fluid p-0">
        <div className="row g-0 px-3 py-3 vh-100 align-items-center justify-content-center">
          <div className="col-xl-4 col-lg-5 col-md-6">

            <div className="auth-title-section mb-3 text-start">
              <h4 className="text-dark fw-medium mb-1">⚖️ JurisControl</h4>
              <p className="text-muted fs-14 mb-0">Sistema de Gestão Jurídica</p>
            </div>

            <div className="card mb-0 shadow-none border">
              <div className="card-body p-lg-4">

                {/* Tabs Login / Cadastro */}
                <ul className="nav nav-tabs nav-bordered mb-4">
                  <li className="nav-item">
                    <button
                      className={`nav-link${mode === 'login' ? ' active' : ''}`}
                      onClick={() => switchMode('login')}
                      type="button"
                    >
                      Entrar
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link${mode === 'register' ? ' active' : ''}`}
                      onClick={() => switchMode('register')}
                      type="button"
                    >
                      Criar conta
                    </button>
                  </li>
                </ul>

                <form onSubmit={handleSubmit}>

                  {mode === 'register' && (
                    <div className="form-group mb-3">
                      <label htmlFor="name" className="form-label">Nome completo</label>
                      <input
                        className="form-control"
                        type="text"
                        id="name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Seu nome"
                        required
                        minLength={2}
                      />
                    </div>
                  )}

                  <div className="form-group mb-3">
                    <label htmlFor="email" className="form-label">E-mail</label>
                    <input
                      className="form-control"
                      type="email"
                      id="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                    />
                  </div>

                  <div className="form-group mb-3">
                    <label htmlFor="password" className="form-label">Senha</label>
                    <input
                      className="form-control"
                      type="password"
                      id="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : '••••••••'}
                      required
                      minLength={mode === 'register' ? 8 : undefined}
                    />
                  </div>

                  {mode === 'register' && (
                    <div className="form-group mb-3">
                      <label htmlFor="confirmPassword" className="form-label">Confirmar senha</label>
                      <input
                        className="form-control"
                        type="password"
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Repita a senha"
                        required
                      />
                    </div>
                  )}

                  {erro && (
                    <div className="alert alert-danger py-2 fs-14 mb-3" role="alert">
                      {erro}
                    </div>
                  )}

                  <div className="d-grid mb-0">
                    <button className="btn btn-primary fw-semibold" type="submit" disabled={carregando}>
                      {carregando
                        ? (mode === 'login' ? 'Entrando...' : 'Criando conta...')
                        : (mode === 'login' ? 'Entrar' : 'Criar conta')}
                    </button>
                  </div>
                </form>

                <div className="saprator my-3">
                  <span>{mode === 'login' ? 'Ou entre com' : 'Ou cadastre-se com'}</span>
                </div>

                <div className="row g-2">
                  <div className="col-6">
                    <a href="/auth/microsoft" className="btn text-dark border fw-normal d-flex align-items-center justify-content-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 23 23" className="me-2">
                        <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
                        <path fill="#f35325" d="M1 1h10v10H1z"/>
                        <path fill="#81bc06" d="M12 1h10v10H12z"/>
                        <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                        <path fill="#ffba08" d="M12 12h10v10H12z"/>
                      </svg>
                      Microsoft
                    </a>
                  </div>
                  <div className="col-6">
                    <a href="/auth/google" className="btn text-dark border fw-normal d-flex align-items-center justify-content-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48" className="me-2">
                        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                        <path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/>
                        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                      </svg>
                      Google
                    </a>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
