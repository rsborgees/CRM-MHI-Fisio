import { useState, useEffect } from 'react'
import { api } from '../api'
import { IconEditar, IconExcluir } from '../components/icons'
import '../styles/paginaLista.css'

function Profissionais() {
  const [profissionais, setProfissionais] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [nome, setNome] = useState('')
  const [especialidade, setEspecialidade] = useState('')
  const [editandoId, setEditandoId] = useState(null)

  async function carregarProfissionais() {
    const dados = await api('/profissionais')
    setProfissionais(dados)
    setCarregando(false)
  }

  useEffect(() => {
    carregarProfissionais()
  }, [])

  function limparFormulario() {
    setNome('')
    setEspecialidade('')
    setEditandoId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (editandoId) {
      await api(`/profissionais/${editandoId}`, {
        method: 'PUT',
        body: JSON.stringify({ nome, especialidade }),
      })
    } else {
      await api('/profissionais', {
        method: 'POST',
        body: JSON.stringify({ nome, especialidade }),
      })
    }

    limparFormulario()
    carregarProfissionais()
  }

  function handleEditar(profissional) {
    setEditandoId(profissional.id)
    setNome(profissional.nome)
    setEspecialidade(profissional.especialidade ?? '')
  }

  async function handleExcluir(profissional) {
    if (!confirm(`Excluir o profissional "${profissional.nome}"?`)) return
    await api(`/profissionais/${profissional.id}`, { method: 'DELETE' })
    carregarProfissionais()
  }

  if (carregando) {
    return <p>Carregando...</p>
  }

  return (
    <div>
      <div className="page-header">
        <h1>Profissionais</h1>
        <span className="page-count">{profissionais.length} cadastrados</span>
      </div>

      <div className="page-form-card">
        <form className="page-form" onSubmit={handleSubmit}>
          <div className="page-field">
            <label htmlFor="profissional-nome">Nome</label>
            <input
              id="profissional-nome"
              className="input-field"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>
          <div className="page-field">
            <label htmlFor="profissional-especialidade">Especialidade</label>
            <input
              id="profissional-especialidade"
              className="input-field"
              value={especialidade}
              onChange={(e) => setEspecialidade(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary">
            {editandoId ? 'Salvar alterações' : 'Cadastrar'}
          </button>
          {editandoId && (
            <button type="button" className="btn-secondary page-form-cancelar" onClick={limparFormulario}>
              Cancelar
            </button>
          )}
        </form>
      </div>

      {profissionais.length === 0 ? (
        <p className="page-empty">Nenhum profissional cadastrado ainda.</p>
      ) : (
        <table className="page-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Especialidade</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {profissionais.map((profissional) => (
              <tr key={profissional.id}>
                <td>{profissional.nome}</td>
                <td>{profissional.especialidade ?? '—'}</td>
                <td>{profissional.ativo ? 'Ativo' : 'Inativo'}</td>
                <td>
                  <div className="tabela-acoes">
                    <button
                      type="button"
                      className="btn-secondary"
                      aria-label="Editar profissional"
                      title="Editar"
                      onClick={() => handleEditar(profissional)}
                    >
                      <IconEditar />
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      aria-label="Excluir profissional"
                      title="Excluir"
                      onClick={() => handleExcluir(profissional)}
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

export default Profissionais
