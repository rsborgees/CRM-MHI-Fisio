import { useState, useEffect } from 'react'
import { api } from '../api'
import '../styles/paginaLista.css'
import './Perfil.css'

function Perfil() {
  const [carregando, setCarregando] = useState(true)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [mensagemPerfil, setMensagemPerfil] = useState('')
  const [erroPerfil, setErroPerfil] = useState('')
  const [salvandoPerfil, setSalvandoPerfil] = useState(false)

  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [mensagemSenha, setMensagemSenha] = useState('')
  const [erroSenha, setErroSenha] = useState('')
  const [salvandoSenha, setSalvandoSenha] = useState(false)

  useEffect(() => {
    async function carregar() {
      const dados = await api('/auth/perfil')
      setNome(dados.nome)
      setEmail(dados.email)
      setCarregando(false)
    }
    carregar()
  }, [])

  async function handleSalvarPerfil(e) {
    e.preventDefault()
    setErroPerfil('')
    setMensagemPerfil('')
    setSalvandoPerfil(true)

    try {
      await api('/auth/perfil', { method: 'PUT', body: JSON.stringify({ nome, email }) })
      setMensagemPerfil('Dados atualizados com sucesso.')
    } catch (erro) {
      setErroPerfil(erro.message)
    }

    setSalvandoPerfil(false)
  }

  async function handleAlterarSenha(e) {
    e.preventDefault()
    setErroSenha('')
    setMensagemSenha('')

    if (novaSenha !== confirmarSenha) {
      setErroSenha('A confirmação não bate com a nova senha.')
      return
    }

    setSalvandoSenha(true)
    try {
      await api('/auth/senha', { method: 'PUT', body: JSON.stringify({ senhaAtual, novaSenha }) })
      setMensagemSenha('Senha alterada com sucesso.')
      setSenhaAtual('')
      setNovaSenha('')
      setConfirmarSenha('')
    } catch (erro) {
      setErroSenha(erro.message)
    }
    setSalvandoSenha(false)
  }

  if (carregando) {
    return <p>Carregando...</p>
  }

  return (
    <div>
      <div className="page-header">
        <h1>Meu perfil</h1>
      </div>

      <div className="page-form-card">
        <h2 className="perfil-secao-titulo">Meus dados</h2>
        <form className="page-form" onSubmit={handleSalvarPerfil}>
          <div className="page-field">
            <label htmlFor="perfil-nome">Nome</label>
            <input
              id="perfil-nome"
              className="input-field"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>
          <div className="page-field">
            <label htmlFor="perfil-email">Email</label>
            <input
              id="perfil-email"
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={salvandoPerfil}>
            Salvar dados
          </button>
          <div className="page-field-full">
            {mensagemPerfil && <span className="perfil-mensagem">{mensagemPerfil}</span>}
            {erroPerfil && <span className="perfil-erro">{erroPerfil}</span>}
          </div>
        </form>
      </div>

      <div className="page-form-card">
        <h2 className="perfil-secao-titulo">Alterar senha</h2>
        <form className="page-form" onSubmit={handleAlterarSenha}>
          <div className="page-field">
            <label htmlFor="perfil-senha-atual">Senha atual</label>
            <input
              id="perfil-senha-atual"
              type="password"
              className="input-field"
              autoComplete="current-password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              required
            />
          </div>
          <div className="page-field">
            <label htmlFor="perfil-nova-senha">Nova senha</label>
            <input
              id="perfil-nova-senha"
              type="password"
              className="input-field"
              autoComplete="new-password"
              minLength={6}
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              required
            />
          </div>
          <div className="page-field">
            <label htmlFor="perfil-confirmar-senha">Confirmar nova senha</label>
            <input
              id="perfil-confirmar-senha"
              type="password"
              className="input-field"
              autoComplete="new-password"
              minLength={6}
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={salvandoSenha}>
            Alterar senha
          </button>
          <div className="page-field-full">
            {mensagemSenha && <span className="perfil-mensagem">{mensagemSenha}</span>}
            {erroSenha && <span className="perfil-erro">{erroSenha}</span>}
          </div>
        </form>
      </div>
    </div>
  )
}

export default Perfil
