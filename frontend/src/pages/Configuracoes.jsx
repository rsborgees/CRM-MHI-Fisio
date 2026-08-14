import { useState, useEffect } from 'react'
import { api } from '../api'
import '../styles/paginaLista.css'
import './Configuracoes.css'

function Configuracoes() {
  const [instrucao, setInstrucao] = useState('')
  const [instrucaoPadrao, setInstrucaoPadrao] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    async function carregar() {
      const dados = await api('/configuracao-agente')
      setInstrucao(dados.instrucao_sistema)
      setInstrucaoPadrao(dados.instrucao_padrao)
      setCarregando(false)
    }
    carregar()
  }, [])

  async function handleSalvar(e) {
    e.preventDefault()
    setSalvando(true)
    setMensagem('')
    await api('/configuracao-agente', {
      method: 'PUT',
      body: JSON.stringify({ instrucao_sistema: instrucao }),
    })
    setSalvando(false)
    setMensagem('Salvo! A próxima mensagem recebida no WhatsApp já usa esse texto.')
  }

  function handleRestaurarPadrao() {
    setInstrucao(instrucaoPadrao)
    setMensagem('Texto padrão carregado — clique em Salvar pra confirmar.')
  }

  if (carregando) {
    return <p>Carregando...</p>
  }

  return (
    <div>
      <div className="page-header">
        <h1>Configurações do agente de IA</h1>
      </div>

      <p className="config-explicacao">
        Este é o texto que instrui como o agente de IA deve se comportar no WhatsApp — tom de voz, o que ele pode
        fazer e o que não pode. Mudar aqui não exige mexer em código: vale a partir da próxima mensagem recebida.
      </p>

      <form className="config-form" onSubmit={handleSalvar}>
        <textarea
          className="input-field config-textarea"
          value={instrucao}
          onChange={(e) => setInstrucao(e.target.value)}
          rows={12}
          required
        />

        <div className="config-acoes">
          <button type="submit" className="btn-primary" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          <button type="button" className="btn-secondary" onClick={handleRestaurarPadrao}>
            Restaurar padrão
          </button>
          {mensagem && <span className="config-mensagem">{mensagem}</span>}
        </div>
      </form>
    </div>
  )
}

export default Configuracoes
