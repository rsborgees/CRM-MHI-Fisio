import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Login.css'

function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')

    const resposta = await fetch('http://localhost:3333/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    })

    const dados = await resposta.json()

    if (!resposta.ok) {
      setErro(dados.error || 'Erro ao fazer login')
      return
    }

    localStorage.setItem('token', dados.token)
    navigate('/dashboard')
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark">MHI</span>
          <h1>CRM MHI Fisio</h1>
          <p>Entre com sua conta para continuar</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input-field"
              placeholder="voce@empresa.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="login-field">
            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              className="input-field"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>

          {erro && <p className="login-error">{erro}</p>}

          <button type="submit" className="btn-primary login-submit">
            Entrar
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
