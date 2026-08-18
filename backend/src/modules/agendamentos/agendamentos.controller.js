import * as agendamentosService from "./agendamentos.service.js";
import { criarAgendamentoSchema, atualizarAgendamentoSchema } from "./agendamentos.schema.js";

export async function listar(req, res) {
  const { data, data_inicio, data_fim, profissional_id, cliente_id, status } = req.query;
  const agendamentos = await agendamentosService.listar({
    data,
    data_inicio,
    data_fim,
    profissional_id,
    cliente_id,
    status,
  });
  res.json(agendamentos);
}

export async function buscarPorId(req, res) {
  const agendamento = await agendamentosService.buscarPorId(Number(req.params.id));
  res.json(agendamento);
}

export async function criar(req, res) {
  const dados = criarAgendamentoSchema.parse(req.body);
  const agendamento = await agendamentosService.criar(dados);
  res.status(201).json(agendamento);
}

export async function atualizar(req, res) {
  const dados = atualizarAgendamentoSchema.parse(req.body);
  const agendamento = await agendamentosService.atualizar(Number(req.params.id), dados);
  res.json(agendamento);
}

export async function remover(req, res) {
  await agendamentosService.remover(Number(req.params.id));
  res.status(204).send();
}
