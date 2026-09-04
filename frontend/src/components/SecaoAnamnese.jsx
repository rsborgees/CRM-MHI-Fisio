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

const TABAGISMO = [
  { value: 'nunca_fumou', label: 'Nunca fumou' },
  { value: 'ex_fumante', label: 'Ex-fumante' },
  { value: 'fumante', label: 'Fumante' },
]

const CONSUMO_ALCOOL = [
  { value: 'nao_consome', label: 'Não consome' },
  { value: 'socialmente', label: 'Socialmente' },
  { value: 'frequente', label: 'Frequente' },
]

const QUALIDADE_SONO = [
  { value: 'boa', label: 'Boa' },
  { value: 'regular', label: 'Regular' },
  { value: 'ruim', label: 'Ruim' },
]

function rotulo(opcoes, valor) {
  return opcoes.find((opcao) => opcao.value === valor)?.label ?? valor
}

// Única fonte pra quais campos aparecem (e como são formatados) tanto no card da tela quanto
// no PDF exportado — evita esquecer um campo num lugar só, como já aconteceu antes.
const CAMPOS_EXIBICAO = [
  { rotulo: 'Queixa principal', obter: (a) => a.queixa_principal || '—' },
  { rotulo: 'História da doença atual', obter: (a) => a.historico_doenca_atual || '—' },
  { rotulo: 'Doenças prévias', obter: (a) => a.doencas_previas || '—' },
  { rotulo: 'Cirurgias anteriores', obter: (a) => a.cirurgias_anteriores || '—' },
  { rotulo: 'Medicamentos em uso', obter: (a) => a.medicamentos_em_uso || '—' },
  { rotulo: 'Alergias', obter: (a) => a.alergias || '—' },
  { rotulo: 'Histórico familiar de doenças', obter: (a) => a.historico_familiar || '—' },
  { rotulo: 'Atividade física', obter: (a) => (a.pratica_atividade_fisica ? 'Sim' : 'Não') },
  { rotulo: 'Tabagismo', obter: (a) => (a.tabagismo ? rotulo(TABAGISMO, a.tabagismo) : '—') },
  { rotulo: 'Consumo de álcool', obter: (a) => (a.consumo_alcool ? rotulo(CONSUMO_ALCOOL, a.consumo_alcool) : '—') },
  { rotulo: 'Qualidade do sono', obter: (a) => (a.qualidade_sono ? rotulo(QUALIDADE_SONO, a.qualidade_sono) : '—') },
  { rotulo: 'Observações adicionais', obter: (a) => a.observacoes_adicionais || '—' },
]

function estadoInicial() {
  return {
    agendamento_id: '',
    queixa_principal: '',
    historico_doenca_atual: '',
    doencas_previas: '',
    cirurgias_anteriores: '',
    medicamentos_em_uso: '',
    alergias: '',
    historico_familiar: '',
    pratica_atividade_fisica: false,
    tabagismo: '',
    consumo_alcool: '',
    qualidade_sono: '',
    observacoes_adicionais: '',
    responsavel_id: '',
  }
}

// Entrevista de saúde inicial do cliente, feita antes do exame físico (ver Avaliações).
function SecaoAnamnese({ clienteId, cliente, agendamentos, profissionais }) {
  const [anamneses, setAnamneses] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [formAberto, setFormAberto] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState(estadoInicial())

  async function carregar() {
    const dados = await api(`/anamneses?cliente_id=${clienteId}`)
    setAnamneses(dados)
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

  function iniciarEdicao(anamnese) {
    setEditandoId(anamnese.id)
    setForm({
      agendamento_id: anamnese.agendamento_id ? String(anamnese.agendamento_id) : '',
      queixa_principal: anamnese.queixa_principal ?? '',
      historico_doenca_atual: anamnese.historico_doenca_atual ?? '',
      doencas_previas: anamnese.doencas_previas ?? '',
      cirurgias_anteriores: anamnese.cirurgias_anteriores ?? '',
      medicamentos_em_uso: anamnese.medicamentos_em_uso ?? '',
      alergias: anamnese.alergias ?? '',
      historico_familiar: anamnese.historico_familiar ?? '',
      pratica_atividade_fisica: anamnese.pratica_atividade_fisica ?? false,
      tabagismo: anamnese.tabagismo ?? '',
      consumo_alcool: anamnese.consumo_alcool ?? '',
      qualidade_sono: anamnese.qualidade_sono ?? '',
      observacoes_adicionais: anamnese.observacoes_adicionais ?? '',
      responsavel_id: anamnese.responsavel_id ? String(anamnese.responsavel_id) : '',
    })
    setFormAberto(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const dados = {
      cliente_id: Number(clienteId),
      agendamento_id: form.agendamento_id || undefined,
      queixa_principal: form.queixa_principal,
      historico_doenca_atual: form.historico_doenca_atual,
      doencas_previas: form.doencas_previas,
      cirurgias_anteriores: form.cirurgias_anteriores,
      medicamentos_em_uso: form.medicamentos_em_uso,
      alergias: form.alergias,
      historico_familiar: form.historico_familiar,
      pratica_atividade_fisica: form.pratica_atividade_fisica,
      tabagismo: form.tabagismo || undefined,
      consumo_alcool: form.consumo_alcool || undefined,
      qualidade_sono: form.qualidade_sono || undefined,
      observacoes_adicionais: form.observacoes_adicionais,
      responsavel_id: form.responsavel_id || undefined,
    }

    if (editandoId) {
      await api(`/anamneses/${editandoId}`, { method: 'PUT', body: JSON.stringify(dados) })
    } else {
      await api('/anamneses', { method: 'POST', body: JSON.stringify(dados) })
    }

    setFormAberto(false)
    carregar()
  }

  async function handleExcluir(anamnese) {
    if (!confirm('Excluir este registro de anamnese?')) return
    await api(`/anamneses/${anamnese.id}`, { method: 'DELETE' })
    carregar()
  }

  function handleExportarPdf() {
    exportarRegistrosPdf({
      titulo: 'Anamnese',
      cliente,
      registros: anamneses.map((anamnese) => ({
        data: anamnese.data,
        campos: CAMPOS_EXIBICAO.map((c) => ({ rotulo: c.rotulo, valor: c.obter(anamnese) })),
      })),
    })
  }

  if (carregando) return null

  return (
    <section className="perfil-secao">
      <div className="prontuario-secao-header">
        <h2>Anamnese</h2>
        <div className="prontuario-secao-acoes">
          {anamneses.length > 0 && (
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
              <label htmlFor="anamnese-agendamento">Agendamento</label>
              <select
                id="anamnese-agendamento"
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
              <label htmlFor="anamnese-responsavel">Profissional responsável</label>
              <select
                id="anamnese-responsavel"
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
            <p className="prontuario-form-grupo-titulo">Queixa e histórico de saúde</p>
            <div className="page-field page-field-full">
              <label htmlFor="anamnese-queixa">Queixa principal</label>
              <textarea
                id="anamnese-queixa"
                className="input-field"
                rows={2}
                value={form.queixa_principal}
                onChange={(e) => campo('queixa_principal', e.target.value)}
              />
            </div>
            <div className="page-field page-field-full">
              <label htmlFor="anamnese-hda">História da doença atual</label>
              <textarea
                id="anamnese-hda"
                className="input-field"
                rows={2}
                value={form.historico_doenca_atual}
                onChange={(e) => campo('historico_doenca_atual', e.target.value)}
              />
            </div>
            <div className="page-field">
              <label htmlFor="anamnese-doencas">Doenças prévias (ex: diabetes, hipertensão)</label>
              <textarea
                id="anamnese-doencas"
                className="input-field"
                rows={2}
                value={form.doencas_previas}
                onChange={(e) => campo('doencas_previas', e.target.value)}
              />
            </div>
            <div className="page-field">
              <label htmlFor="anamnese-cirurgias">Cirurgias anteriores</label>
              <textarea
                id="anamnese-cirurgias"
                className="input-field"
                rows={2}
                value={form.cirurgias_anteriores}
                onChange={(e) => campo('cirurgias_anteriores', e.target.value)}
              />
            </div>
            <div className="page-field">
              <label htmlFor="anamnese-medicamentos">Medicamentos em uso</label>
              <textarea
                id="anamnese-medicamentos"
                className="input-field"
                rows={2}
                value={form.medicamentos_em_uso}
                onChange={(e) => campo('medicamentos_em_uso', e.target.value)}
              />
            </div>
            <div className="page-field">
              <label htmlFor="anamnese-alergias">Alergias</label>
              <input
                id="anamnese-alergias"
                className="input-field"
                value={form.alergias}
                onChange={(e) => campo('alergias', e.target.value)}
              />
            </div>
            <div className="page-field page-field-full">
              <label htmlFor="anamnese-familiar">Histórico familiar de doenças</label>
              <textarea
                id="anamnese-familiar"
                className="input-field"
                rows={2}
                value={form.historico_familiar}
                onChange={(e) => campo('historico_familiar', e.target.value)}
              />
            </div>
          </div>

          <div className="prontuario-form-grupo">
            <p className="prontuario-form-grupo-titulo">Hábitos de vida</p>
            <div className="page-field">
              <label htmlFor="anamnese-tabagismo">Tabagismo</label>
              <select
                id="anamnese-tabagismo"
                className="input-field"
                value={form.tabagismo}
                onChange={(e) => campo('tabagismo', e.target.value)}
              >
                <option value="">—</option>
                {TABAGISMO.map((opcao) => (
                  <option key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="page-field">
              <label htmlFor="anamnese-alcool">Consumo de álcool</label>
              <select
                id="anamnese-alcool"
                className="input-field"
                value={form.consumo_alcool}
                onChange={(e) => campo('consumo_alcool', e.target.value)}
              >
                <option value="">—</option>
                {CONSUMO_ALCOOL.map((opcao) => (
                  <option key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="page-field">
              <label htmlFor="anamnese-sono">Qualidade do sono</label>
              <select
                id="anamnese-sono"
                className="input-field"
                value={form.qualidade_sono}
                onChange={(e) => campo('qualidade_sono', e.target.value)}
              >
                <option value="">—</option>
                {QUALIDADE_SONO.map((opcao) => (
                  <option key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="page-field">
              <label htmlFor="anamnese-atividade" className="checkbox-field">
                <input
                  id="anamnese-atividade"
                  type="checkbox"
                  checked={form.pratica_atividade_fisica}
                  onChange={(e) => campo('pratica_atividade_fisica', e.target.checked)}
                />
                Pratica atividade física
              </label>
            </div>
          </div>

          <div className="prontuario-form-grupo">
            <p className="prontuario-form-grupo-titulo">Observações</p>
            <div className="page-field page-field-full">
              <textarea
                id="anamnese-observacoes"
                className="input-field"
                rows={2}
                placeholder="Observações adicionais"
                value={form.observacoes_adicionais}
                onChange={(e) => campo('observacoes_adicionais', e.target.value)}
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

      {anamneses.length === 0 ? (
        <p className="page-empty">Nenhuma anamnese registrada ainda.</p>
      ) : (
        <ul className="prontuario-lista">
          {anamneses.map((anamnese) => (
            <li key={anamnese.id} className="prontuario-item">
              <div className="prontuario-item-header">
                <span className="perfil-timeline-data">{formatarDataHora(anamnese.data)}</span>
                <div className="tabela-acoes">
                  <button type="button" className="btn-secondary" aria-label="Editar" title="Editar" onClick={() => iniciarEdicao(anamnese)}>
                    <IconEditar />
                  </button>
                  <button type="button" className="btn-danger" aria-label="Excluir" title="Excluir" onClick={() => handleExcluir(anamnese)}>
                    <IconExcluir />
                  </button>
                </div>
              </div>
              <dl className="prontuario-item-campos">
                {CAMPOS_EXIBICAO.map((campo) => (
                  <div key={campo.rotulo}>
                    <dt>{campo.rotulo}</dt>
                    <dd>{campo.obter(anamnese)}</dd>
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

export default SecaoAnamnese
