import * as pagamentosService from "./pagamentos.service.js";
import { criarPagamentoSchema, atualizarPagamentoSchema } from "./pagamentos.schema.js";

export async function listar(req, res) {
  const { cliente_id, status } = req.query;
  const pagamentos = await pagamentosService.listar({ cliente_id, status });
  res.json(pagamentos);
}

export async function buscarPorId(req, res) {
  const pagamento = await pagamentosService.buscarPorId(Number(req.params.id));
  res.json(pagamento);
}

export async function criar(req, res) {
  const dados = criarPagamentoSchema.parse(req.body);
  const pagamento = await pagamentosService.criar(dados);
  res.status(201).json(pagamento);
}

export async function atualizar(req, res) {
  const dados = atualizarPagamentoSchema.parse(req.body);
  const pagamento = await pagamentosService.atualizar(Number(req.params.id), dados);
  res.json(pagamento);
}

export async function remover(req, res) {
  await pagamentosService.remover(Number(req.params.id));
  res.status(204).send();
}
