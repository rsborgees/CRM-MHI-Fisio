import { useState, useEffect } from 'react'
import { api } from '../api'
import { IconEditar, IconExcluir } from '../components/icons'
import '../styles/paginaLista.css'
import './Agenda.css'

const STATUS_OPCOES = ['agendado', 'confirmado', 'concluido', 'cancelado']
const NOMES_DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

function paraISO(data) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function segundaDaSemana(data) {
  const resultado = new Date(data)
  // getDay() dá 0 pra domingo, 1 pra segunda... aqui a gente calcula quantos dias
  // voltar até cair numa segunda-feira.
  const diaDaSemana = resultado.getDay()
  const deslocamento = diaDaSemana === 0 ? -6 : 1 - diaDaSemana
  resultado.setDate(resultado.getDate() + deslocamento)
  return resultado
}

function diasDaSemana(segunda) {
  return Array.from({ length: 7 }, (_, indice) => {
    const dia = new Date(segunda)
    dia.setDate(dia.getDate() + indice)
    return dia
  })
}

function formatarHora(dataHora) {
  return new Date(dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatarDataCurta(data) {
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function formatarIntervaloSemana(dias) {
  const inicio = dias[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
  const fim = dias[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
  return `${inicio} a ${fim}`
}

function Agenda() {
  const [segunda, setSegunda] = useState(() => segundaDaSemana(new Date()))
  const [agendamentos, setAgendamentos] = useState([])
  const [clientes, setClientes] = useState([])
  const [profissionais, setProfissionais] = useState([])
  const [servicos, setServicos] = useState([])
  const [carregando, setCarregando] = useState(true)

  const [dataForm, setDataForm] = useState(paraISO(new Date()))
  const [clienteId, setClienteId] = useState('')
  const [profissionalId, setProfissionalId] = useState('')
  const [servicoId, setServicoId] = useState('')
  const [hora, setHora] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [erro, setErro] = useState('')

  const semana = diasDaSemana(segunda)

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
    const dataInicio = paraISO(semana[0])
    const dataFim = paraISO(semana[6])
    const dados = await api(`/agendamentos?data_inicio=${dataInicio}&data_fim=${dataFim}`)
    setAgendamentos(dados)
    setCarregando(false)
  }

  useEffect(() => {
    carregarAgendamentos()
  }, [segunda])

  function irParaSemanaAnterior() {
    const nova = new Date(segunda)
    nova.setDate(nova.getDate() - 7)
    setSegunda(nova)
  }

  function irParaProximaSemana() {
    const nova = new Date(segunda)
    nova.setDate(nova.getDate() + 7)
    setSegunda(nova)
  }

  function agendamentosDoDia(dia) {
    const diaISO = paraISO(dia)
    return agendamentos
      .filter((agendamento) => agendamento.data_hora.startsWith(diaISO))
      .sort((a, b) => a.data_hora.localeCompare(b.data_hora))
  }

  function limparFormulario() {
    setClienteId('')
    setProfissionalId('')
    setServicoId('')
    setHora('')
    setEditandoId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')

    const corpo = JSON.stringify({
      cliente_id: clienteId,
      profissional_id: profissionalId || undefined,
      servico_id: servicoId || undefined,
      data_hora: `${dataForm}T${hora}:00`,
    })

    try {
      if (editandoId) {
        await api(`/agendamentos/${editandoId}`, { method: 'PUT', body: corpo })
      } else {
        await api('/agendamentos', { method: 'POST', body: corpo })
      }

      limparFormulario()
      carregarAgendamentos()
    } catch (erro) {
      setErro(erro.message)
    }
  }

  function handleEditar(agendamento) {
    const dataHora = new Date(agendamento.data_hora)
    setEditandoId(agendamento.id)
    setDataForm(paraISO(dataHora))
    setHora(formatarHora(dataHora))
    setClienteId(agendamento.cliente_id ?? '')
    setProfissionalId(agendamento.profissional_id ?? '')
    setServicoId(agendamento.servico_id ?? '')
  }

  async function handleExcluir(agendamento) {
    const descricao = agendamento.servicos?.nome ?? 'este agendamento'
    if (!confirm(`Apagar ${descricao} de ${agendamento.clientes?.nome}?`)) return
    await api(`/agendamentos/${agendamento.id}`, { method: 'DELETE' })
    if (editandoId === agendamento.id) limparFormulario()
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
        <div className="agenda-navegacao-semana">
          <button type="button" className="btn-secondary" onClick={irParaSemanaAnterior}>
            ← Semana anterior
          </button>
          <span className="agenda-intervalo-semana">{formatarIntervaloSemana(semana)}</span>
          <button type="button" className="btn-secondary" onClick={irParaProximaSemana}>
            Próxima semana →
          </button>
        </div>
      </div>

      <div className="page-form-card">
        <form className="page-form" onSubmit={handleSubmit}>
          <div className="page-field">
            <label htmlFor="agenda-data">Data</label>
            <input
              id="agenda-data"
              type="date"
              className="input-field"
              value={dataForm}
              onChange={(e) => setDataForm(e.target.value)}
              required
            />
          </div>

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
            {editandoId ? 'Salvar alterações' : 'Agendar'}
          </button>
          {editandoId && (
            <button type="button" className="btn-secondary page-form-cancelar" onClick={limparFormulario}>
              Cancelar
            </button>
          )}
          {erro && <p className="page-form-erro">{erro}</p>}
        </form>
      </div>

      {carregando ? (
        <p>Carregando...</p>
      ) : (
        <div className="agenda-quadro-semana">
          {semana.map((dia, indice) => (
            <div key={paraISO(dia)} className="agenda-coluna-dia">
              <div className="agenda-coluna-cabecalho">
                <span className="agenda-coluna-nome-dia">{NOMES_DIAS[indice]}</span>
                <span className="agenda-coluna-data">{formatarDataCurta(dia)}</span>
              </div>

              {agendamentosDoDia(dia).length === 0 ? (
                <p className="agenda-coluna-vazia">Sem agendamentos</p>
              ) : (
                agendamentosDoDia(dia).map((agendamento) => (
                  <div key={agendamento.id} className="agenda-cartao">
                    <span className="agenda-cartao-hora">{formatarHora(agendamento.data_hora)}</span>
                    <span className="agenda-cartao-cliente">{agendamento.clientes?.nome}</span>
                    <span className="agenda-cartao-servico">{agendamento.servicos?.nome ?? '—'}</span>
                    <span className="agenda-cartao-profissional">
                      {agendamento.profissionais?.nome ?? 'Sem profissional'}
                    </span>
                    <select
                      className="status-select agenda-cartao-status"
                      value={agendamento.status}
                      onChange={(e) => handleStatusChange(agendamento, e.target.value)}
                    >
                      {STATUS_OPCOES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <div className="tabela-acoes agenda-cartao-acoes">
                      <button
                        type="button"
                        className="btn-secondary"
                        aria-label="Editar agendamento"
                        title="Editar"
                        onClick={() => handleEditar(agendamento)}
                      >
                        <IconEditar />
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        aria-label="Apagar agendamento"
                        title="Apagar"
                        onClick={() => handleExcluir(agendamento)}
                      >
                        <IconExcluir />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Agenda
