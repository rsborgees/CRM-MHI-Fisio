import { useState, useEffect } from 'react'
import { api } from '../api'
import { IconEditar, IconExcluir } from '../components/icons'
import '../styles/paginaLista.css'

const PAPEIS = [
  { value: 'administrador', label: 'Administrador' },
  { value: 'desenvolvedor', label: 'Desenvolvedor' },
  { value: 'usuario', label: 'Usuário' },
]

function rotuloPapel(papel) {
  return PAPEIS.find((p) => p.value === papel)?.label ?? papel
}

function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [papel, setPapel] = useState('usuario')
  const [editandoId, setEditandoId] = useState(null)

  async function carregarUsuarios() {
    const dados = await api('/usuarios')
    setUsuarios(dados)
    setCarregando(false)
  }

  useEffect(() => {
    carregarUsuarios()
  }, [])

  function limparFormulario() {
    setNome('')
    setEmail('')
    setSenha('')
    setPapel('usuario')
    setEditandoId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (editandoId) {
      await api(`/usuarios/${editandoId}`, {
        method: 'PUT',
        body: JSON.stringify({ nome, email, papel }),
      })
    } else {
      await api('/usuarios', {
        method: 'POST',
        body: JSON.stringify({ nome, email, senha, papel }),
      })
    }

    limparFormulario()
    carregarUsuarios()
  }

  function handleEditar(usuario) {
    setEditandoId(usuario.id)
    setNome(usuario.nome)
    setEmail(usuario.email)
    setPapel(usuario.papel)
    setSenha('')
  }

  async function handleExcluir(usuario) {
    if (!confirm(`Excluir o usuário "${usuario.nome}"?`)) return
    await api(`/usuarios/${usuario.id}`, { method: 'DELETE' })
    if (editandoId === usuario.id) limparFormulario()
    carregarUsuarios()
  }

  async function handleAlternarAtivo(usuario) {
    await api(`/usuarios/${usuario.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ativo: !usuario.ativo }),
    })
    carregarUsuarios()
  }

  if (carregando) {
    return <p>Carregando...</p>
  }

  return (
    <div>
      <div className="page-header">
        <h1>Usuários</h1>
        <span className="page-count">{usuarios.length} cadastrados</span>
      </div>

      <div className="page-form-card">
        <form className="page-form" onSubmit={handleSubmit}>
          <div className="page-field">
            <label htmlFor="usuario-nome">Nome</label>
            <input
              id="usuario-nome"
              className="input-field"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          <div className="page-field">
            <label htmlFor="usuario-email">Email</label>
            <input
              id="usuario-email"
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {!editandoId && (
            <div className="page-field">
              <label htmlFor="usuario-senha">Senha</label>
              <input
                id="usuario-senha"
                type="password"
                className="input-field"
                autoComplete="new-password"
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>
          )}

          <div className="page-field">
            <label htmlFor="usuario-papel">Papel</label>
            <select id="usuario-papel" className="input-field" value={papel} onChange={(e) => setPapel(e.target.value)}>
              {PAPEIS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn-primary">
            {editandoId ? 'Salvar alterações' : 'Adicionar usuário'}
          </button>
          {editandoId && (
            <button type="button" className="btn-secondary page-form-cancelar" onClick={limparFormulario}>
              Cancelar
            </button>
          )}
        </form>
      </div>

      {usuarios.length === 0 ? (
        <p className="page-empty">Nenhum usuário cadastrado ainda.</p>
      ) : (
        <table className="page-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Papel</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id}>
                <td>{usuario.nome}</td>
                <td>{usuario.email}</td>
                <td>{rotuloPapel(usuario.papel)}</td>
                <td>
                  <button type="button" className="btn-secondary" onClick={() => handleAlternarAtivo(usuario)}>
                    {usuario.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
                <td>
                  <div className="tabela-acoes">
                    <button
                      type="button"
                      className="btn-secondary"
                      aria-label="Editar usuário"
                      title="Editar"
                      onClick={() => handleEditar(usuario)}
                    >
                      <IconEditar />
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      aria-label="Excluir usuário"
                      title="Excluir"
                      onClick={() => handleExcluir(usuario)}
                    >
                      <IconExcluir />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default Usuarios
