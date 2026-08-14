import { useState, useEffect } from 'react'
import { api } from '../api'
import '../styles/paginaLista.css'

const FORMAS_PAGAMENTO = ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito']
const STATUS_OPCOES = ['pago', 'pendente', 'reembolsado']

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR')
}

function Financeiro() {
  const [pagamentos, setPagamentos] = useState([])
  const [clientes, setClientes] = useState([])
  const [carregando, setCarregando] = useState(true)

  const [clienteId, setClienteId] = useState('')
  const [valor, setValor] = useState('')
  const [formaPagamento, setFormaPagamento] = useState(FORMAS_PAGAMENTO[0])

  async function carregarPagamentos() {
    const dados = await api('/pagamentos')
    setPagamentos(dados)
    setCarregando(false)
  }

  useEffect(() => {
    async function carregarInicial() {
      const [pagamentosData, clientesData] = await Promise.all([api('/pagamentos'), api('/clientes')])
      setPagamentos(pagamentosData)
      setClientes(clientesData)
      setCarregando(false)
    }
    carregarInicial()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    await api('/pagamentos', {
      method: 'POST',
      body: JSON.stringify({ cliente_id: clienteId, valor, forma_pagamento: formaPagamento }),
    })
    setClienteId('')
    setValor('')
    carregarPagamentos()
  }

  async function handleStatusChange(pagamento, novoStatus) {
    await api(`/pagamentos/${pagamento.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: novoStatus }),
    })
    carregarPagamentos()
  }

  const totalRecebido = pagamentos
    .filter((p) => p.status === 'pago')
    .reduce((soma, p) => soma + Number(p.valor), 0)

  if (carregando) {
    return <p>Carregando...</p>
  }

  return (
    <div>
      <div className="page-header">
        <h1>Financeiro</h1>
        <span className="page-count">Total recebido: {formatarMoeda(totalRecebido)}</span>
      </div>

      <div className="page-form-card">
        <form className="page-form" onSubmit={handleSubmit}>
          <div className="page-field">
            <label htmlFor="pagamento-cliente">Cliente</label>
            <select
              id="pagamento-cliente"
              className="input-field"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              required
            >
              <option value="">Selecione...</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="page-field">
            <label htmlFor="pagamento-valor">Valor</label>
            <input
              id="pagamento-valor"
              className="input-field"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              required
            />
          </div>

          <div className="page-field">
            <label htmlFor="pagamento-forma">Forma de pagamento</label>
            <select
              id="pagamento-forma"
              className="input-field"
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
            >
              {FORMAS_PAGAMENTO.map((forma) => (
                <option key={forma} value={forma}>
                  {forma.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn-primary">
            Registrar
          </button>
        </form>
      </div>

      {pagamentos.length === 0 ? (
        <p className="page-empty">Nenhum pagamento registrado ainda.</p>
      ) : (
        <table className="page-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Cliente</th>
              <th>Valor</th>
              <th>Forma</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pagamentos.map((pagamento) => (
              <tr key={pagamento.id}>
                <td>{formatarData(pagamento.data_pagamento)}</td>
                <td>{pagamento.clientes?.nome}</td>
                <td>{formatarMoeda(pagamento.valor)}</td>
                <td>{pagamento.forma_pagamento?.replace('_', ' ') ?? '—'}</td>
                <td>
                  <select
                    className="status-select"
                    value={pagamento.status}
                    onChange={(e) => handleStatusChange(pagamento, e.target.value)}
                  >
                    {STATUS_OPCOES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default Financeiro
