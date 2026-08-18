import { useState, useEffect } from 'react'
import { api } from '../api'
import { IconEditar, IconExcluir } from '../components/icons'
import '../styles/paginaLista.css'

function Profissionais() {
  const [profissionais, setProfissionais] = useState([])
  const [servicos, setServicos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [nome, setNome] = useState('')
  const [especialidade, setEspecialidade] = useState('')
  const [servicoIds, setServicoIds] = useState([])
  const [editandoId, setEditandoId] = useState(null)

  async function carregarProfissionais() {
    const dados = await api('/profissionais')
    setProfissionais(dados)
    setCarregando(false)
  }

  useEffect(() => {
    carregarProfissionais()
    api('/servicos').then(setServicos)
  }, [])

  function limparFormulario() {
    setNome('')
    setEspecialidade('')
    setServicoIds([])
    setEditandoId(null)
  }

  function alternarServico(servicoId) {
    setServicoIds((atual) =>
      atual.includes(servicoId) ? atual.filter((id) => id !== servicoId) : [...atual, servicoId],
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const corpo = JSON.stringify({ nome, especialidade, servico_ids: servicoIds })

    if (editandoId) {
      await api(`/profissionais/${editandoId}`, { method: 'PUT', body: corpo })
    } else {
      await api('/profissionais', { method: 'POST', body: corpo })
    }

    limparFormulario()
    carregarProfissionais()
  }

  function handleEditar(profissional) {
    setEditandoId(profissional.id)
    setNome(profissional.nome)
    setEspecialidade(profissional.especialidade ?? '')
    setServicoIds((profissional.servicosAtendidos ?? []).map((servico) => servico.id))
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

          <div className="page-field profissional-servicos-field">
            <label>Serviços atendidos</label>
            <div className="profissional-servicos-lista">
              {servicos.length === 0 ? (
                <span className="page-empty">Nenhum serviço cadastrado ainda.</span>
              ) : (
                servicos.map((servico) => (
                  <label key={servico.id} className="profissional-servico-item">
                    <input
                      type="checkbox"
                      checked={servicoIds.includes(servico.id)}
                      onChange={() => alternarServico(servico.id)}
                    />
                    {servico.nome}
                  </label>
                ))
              )}
            </div>
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
              <th>Serviços</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {profissionais.map((profissional) => (
              <tr key={profissional.id}>
                <td>{profissional.nome}</td>
                <td>{profissional.especialidade ?? '—'}</td>
                <td>
                  {profissional.servicosAtendidos?.length > 0
                    ? profissional.servicosAtendidos.map((servico) => servico.nome).join(', ')
                    : '—'}
                </td>
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
