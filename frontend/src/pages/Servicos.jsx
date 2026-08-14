import { useState, useEffect } from 'react'
import { api } from '../api'
import { IconEditar, IconExcluir } from '../components/icons'
import '../styles/paginaLista.css'

function formatarMoeda(valor) {
  if (valor === null || valor === undefined) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function Servicos() {
  const [servicos, setServicos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [preco, setPreco] = useState('')
  const [duracaoMinutos, setDuracaoMinutos] = useState('')
  const [editandoId, setEditandoId] = useState(null)

  async function carregarServicos() {
    const dados = await api('/servicos')
    setServicos(dados)
    setCarregando(false)
  }

  useEffect(() => {
    carregarServicos()
  }, [])

  function limparFormulario() {
    setNome('')
    setDescricao('')
    setPreco('')
    setDuracaoMinutos('')
    setEditandoId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const dados = { nome, descricao, preco, duracao_minutos: duracaoMinutos }

    if (editandoId) {
      await api(`/servicos/${editandoId}`, { method: 'PUT', body: JSON.stringify(dados) })
    } else {
      await api('/servicos', { method: 'POST', body: JSON.stringify(dados) })
    }

    limparFormulario()
    carregarServicos()
  }

  function handleEditar(servico) {
    setEditandoId(servico.id)
    setNome(servico.nome)
    setDescricao(servico.descricao ?? '')
    setPreco(servico.preco ?? '')
    setDuracaoMinutos(servico.duracao_minutos ?? '')
  }

  async function handleExcluir(servico) {
    if (!confirm(`Excluir o serviço "${servico.nome}"?`)) return
    await api(`/servicos/${servico.id}`, { method: 'DELETE' })
    carregarServicos()
  }

  if (carregando) {
    return <p>Carregando...</p>
  }

  return (
    <div>
      <div className="page-header">
        <h1>Serviços</h1>
        <span className="page-count">{servicos.length} cadastrados</span>
      </div>

      <div className="page-form-card">
        <form className="page-form" onSubmit={handleSubmit}>
          <div className="page-field">
            <label htmlFor="servico-nome">Nome</label>
            <input
              id="servico-nome"
              className="input-field"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>
          <div className="page-field">
            <label htmlFor="servico-preco">Preço</label>
            <input
              id="servico-preco"
              className="input-field"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
            />
          </div>
          <div className="page-field">
            <label htmlFor="servico-duracao">Duração (min)</label>
            <input
              id="servico-duracao"
              className="input-field"
              value={duracaoMinutos}
              onChange={(e) => setDuracaoMinutos(e.target.value)}
            />
          </div>
          <div className="page-field page-field-full">
            <label htmlFor="servico-descricao">Descrição</label>
            <textarea
              id="servico-descricao"
              className="input-field"
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
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

      {servicos.length === 0 ? (
        <p className="page-empty">Nenhum serviço cadastrado ainda.</p>
      ) : (
        <table className="page-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Descrição</th>
              <th>Preço</th>
              <th>Duração</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {servicos.map((servico) => (
              <tr key={servico.id}>
                <td>{servico.nome}</td>
                <td>{servico.descricao ?? '—'}</td>
                <td>{formatarMoeda(servico.preco)}</td>
                <td>{servico.duracao_minutos ? `${servico.duracao_minutos} min` : '—'}</td>
                <td>{servico.ativo ? 'Ativo' : 'Inativo'}</td>
                <td>
                  <div className="tabela-acoes">
                    <button
                      type="button"
                      className="btn-secondary"
                      aria-label="Editar serviço"
                      title="Editar"
                      onClick={() => handleEditar(servico)}
                    >
                      <IconEditar />
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      aria-label="Excluir serviço"
                      title="Excluir"
                      onClick={() => handleExcluir(servico)}
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

export default Servicos
