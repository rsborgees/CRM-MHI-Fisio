import { useState, useEffect } from 'react'
import { api } from '../api'
import '../styles/paginaLista.css'
import '../styles/chat.css'
import './Conversas.css'

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

  async function carregarContatos() {
    const dados = await api('/conversas-whatsapp')
    setContatos(dados)
    setCarregandoContatos(false)
  }

  useEffect(() => {
    carregarContatos()
  }, [])

  async function selecionarContato(contato) {
    setContatoSelecionado(contato)
    setCarregandoMensagens(true)
    const dados = await api(`/conversas-whatsapp/${contato.cliente_id}`)
    setMensagens(dados.mensagens)
    setPausado(dados.pausado)
    setCarregandoMensagens(false)
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
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

export default Conversas
