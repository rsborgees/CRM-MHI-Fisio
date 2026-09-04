import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api'
import SecaoAnamnese from '../components/SecaoAnamnese'
import SecaoAvaliacoes from '../components/SecaoAvaliacoes'
import SecaoEvolucoes from '../components/SecaoEvolucoes'
import '../styles/paginaLista.css'
import '../styles/chat.css'
import './ClientePerfil.css'

function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR')
}

// Datas "puras" (sem hora, ex: data de nascimento) vêm do banco como meia-noite UTC — convertida
// pro fuso local (Brasil, atrás de UTC) isso mostraria o dia anterior. Formata direto a partir dos
// dígitos AAAA-MM-DD, sem passar por Date/fuso horário nenhum.
function formatarDataPura(data) {
  const [ano, mes, dia] = data.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
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
  const [profissionais, setProfissionais] = useState([])
  const [conversaWhatsapp, setConversaWhatsapp] = useState([])
  const [carregando, setCarregando] = useState(true)

  const [tipoHistorico, setTipoHistorico] = useState('')
  const [descricaoHistorico, setDescricaoHistorico] = useState('')

  const [editandoCadastro, setEditandoCadastro] = useState(false)
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [email, setEmail] = useState('')
  const [endereco, setEndereco] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [cep, setCep] = useState('')

  async function carregarHistorico() {
    const dados = await api(`/historico?cliente_id=${id}`)
    setHistorico(dados)
  }

  useEffect(() => {
    async function carregarTudo() {
      const [clienteData, agendamentosData, historicoData, profissionaisData, conversaData] = await Promise.all([
        api(`/clientes/${id}`),
        api(`/agendamentos?cliente_id=${id}`),
        api(`/historico?cliente_id=${id}`),
        api('/profissionais'),
        api(`/conversas-whatsapp/${id}`),
      ])
      setCliente(clienteData)
      setAgendamentos(agendamentosData)
      setHistorico(historicoData)
      setProfissionais(profissionaisData)
      setConversaWhatsapp(conversaData.mensagens)
      setCarregando(false)
    }
    carregarTudo()
  }, [id])

  function iniciarEdicaoCadastro() {
    setCpfCnpj(cliente.cpf_cnpj ?? '')
    setDataNascimento(cliente.data_nascimento ? cliente.data_nascimento.slice(0, 10) : '')
    setEmail(cliente.email ?? '')
    setEndereco(cliente.endereco ?? '')
    setCidade(cliente.cidade ?? '')
    setEstado(cliente.estado ?? '')
    setCep(cliente.cep ?? '')
    setEditandoCadastro(true)
  }

  async function handleSalvarCadastro(e) {
    e.preventDefault()
    const clienteAtualizado = await api(`/clientes/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        cpf_cnpj: cpfCnpj,
        data_nascimento: dataNascimento || undefined,
        email,
        endereco,
        cidade,
        estado,
        cep,
      }),
    })
    setCliente(clienteAtualizado)
    setEditandoCadastro(false)
  }

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
        <div className="prontuario-secao-header">
          <h2>Dados cadastrais</h2>
          {!editandoCadastro && (
            <button type="button" className="btn-secondary" onClick={iniciarEdicaoCadastro}>
              Editar
            </button>
          )}
        </div>

        {editandoCadastro ? (
          <form className="prontuario-form" onSubmit={handleSalvarCadastro}>
            <div className="page-field">
              <label htmlFor="cadastro-cpf">CPF/CNPJ</label>
              <input id="cadastro-cpf" className="input-field" value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} />
            </div>
            <div className="page-field">
              <label htmlFor="cadastro-nascimento">Data de nascimento</label>
              <input
                id="cadastro-nascimento"
                type="date"
                className="input-field"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
              />
            </div>
            <div className="page-field">
              <label htmlFor="cadastro-email">Email</label>
              <input
                id="cadastro-email"
                type="email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="page-field page-field-full">
              <label htmlFor="cadastro-endereco">Endereço</label>
              <input
                id="cadastro-endereco"
                className="input-field"
                placeholder="Rua, número, complemento e bairro"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
              />
            </div>
            <div className="page-field">
              <label htmlFor="cadastro-cidade">Cidade</label>
              <input id="cadastro-cidade" className="input-field" value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </div>
            <div className="page-field">
              <label htmlFor="cadastro-estado">Estado</label>
              <input id="cadastro-estado" className="input-field" value={estado} onChange={(e) => setEstado(e.target.value)} />
            </div>
            <div className="page-field">
              <label htmlFor="cadastro-cep">CEP</label>
              <input id="cadastro-cep" className="input-field" value={cep} onChange={(e) => setCep(e.target.value)} />
            </div>
            <div className="prontuario-form-acoes">
              <button type="submit" className="btn-primary">
                Salvar alterações
              </button>
              <button type="button" className="btn-secondary" onClick={() => setEditandoCadastro(false)}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="perfil-dados perfil-dados-cadastro">
            <span>CPF/CNPJ: {cliente.cpf_cnpj ?? '—'}</span>
            <span>Nascimento: {cliente.data_nascimento ? formatarDataPura(cliente.data_nascimento) : '—'}</span>
            <span>
              Endereço:{' '}
              {cliente.endereco
                ? [cliente.endereco, cliente.cidade, cliente.estado, cliente.cep].filter(Boolean).join(', ')
                : '—'}
            </span>
          </div>
        )}
      </section>

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

      <SecaoAnamnese clienteId={id} cliente={cliente} agendamentos={agendamentos} profissionais={profissionais} />

      <SecaoAvaliacoes clienteId={id} cliente={cliente} agendamentos={agendamentos} profissionais={profissionais} />

      <SecaoEvolucoes clienteId={id} cliente={cliente} agendamentos={agendamentos} profissionais={profissionais} />

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
