import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { IconEditar, IconExcluir } from '../components/icons'
import '../styles/paginaLista.css'

function Clientes() {
  const [clientes, setClientes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [nome, setNome] = useState('')
  const [celular, setCelular] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [email, setEmail] = useState('')
  const [endereco, setEndereco] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [cep, setCep] = useState('')
  const [editandoId, setEditandoId] = useState(null)

  async function carregarClientes() {
    const dados = await api('/clientes')
    setClientes(dados)
    setCarregando(false)
  }

  useEffect(() => {
    carregarClientes()
  }, [])

  function limparFormulario() {
    setNome('')
    setCelular('')
    setCpfCnpj('')
    setDataNascimento('')
    setEmail('')
    setEndereco('')
    setCidade('')
    setEstado('')
    setCep('')
    setEditandoId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const dados = {
      nome,
      celular,
      cpf_cnpj: cpfCnpj,
      data_nascimento: dataNascimento || undefined,
      email,
      endereco,
      cidade,
      estado,
      cep,
    }

    if (editandoId) {
      await api(`/clientes/${editandoId}`, { method: 'PUT', body: JSON.stringify(dados) })
    } else {
      await api('/clientes', { method: 'POST', body: JSON.stringify(dados) })
    }

    limparFormulario()
    carregarClientes()
  }

  function handleEditar(cliente) {
    setEditandoId(cliente.id)
    setNome(cliente.nome)
    setCelular(cliente.celular ?? '')
    setCpfCnpj(cliente.cpf_cnpj ?? '')
    setDataNascimento(cliente.data_nascimento ? cliente.data_nascimento.slice(0, 10) : '')
    setEmail(cliente.email ?? '')
    setEndereco(cliente.endereco ?? '')
    setCidade(cliente.cidade ?? '')
    setEstado(cliente.estado ?? '')
    setCep(cliente.cep ?? '')
  }

  async function handleExcluir(cliente) {
    if (!confirm(`Excluir o cliente "${cliente.nome}"?`)) return
    await api(`/clientes/${cliente.id}`, { method: 'DELETE' })
    carregarClientes()
  }

  if (carregando) {
    return <p>Carregando...</p>
  }

  return (
    <div>
      <div className="page-header">
        <h1>Clientes</h1>
        <span className="page-count">{clientes.length} cadastrados</span>
      </div>

      <div className="page-form-card">
        <form className="page-form" onSubmit={handleSubmit}>
          <div className="page-field">
            <label htmlFor="cliente-nome">Nome</label>
            <input
              id="cliente-nome"
              className="input-field"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>
          <div className="page-field">
            <label htmlFor="cliente-celular">Celular (WhatsApp)</label>
            <input
              id="cliente-celular"
              type="tel"
              className="input-field"
              placeholder="5511999999999"
              value={celular}
              onChange={(e) => setCelular(e.target.value)}
            />
          </div>
          <div className="page-field">
            <label htmlFor="cliente-email">Email</label>
            <input
              id="cliente-email"
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="page-field">
            <label htmlFor="cliente-cpf">CPF/CNPJ</label>
            <input
              id="cliente-cpf"
              className="input-field"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value)}
            />
          </div>
          <div className="page-field">
            <label htmlFor="cliente-nascimento">Data de nascimento</label>
            <input
              id="cliente-nascimento"
              type="date"
              className="input-field"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
            />
          </div>
          <div className="page-field page-field-full">
            <label htmlFor="cliente-endereco">Endereço</label>
            <input
              id="cliente-endereco"
              className="input-field"
              placeholder="Rua, número, complemento e bairro"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
            />
          </div>
          <div className="page-field">
            <label htmlFor="cliente-cidade">Cidade</label>
            <input
              id="cliente-cidade"
              className="input-field"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
            />
          </div>
          <div className="page-field">
            <label htmlFor="cliente-estado">Estado</label>
            <input
              id="cliente-estado"
              className="input-field"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            />
          </div>
          <div className="page-field">
            <label htmlFor="cliente-cep">CEP</label>
            <input id="cliente-cep" className="input-field" value={cep} onChange={(e) => setCep(e.target.value)} />
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

      {clientes.length === 0 ? (
        <p className="page-empty">Nenhum cliente cadastrado ainda.</p>
      ) : (
        <table className="page-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Celular</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((cliente) => (
              <tr key={cliente.id}>
                <td>
                  <Link to={`/clientes/${cliente.id}`} className="tabela-link">
                    {cliente.nome}
                  </Link>
                </td>
                <td>{cliente.celular ?? cliente.telefone ?? '—'}</td>
                <td>
                  <span className={`status-badge status-badge-${cliente.status}`}>
                    {cliente.status?.replace('_', ' ')}
                  </span>
                </td>
                <td>
                  <div className="tabela-acoes">
                    <button
                      type="button"
                      className="btn-secondary"
                      aria-label="Editar cliente"
                      title="Editar"
                      onClick={() => handleEditar(cliente)}
                    >
                      <IconEditar />
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      aria-label="Excluir cliente"
                      title="Excluir"
                      onClick={() => handleExcluir(cliente)}
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

export default Clientes
