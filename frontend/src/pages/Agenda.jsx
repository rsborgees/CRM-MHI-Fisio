import { useState, useEffect } from 'react'
import { api } from '../api'
import '../styles/paginaLista.css'
import './Agenda.css'

const STATUS_OPCOES = ['agendado', 'confirmado', 'concluido', 'cancelado']

function hojeISO() {
  const hoje = new Date()
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  const dia = String(hoje.getDate()).padStart(2, '0')
  return `${hoje.getFullYear()}-${mes}-${dia}`
}

function formatarHora(dataHora) {
  return new Date(dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function Agenda() {
  const [data, setData] = useState(hojeISO())
  const [agendamentos, setAgendamentos] = useState([])
  const [clientes, setClientes] = useState([])
  const [profissionais, setProfissionais] = useState([])
  const [servicos, setServicos] = useState([])
  const [carregando, setCarregando] = useState(true)

  const [clienteId, setClienteId] = useState('')
  const [profissionalId, setProfissionalId] = useState('')
  const [servicoId, setServicoId] = useState('')
  const [hora, setHora] = useState('')

  useEffect(() => {
    async function carregarListasApoio() {
      const [clientesData, profissionaisData, servicosData] = await Promise.all([
        api('/clientes'),
        api('/profissionais'),
        api('/servicos'),
      ])
      setClientes(clientesData)
      setProfissionais(profissionaisData)
      setServicos(servicosData)
    }
    carregarListasApoio()
  }, [])

  async function carregarAgendamentos() {
    setCarregando(true)
    const dados = await api(`/agendamentos?data=${data}`)
    setAgendamentos(dados)
    setCarregando(false)
  }

  useEffect(() => {
    carregarAgendamentos()
  }, [data])

  async function handleSubmit(e) {
    e.preventDefault()
    await api('/agendamentos', {
      method: 'POST',
      body: JSON.stringify({
        cliente_id: clienteId,
        profissional_id: profissionalId || undefined,
        servico_id: servicoId || undefined,
        data_hora: `${data}T${hora}:00`,
      }),
    })
    setClienteId('')
    setProfissionalId('')
    setServicoId('')
    setHora('')
    carregarAgendamentos()
  }

  async function handleStatusChange(agendamento, novoStatus) {
    await api(`/agendamentos/${agendamento.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: novoStatus }),
    })
    carregarAgendamentos()
  }

  return (
    <div>
      <div className="page-header">
        <h1>Agenda</h1>
        <input
          type="date"
          className="input-field agenda-date-picker"
          value={data}
          onChange={(e) => setData(e.target.value)}
        />
      </div>

      <div className="page-form-card">
        <form className="page-form" onSubmit={handleSubmit}>
          <div className="page-field">
            <label htmlFor="agenda-cliente">Cliente</label>
            <select
              id="agenda-cliente"
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
            <label htmlFor="agenda-profissional">Profissional</label>
            <select
              id="agenda-profissional"
              className="input-field"
              value={profissionalId}
              onChange={(e) => setProfissionalId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {profissionais.map((profissional) => (
                <option key={profissional.id} value={profissional.id}>
                  {profissional.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="page-field">
            <label htmlFor="agenda-servico">Serviço</label>
            <select
              id="agenda-servico"
              className="input-field"
              value={servicoId}
              onChange={(e) => setServicoId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {servicos.map((servico) => (
                <option key={servico.id} value={servico.id}>
                  {servico.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="page-field">
            <label htmlFor="agenda-hora">Horário</label>
            <input
              id="agenda-hora"
              type="time"
              className="input-field"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary">
            Agendar
          </button>
        </form>
      </div>

      {carregando ? (
        <p>Carregando...</p>
      ) : agendamentos.length === 0 ? (
        <p className="page-empty">Nenhum agendamento nesse dia.</p>
      ) : (
        <table className="page-table">
          <thead>
            <tr>
              <th>Horário</th>
              <th>Cliente</th>
              <th>Profissional</th>
              <th>Serviço</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {agendamentos.map((agendamento) => (
              <tr key={agendamento.id}>
                <td>{formatarHora(agendamento.data_hora)}</td>
                <td>{agendamento.clientes?.nome}</td>
                <td>{agendamento.profissionais?.nome ?? '—'}</td>
                <td>{agendamento.servicos?.nome ?? '—'}</td>
                <td>
                  <select
                    className="status-select"
                    value={agendamento.status}
                    onChange={(e) => handleStatusChange(agendamento, e.target.value)}
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

export default Agenda
