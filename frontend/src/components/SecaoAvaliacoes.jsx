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

// Única fonte pra quais campos aparecem (e como são formatados) tanto no card da tela quanto
// no PDF exportado.
const CAMPOS_EXIBICAO = [
  { rotulo: 'Peso', obter: (a) => (a.peso ? `${a.peso} kg` : '—') },
  { rotulo: 'Altura', obter: (a) => (a.altura ? `${a.altura} m` : '—') },
  { rotulo: 'IMC', obter: (a) => a.imc ?? '—' },
  { rotulo: 'Escala de dor', obter: (a) => a.escala_dor ?? '—' },
  { rotulo: 'Queixa principal', obter: (a) => a.queixa_principal || '—' },
  { rotulo: 'Diagnóstico fisioterapêutico', obter: (a) => a.diagnostico_fisioterapeutico || '—' },
  { rotulo: 'Avaliação postural', obter: (a) => a.avaliacao_postural || '—' },
  { rotulo: 'Recomendações', obter: (a) => a.recomendacoes || '—' },
]

function estadoInicial() {
  return {
    agendamento_id: '',
    peso: '',
    altura: '',
    queixa_principal: '',
    diagnostico_fisioterapeutico: '',
    escala_dor: '',
    avaliacao_postural: '',
    recomendacoes: '',
    responsavel_id: '',
  }
}

// Exame físico do cliente — postura, força, amplitude de movimento etc. (diferente da Anamnese,
// que é a entrevista de saúde feita antes disso).
function SecaoAvaliacoes({ clienteId, cliente, agendamentos, profissionais }) {
  const [avaliacoes, setAvaliacoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [formAberto, setFormAberto] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState(estadoInicial())

  async function carregar() {
    const dados = await api(`/avaliacoes?cliente_id=${clienteId}`)
    setAvaliacoes(dados)
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

  function iniciarEdicao(avaliacao) {
    setEditandoId(avaliacao.id)
    setForm({
      agendamento_id: avaliacao.agendamento_id ? String(avaliacao.agendamento_id) : '',
      peso: avaliacao.peso ?? '',
      altura: avaliacao.altura ?? '',
      queixa_principal: avaliacao.queixa_principal ?? '',
      diagnostico_fisioterapeutico: avaliacao.diagnostico_fisioterapeutico ?? '',
      escala_dor: avaliacao.escala_dor ?? '',
      avaliacao_postural: avaliacao.avaliacao_postural ?? '',
      recomendacoes: avaliacao.recomendacoes ?? '',
      responsavel_id: avaliacao.responsavel_id ? String(avaliacao.responsavel_id) : '',
    })
    setFormAberto(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const dados = {
      cliente_id: Number(clienteId),
      agendamento_id: form.agendamento_id || undefined,
      peso: form.peso || undefined,
      altura: form.altura || undefined,
      queixa_principal: form.queixa_principal,
      diagnostico_fisioterapeutico: form.diagnostico_fisioterapeutico,
      escala_dor: form.escala_dor === '' ? undefined : form.escala_dor,
      avaliacao_postural: form.avaliacao_postural,
      recomendacoes: form.recomendacoes,
      responsavel_id: form.responsavel_id || undefined,
    }

    if (editandoId) {
      await api(`/avaliacoes/${editandoId}`, { method: 'PUT', body: JSON.stringify(dados) })
    } else {
      await api('/avaliacoes', { method: 'POST', body: JSON.stringify(dados) })
    }

    setFormAberto(false)
    carregar()
  }

  async function handleExcluir(avaliacao) {
    if (!confirm('Excluir esta avaliação?')) return
    await api(`/avaliacoes/${avaliacao.id}`, { method: 'DELETE' })
    carregar()
  }

  function handleExportarPdf() {
    exportarRegistrosPdf({
      titulo: 'Avaliações',
      cliente,
      registros: avaliacoes.map((avaliacao) => ({
        data: avaliacao.data,
        campos: CAMPOS_EXIBICAO.map((c) => ({ rotulo: c.rotulo, valor: c.obter(avaliacao) })),
      })),
    })
  }

  if (carregando) return null

  return (
    <section className="perfil-secao">
      <div className="prontuario-secao-header">
        <h2>Avaliações</h2>
        <div className="prontuario-secao-acoes">
          {avaliacoes.length > 0 && (
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
              <label htmlFor="avaliacao-agendamento">Agendamento</label>
              <select
                id="avaliacao-agendamento"
                className="input-field"
                value={form.agendamento_id}
                onChange={(e) => campo('agendamento_id', e.target.value)}
              >
                <option value="">—</option>
                {agendamentos.map((agendamento) => (
                  <option key={agendamento.id} value={agendamento.id}>
                    {formatarDataHora(agendamento.data_hora)} — {agendamento.servicos?.nome ?? 'sem serviço'}
                  </option>
                ))}
              </select>
            </div>
            <div className="page-field">
              <label htmlFor="avaliacao-responsavel">Profissional responsável</label>
              <select
                id="avaliacao-responsavel"
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
            <p className="prontuario-form-grupo-titulo">Medidas</p>
            <div className="page-field">
              <label htmlFor="avaliacao-peso">Peso (kg)</label>
              <input
                id="avaliacao-peso"
                className="input-field"
                value={form.peso}
                onChange={(e) => campo('peso', e.target.value)}
              />
            </div>
            <div className="page-field">
              <label htmlFor="avaliacao-altura">Altura (m)</label>
              <input
                id="avaliacao-altura"
                className="input-field"
                value={form.altura}
                onChange={(e) => campo('altura', e.target.value)}
              />
            </div>
            <div className="page-field">
              <label htmlFor="avaliacao-dor">Escala de dor (0-10)</label>
              <input
                id="avaliacao-dor"
                type="number"
                min={0}
                max={10}
                className="input-field"
                value={form.escala_dor}
                onChange={(e) => campo('escala_dor', e.target.value)}
              />
            </div>
          </div>

          <div className="prontuario-form-grupo">
            <p className="prontuario-form-grupo-titulo">Avaliação clínica</p>
            <div className="page-field page-field-full">
              <label htmlFor="avaliacao-queixa">Queixa principal</label>
              <textarea
                id="avaliacao-queixa"
                className="input-field"
                rows={2}
                value={form.queixa_principal}
                onChange={(e) => campo('queixa_principal', e.target.value)}
              />
            </div>
            <div className="page-field page-field-full">
              <label htmlFor="avaliacao-diagnostico">Diagnóstico fisioterapêutico</label>
              <textarea
                id="avaliacao-diagnostico"
                className="input-field"
                rows={2}
                value={form.diagnostico_fisioterapeutico}
                onChange={(e) => campo('diagnostico_fisioterapeutico', e.target.value)}
              />
            </div>
            <div className="page-field page-field-full">
              <label htmlFor="avaliacao-postura">Avaliação postural</label>
              <textarea
                id="avaliacao-postura"
                className="input-field"
                rows={2}
                value={form.avaliacao_postural}
                onChange={(e) => campo('avaliacao_postural', e.target.value)}
              />
            </div>
            <div className="page-field page-field-full">
              <label htmlFor="avaliacao-recomendacoes">Recomendações</label>
              <textarea
                id="avaliacao-recomendacoes"
                className="input-field"
                rows={2}
                value={form.recomendacoes}
                onChange={(e) => campo('recomendacoes', e.target.value)}
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

      {avaliacoes.length === 0 ? (
        <p className="page-empty">Nenhuma avaliação registrada ainda.</p>
      ) : (
        <ul className="prontuario-lista">
          {avaliacoes.map((avaliacao) => (
            <li key={avaliacao.id} className="prontuario-item">
              <div className="prontuario-item-header">
                <span className="perfil-timeline-data">{formatarDataHora(avaliacao.data)}</span>
                <div className="tabela-acoes">
                  <button type="button" className="btn-secondary" aria-label="Editar" title="Editar" onClick={() => iniciarEdicao(avaliacao)}>
                    <IconEditar />
                  </button>
                  <button type="button" className="btn-danger" aria-label="Excluir" title="Excluir" onClick={() => handleExcluir(avaliacao)}>
                    <IconExcluir />
                  </button>
                </div>
              </div>
              <dl className="prontuario-item-campos">
                {CAMPOS_EXIBICAO.map((campo) => (
                  <div key={campo.rotulo}>
                    <dt>{campo.rotulo}</dt>
                    <dd>{campo.obter(avaliacao)}</dd>
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

export default SecaoAvaliacoes
