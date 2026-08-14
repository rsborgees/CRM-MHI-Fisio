import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api'
import '../styles/paginaLista.css'
import '../styles/chat.css'
import './ClientePerfil.css'

function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR')
}

function formatarDataHora(data) {
  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ClientePerfil() {
  const { id } = useParams()
  const [cliente, setCliente] = useState(null)
  const [agendamentos, setAgendamentos] = useState([])
  const [historico, setHistorico] = useState([])
  const [avaliacoes, setAvaliacoes] = useState([])
  const [conversaWhatsapp, setConversaWhatsapp] = useState([])
  const [carregando, setCarregando] = useState(true)

  const [tipoHistorico, setTipoHistorico] = useState('')
  const [descricaoHistorico, setDescricaoHistorico] = useState('')

  async function carregarHistorico() {
    const dados = await api(`/historico?cliente_id=${id}`)
    setHistorico(dados)
  }

  useEffect(() => {
    async function carregarTudo() {
      const [clienteData, agendamentosData, historicoData, avaliacoesData, conversaData] = await Promise.all([
        api(`/clientes/${id}`),
        api(`/agendamentos?cliente_id=${id}`),
        api(`/historico?cliente_id=${id}`),
        api(`/avaliacoes?cliente_id=${id}`),
        api(`/conversas-whatsapp/${id}`),
      ])
      setCliente(clienteData)
      setAgendamentos(agendamentosData)
      setHistorico(historicoData)
      setAvaliacoes(avaliacoesData)
      setConversaWhatsapp(conversaData.mensagens)
      setCarregando(false)
    }
    carregarTudo()
  }, [id])

  async function handleAdicionarHistorico(e) {
    e.preventDefault()
    await api('/historico', {
      method: 'POST',
      body: JSON.stringify({ cliente_id: id, tipo: tipoHistorico, descricao: descricaoHistorico }),
    })
    setTipoHistorico('')
    setDescricaoHistorico('')
    carregarHistorico()
  }

  if (carregando) {
    return <p>Carregando...</p>
  }

  return (
    <div>
      <Link to="/clientes" className="voltar-link">
        ← Voltar para Clientes
      </Link>

      <div className="perfil-header">
        <h1>{cliente.nome}</h1>
        <span className={`status-badge status-badge-${cliente.status}`}>
          {cliente.status?.replace('_', ' ')}
        </span>
      </div>

      <div className="perfil-dados">
        <span>{cliente.email ?? 'sem email'}</span>
        <span>{cliente.celular ?? cliente.telefone ?? 'sem telefone'}</span>
        <span>Cliente desde {formatarData(cliente.data_cadastro)}</span>
      </div>

      <section className="perfil-secao">
        <h2>Agendamentos</h2>
        {agendamentos.length === 0 ? (
          <p className="page-empty">Nenhum agendamento registrado.</p>
        ) : (
          <table className="page-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Serviço</th>
                <th>Profissional</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {agendamentos.map((agendamento) => (
                <tr key={agendamento.id}>
                  <td>{formatarDataHora(agendamento.data_hora)}</td>
                  <td>{agendamento.servicos?.nome ?? '—'}</td>
                  <td>{agendamento.profissionais?.nome ?? '—'}</td>
                  <td>{agendamento.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="perfil-secao">
        <h2>Avaliações</h2>
        {avaliacoes.length === 0 ? (
          <p className="page-empty">Nenhuma avaliação registrada.</p>
        ) : (
          <table className="page-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Peso</th>
                <th>Altura</th>
                <th>IMC</th>
              </tr>
            </thead>
            <tbody>
              {avaliacoes.map((avaliacao) => (
                <tr key={avaliacao.id}>
                  <td>{formatarData(avaliacao.data)}</td>
                  <td>{avaliacao.peso ? `${avaliacao.peso} kg` : '—'}</td>
                  <td>{avaliacao.altura ? `${avaliacao.altura} m` : '—'}</td>
                  <td>{avaliacao.imc ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="perfil-secao">
        <h2>Conversa com o agente de IA (WhatsApp)</h2>
        {conversaWhatsapp.length === 0 ? (
          <p className="page-empty">Nenhuma conversa registrada ainda.</p>
        ) : (
          <div className="chat-whatsapp">
            {conversaWhatsapp.map((mensagem, indice) => (
              <div
                key={indice}
                className={`chat-bolha chat-bolha-${mensagem.papel === 'assistente' ? 'assistente' : 'cliente'}`}
              >
                {mensagem.conteudo}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="perfil-secao">
        <h2>Histórico</h2>

        <form className="perfil-historico-form" onSubmit={handleAdicionarHistorico}>
          <input
            className="input-field"
            placeholder="Tipo (ex: contato, observação)"
            value={tipoHistorico}
            onChange={(e) => setTipoHistorico(e.target.value)}
          />
          <input
            className="input-field"
            placeholder="Descrição"
            value={descricaoHistorico}
            onChange={(e) => setDescricaoHistorico(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary">
            Adicionar
          </button>
        </form>

        {historico.length === 0 ? (
          <p className="page-empty">Nenhum registro de histórico ainda.</p>
        ) : (
          <ul className="perfil-timeline">
            {historico.map((registro) => (
              <li key={registro.id}>
                <span className="perfil-timeline-data">{formatarDataHora(registro.data)}</span>
                <span className="perfil-timeline-tipo">{registro.tipo}</span>
                <p>{registro.descricao}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default ClientePerfil
