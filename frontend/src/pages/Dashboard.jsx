import { useState, useEffect } from 'react'
import { api } from '../api'
import './Dashboard.css'

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

function formatarHora(dataHora) {
  return new Date(dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function Dashboard() {
  const [resumo, setResumo] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      const dados = await api('/dashboard')
      setResumo(dados)
      setCarregando(false)
    }
    carregar()
  }, [])

  if (carregando) {
    return <p>Carregando...</p>
  }

  return (
    <div>
      <h1>Dashboard</h1>

      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Agendamentos hoje</span>
          <span className="kpi-value">{resumo.agendamentosHoje.quantidade}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Total de agendamentos</span>
          <span className="kpi-value">{resumo.totalAgendamentos}</span>
        </div>
        <div className="kpi-card kpi-card-destaque">
          <span className="kpi-label">Faturamento do mês</span>
          <span className="kpi-value">{formatarMoeda(resumo.faturamentoMes)}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Clientes ativos</span>
          <span className="kpi-value">{resumo.clientesAtivos}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Total de clientes</span>
          <span className="kpi-value">{resumo.totalClientes}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Novos clientes no mês</span>
          <span className="kpi-value">{resumo.novosClientesMes}</span>
        </div>
      </div>

      <section className="dashboard-section">
        <h2>Agendamentos de hoje</h2>

        {resumo.agendamentosHoje.lista.length === 0 ? (
          <p className="empty-state">Nenhum agendamento para hoje.</p>
        ) : (
          <table className="dashboard-table">
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
              {resumo.agendamentosHoje.lista.map((agendamento) => (
                <tr key={agendamento.id}>
                  <td>{formatarHora(agendamento.data_hora)}</td>
                  <td>{agendamento.clientes?.nome}</td>
                  <td>{agendamento.profissionais?.nome ?? '—'}</td>
                  <td>{agendamento.servicos?.nome ?? '—'}</td>
                  <td>{agendamento.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

export default Dashboard
