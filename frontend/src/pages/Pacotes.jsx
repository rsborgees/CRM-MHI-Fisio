import { useState, useEffect } from 'react'
import { api } from '../api'
import { IconEditar, IconExcluir } from '../components/icons'
import '../styles/paginaLista.css'

function formatarMoeda(valor) {
  if (valor === null || valor === undefined) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function Pacotes() {
  const [pacotes, setPacotes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [nome, setNome] = useState('')
  const [preco, setPreco] = useState('')
  const [validadeDias, setValidadeDias] = useState('')
  const [editandoId, setEditandoId] = useState(null)

  async function carregarPacotes() {
    const dados = await api('/pacotes')
    setPacotes(dados)
    setCarregando(false)
  }

  useEffect(() => {
    carregarPacotes()
  }, [])

  function limparFormulario() {
    setNome('')
    setPreco('')
    setValidadeDias('')
    setEditandoId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const dados = { nome, preco, validade_dias: validadeDias }

    if (editandoId) {
      await api(`/pacotes/${editandoId}`, { method: 'PUT', body: JSON.stringify(dados) })
    } else {
      await api('/pacotes', { method: 'POST', body: JSON.stringify(dados) })
    }

    limparFormulario()
    carregarPacotes()
  }

  function handleEditar(pacote) {
    setEditandoId(pacote.id)
    setNome(pacote.nome)
    setPreco(pacote.preco ?? '')
    setValidadeDias(pacote.validade_dias ?? '')
  }

  async function handleExcluir(pacote) {
    if (!confirm(`Excluir o pacote "${pacote.nome}"?`)) return
    await api(`/pacotes/${pacote.id}`, { method: 'DELETE' })
    carregarPacotes()
  }

  if (carregando) {
    return <p>Carregando...</p>
  }

  return (
    <div>
      <div className="page-header">
        <h1>Pacotes</h1>
        <span className="page-count">{pacotes.length} cadastrados</span>
      </div>

      <div className="page-form-card">
        <form className="page-form" onSubmit={handleSubmit}>
          <div className="page-field">
            <label htmlFor="pacote-nome">Nome</label>
            <input
              id="pacote-nome"
              className="input-field"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>
          <div className="page-field">
            <label htmlFor="pacote-preco">Preço</label>
            <input
              id="pacote-preco"
              className="input-field"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
            />
          </div>
          <div className="page-field">
            <label htmlFor="pacote-validade">Validade (dias)</label>
            <input
              id="pacote-validade"
              className="input-field"
              value={validadeDias}
              onChange={(e) => setValidadeDias(e.target.value)}
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

      {pacotes.length === 0 ? (
        <p className="page-empty">Nenhum pacote cadastrado ainda.</p>
      ) : (
        <table className="page-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Preço</th>
              <th>Validade</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {pacotes.map((pacote) => (
              <tr key={pacote.id}>
                <td>{pacote.nome}</td>
                <td>{formatarMoeda(pacote.preco)}</td>
                <td>{pacote.validade_dias ? `${pacote.validade_dias} dias` : '—'}</td>
                <td>{pacote.ativo ? 'Ativo' : 'Inativo'}</td>
                <td>
                  <div className="tabela-acoes">
                    <button
                      type="button"
                      className="btn-secondary"
                      aria-label="Editar pacote"
                      title="Editar"
                      onClick={() => handleEditar(pacote)}
                    >
                      <IconEditar />
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      aria-label="Excluir pacote"
                      title="Excluir"
                      onClick={() => handleExcluir(pacote)}
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

export default Pacotes
