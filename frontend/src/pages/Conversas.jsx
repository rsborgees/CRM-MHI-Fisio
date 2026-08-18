import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import '../styles/paginaLista.css'
import '../styles/chat.css'
import './Conversas.css'

const INTERVALO_ATUALIZACAO_CONTATOS_MS = 5000
const INTERVALO_ATUALIZACAO_MENSAGENS_MS = 3000

function formatarHora(data) {
  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Conversas() {
  const [contatos, setContatos] = useState([])
  const [carregandoContatos, setCarregandoContatos] = useState(true)
  const [contatoSelecionado, setContatoSelecionado] = useState(null)
  const [mensagens, setMensagens] = useState([])
  const [pausado, setPausado] = useState(false)
  const [carregandoMensagens, setCarregandoMensagens] = useState(false)
  const [novaMensagem, setNovaMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const fimDasMensagensRef = useRef(null)

  async function carregarContatos() {
    const dados = await api('/conversas-whatsapp')
    setContatos(dados)
    setCarregandoContatos(false)
  }

  // Busca o conteúdo mais recente da conversa sem mexer no estado de "carregando" — usado tanto
  // ao trocar de contato (com loading) quanto no polling automático (sem loading, silencioso).
  async function atualizarMensagens(clienteId) {
    const dados = await api(`/conversas-whatsapp/${clienteId}`)
    setMensagens(dados.mensagens)
    setPausado(dados.pausado)
  }

  useEffect(() => {
    carregarContatos()
  }, [])

  // Deixa a lista de conversas (e a pré-visualização da última mensagem) sempre atualizada
  // sem precisar dar F5 — verifica de novo a cada alguns segundos.
  useEffect(() => {
    const intervalo = setInterval(carregarContatos, INTERVALO_ATUALIZACAO_CONTATOS_MS)
    return () => clearInterval(intervalo)
  }, [])

  // Mesma ideia pro chat aberto: se chegar mensagem nova do cliente (ou de outro atendente)
  // enquanto a conversa está aberta, aparece sozinha.
  const clienteSelecionadoId = contatoSelecionado?.cliente_id
  useEffect(() => {
    if (!clienteSelecionadoId) return
    const intervalo = setInterval(() => atualizarMensagens(clienteSelecionadoId), INTERVALO_ATUALIZACAO_MENSAGENS_MS)
    return () => clearInterval(intervalo)
  }, [clienteSelecionadoId])

  useEffect(() => {
    fimDasMensagensRef.current?.scrollIntoView({ block: 'end' })
  }, [mensagens])

  async function selecionarContato(contato) {
    setContatoSelecionado(contato)
    setCarregandoMensagens(true)
    await atualizarMensagens(contato.cliente_id)
    setCarregandoMensagens(false)
  }

  async function handleEnviarMensagem(e) {
    e.preventDefault()
    const texto = novaMensagem.trim()
    if (!texto || enviando) return

    setEnviando(true)
    const dados = await api(`/conversas-whatsapp/${contatoSelecionado.cliente_id}/mensagens`, {
      method: 'POST',
      body: JSON.stringify({ texto }),
    })
    setMensagens(dados.mensagens)
    setPausado(dados.pausado)
    setNovaMensagem('')
    setEnviando(false)
    carregarContatos()
  }

  async function handleAlternarPausa() {
    const novoValor = !pausado
    await api(`/conversas-whatsapp/${contatoSelecionado.cliente_id}/pausa`, {
      method: 'PUT',
      body: JSON.stringify({ pausado: novoValor }),
    })
    setPausado(novoValor)
    carregarContatos()
  }

  return (
    <div className="conversas-page">
      <aside className="conversas-lista">
        {carregandoContatos ? (
          <p className="page-empty">Carregando...</p>
        ) : contatos.length === 0 ? (
          <p className="page-empty">Nenhuma conversa ainda.</p>
        ) : (
          contatos.map((contato) => (
            <button
              key={contato.cliente_id}
              type="button"
              className={
                'conversas-item' +
                (contatoSelecionado?.cliente_id === contato.cliente_id ? ' ativo' : '')
              }
              onClick={() => selecionarContato(contato)}
            >
              <div className="conversas-item-topo">
                <span className="conversas-item-nome">{contato.telefone}</span>
                <span className="conversas-item-hora">{formatarHora(contato.atualizado_em)}</span>
              </div>
              {contato.push_name && (
                <span className="conversas-item-pushname">{contato.push_name}</span>
              )}
              <span className="conversas-item-preview">{contato.ultima_mensagem}</span>
              {contato.pausado && <span className="conversas-item-pausado">IA pausada</span>}
            </button>
          ))
        )}
      </aside>

      <section className="conversas-chat">
        {!contatoSelecionado ? (
          <p className="page-empty">Selecione uma conversa à esquerda para ver as mensagens.</p>
        ) : (
          <>
            <div className="conversas-chat-header">
              <div>
                <strong>{contatoSelecionado.telefone}</strong>
                {contatoSelecionado.push_name && <span>{contatoSelecionado.push_name}</span>}
              </div>
              <button
                type="button"
                className={pausado ? 'btn-primary' : 'btn-secondary'}
                onClick={handleAlternarPausa}
              >
                {pausado ? 'Retomar IA' : 'Pausar IA'}
              </button>
            </div>

            {carregandoMensagens ? (
              <p className="page-empty">Carregando...</p>
            ) : (
              <div className="chat-whatsapp conversas-chat-corpo">
                {mensagens.map((mensagem, indice) => (
                  <div
                    key={indice}
                    className={`chat-bolha chat-bolha-${mensagem.papel === 'assistente' ? 'assistente' : 'cliente'}`}
                  >
                    {mensagem.conteudo}
                  </div>
                ))}
                <div ref={fimDasMensagensRef} />
              </div>
            )}

            <form className="conversas-chat-composer" onSubmit={handleEnviarMensagem}>
              <input
                type="text"
                className="input-field"
                placeholder="Digite uma mensagem para enviar pelo WhatsApp..."
                value={novaMensagem}
                onChange={(e) => setNovaMensagem(e.target.value)}
                disabled={enviando}
              />
              <button type="submit" className="btn-primary" disabled={enviando || !novaMensagem.trim()}>
                Enviar
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  )
}

export default Conversas
