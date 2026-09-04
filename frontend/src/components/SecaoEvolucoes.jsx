import { useState, useEffect } from 'react'
import { api } from '../api'
import { IconEditar, IconExcluir } from './icons'
import { exportarRegistrosPdf } from '../utils/exportarPdf'

function formatarDataHora(data) {
  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const RESPOSTA_TRATAMENTO = [
  { value: 'melhora', label: 'Melhora' },
  { value: 'estavel', label: 'Estável' },
  { value: 'piora', label: 'Piora' },
]

function rotulo(valor) {
  return RESPOSTA_TRATAMENTO.find((opcao) => opcao.value === valor)?.label ?? valor
}

// Única fonte pra quais campos aparecem (e como são formatados) tanto no card da tela quanto
// no PDF exportado.
const CAMPOS_EXIBICAO = [
  { rotulo: 'Escala de dor', obter: (e) => e.escala_dor ?? '—' },
  { rotulo: 'Resposta ao tratamento', obter: (e) => (e.resposta_tratamento ? rotulo(e.resposta_tratamento) : '—') },
  { rotulo: 'Evolução do quadro', obter: (e) => e.evolucao_quadro || '—' },
  { rotulo: 'Conduta realizada', obter: (e) => e.conduta_realizada || '—' },
  { rotulo: 'Observações', obter: (e) => e.observacoes || '—' },
]

function estadoInicial() {
  return {
    agendamento_id: '',
    evolucao_quadro: '',
    escala_dor: '',
    conduta_realizada: '',
    resposta_tratamento: '',
    observacoes: '',
    responsavel_id: '',
  }
}

// Acompanhamento de uma sessão já realizada — sempre vinculado a um agendamento (diferente da
// Anamnese e da Avaliação, que podem existir sem um agendamento associado).
function SecaoEvolucoes({ clienteId, cliente, agendamentos, profissionais }) {
  const [evolucoes, setEvolucoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [formAberto, setFormAberto] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState(estadoInicial())

  async function carregar() {
    const dados = await api(`/evolucoes?cliente_id=${clienteId}`)
    setEvolucoes(dados)
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [clienteId])

  function campo(chave, valor) {
    setForm((atual) => ({ ...atual, [chave]: valor }))
  }

  function iniciarNovo() {
    setEditandoId(null)
    setForm(estadoInicial())
    setFormAberto(true)
  }

  function iniciarEdicao(evolucao) {
    setEditandoId(evolucao.id)
    setForm({
      agendamento_id: String(evolucao.agendamento_id),
      evolucao_quadro: evolucao.evolucao_quadro ?? '',
      escala_dor: evolucao.escala_dor ?? '',
      conduta_realizada: evolucao.conduta_realizada ?? '',
      resposta_tratamento: evolucao.resposta_tratamento ?? '',
      observacoes: evolucao.observacoes ?? '',
      responsavel_id: evolucao.responsavel_id ? String(evolucao.responsavel_id) : '',
    })
    setFormAberto(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const dados = {
      cliente_id: Number(clienteId),
      agendamento_id: Number(form.agendamento_id),
      evolucao_quadro: form.evolucao_quadro,
      escala_dor: form.escala_dor === '' ? undefined : form.escala_dor,
      conduta_realizada: form.conduta_realizada,
      resposta_tratamento: form.resposta_tratamento || undefined,
      observacoes: form.observacoes,
      responsavel_id: form.responsavel_id || undefined,
    }

    if (editandoId) {
      await api(`/evolucoes/${editandoId}`, { method: 'PUT', body: JSON.stringify(dados) })
    } else {
      await api('/evolucoes', { method: 'POST', body: JSON.stringify(dados) })
    }

    setFormAberto(false)
    carregar()
  }

  async function handleExcluir(evolucao) {
    if (!confirm('Excluir este registro de evolução?')) return
    await api(`/evolucoes/${evolucao.id}`, { method: 'DELETE' })
    carregar()
  }

  function handleExportarPdf() {
    exportarRegistrosPdf({
      titulo: 'Evoluções',
      cliente,
      registros: evolucoes.map((evolucao) => ({
        data: evolucao.data,
        campos: CAMPOS_EXIBICAO.map((c) => ({ rotulo: c.rotulo, valor: c.obter(evolucao) })),
      })),
    })
  }

  if (carregando) return null

  return (
    <section className="perfil-secao">
      <div className="prontuario-secao-header">
        <h2>Evoluções</h2>
        <div className="prontuario-secao-acoes">
          {evolucoes.length > 0 && (
            <button type="button" className="btn-secondary" onClick={handleExportarPdf}>
              Exportar PDF
            </button>
          )}
          {!formAberto && (
            <button type="button" className="btn-secondary" onClick={iniciarNovo}>
              + Novo registro
            </button>
          )}
        </div>
      </div>

      {formAberto && (
        <form className="prontuario-form" onSubmit={handleSubmit}>
          <div className="prontuario-form-grupo">
            <p className="prontuario-form-grupo-titulo">Vínculo</p>
            <div className="page-field">
              <label htmlFor="evolucao-agendamento">Agendamento</label>
              <select
                id="evolucao-agendamento"
                className="input-field"
                value={form.agendamento_id}
                onChange={(e) => campo('agendamento_id', e.target.value)}
                required
              >
                <option value="">Selecione um agendamento...</option>
                {agendamentos.map((agendamento) => (
                  <option key={agendamento.id} value={agendamento.id}>
                    {formatarDataHora(agendamento.data_hora)} — {agendamento.servicos?.nome ?? 'sem serviço'}
                  </option>
                ))}
              </select>
            </div>
            <div className="page-field">
              <label htmlFor="evolucao-responsavel">Profissional responsável</label>
              <select
                id="evolucao-responsavel"
                className="input-field"
                value={form.responsavel_id}
                onChange={(e) => campo('responsavel_id', e.target.value)}
              >
                <option value="">—</option>
                {profissionais.map((profissional) => (
                  <option key={profissional.id} value={profissional.id}>
                    {profissional.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="prontuario-form-grupo">
            <p className="prontuario-form-grupo-titulo">Estado do paciente</p>
            <div className="page-field">
              <label htmlFor="evolucao-dor">Escala de dor (0-10)</label>
              <input
                id="evolucao-dor"
                type="number"
                min={0}
                max={10}
                className="input-field"
                value={form.escala_dor}
                onChange={(e) => campo('escala_dor', e.target.value)}
              />
            </div>
            <div className="page-field">
              <label htmlFor="evolucao-resposta">Resposta ao tratamento</label>
              <select
                id="evolucao-resposta"
                className="input-field"
                value={form.resposta_tratamento}
                onChange={(e) => campo('resposta_tratamento', e.target.value)}
              >
                <option value="">—</option>
                {RESPOSTA_TRATAMENTO.map((opcao) => (
                  <option key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="prontuario-form-grupo">
            <p className="prontuario-form-grupo-titulo">Notas da sessão</p>
            <div className="page-field page-field-full">
              <label htmlFor="evolucao-quadro">Evolução do quadro</label>
              <textarea
                id="evolucao-quadro"
                className="input-field"
                rows={2}
                value={form.evolucao_quadro}
                onChange={(e) => campo('evolucao_quadro', e.target.value)}
              />
            </div>
            <div className="page-field page-field-full">
              <label htmlFor="evolucao-conduta">Conduta realizada na sessão</label>
              <textarea
                id="evolucao-conduta"
                className="input-field"
                rows={2}
                value={form.conduta_realizada}
                onChange={(e) => campo('conduta_realizada', e.target.value)}
              />
            </div>
            <div className="page-field page-field-full">
              <label htmlFor="evolucao-observacoes">Observações / próximos passos</label>
              <textarea
                id="evolucao-observacoes"
                className="input-field"
                rows={2}
                value={form.observacoes}
                onChange={(e) => campo('observacoes', e.target.value)}
              />
            </div>
          </div>

          <div className="prontuario-form-acoes">
            <button type="submit" className="btn-primary">
              {editandoId ? 'Salvar alterações' : 'Salvar registro'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setFormAberto(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {evolucoes.length === 0 ? (
        <p className="page-empty">Nenhuma evolução registrada ainda.</p>
      ) : (
        <ul className="prontuario-lista">
          {evolucoes.map((evolucao) => (
            <li key={evolucao.id} className="prontuario-item">
              <div className="prontuario-item-header">
                <span className="perfil-timeline-data">{formatarDataHora(evolucao.data)}</span>
                <div className="tabela-acoes">
                  <button type="button" className="btn-secondary" aria-label="Editar" title="Editar" onClick={() => iniciarEdicao(evolucao)}>
                    <IconEditar />
                  </button>
                  <button type="button" className="btn-danger" aria-label="Excluir" title="Excluir" onClick={() => handleExcluir(evolucao)}>
                    <IconExcluir />
                  </button>
                </div>
              </div>
              <dl className="prontuario-item-campos">
                {CAMPOS_EXIBICAO.map((campo) => (
                  <div key={campo.rotulo}>
                    <dt>{campo.rotulo}</dt>
                    <dd>{campo.obter(evolucao)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default SecaoEvolucoes
