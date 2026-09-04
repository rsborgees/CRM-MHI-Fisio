import * as evolucoesService from "./evolucoes.service.js";
import { criarEvolucaoSchema, atualizarEvolucaoSchema } from "./evolucoes.schema.js";

export async function listar(req, res) {
  const { cliente_id } = req.query;
  const evolucoes = await evolucoesService.listar({ cliente_id });
  res.json(evolucoes);
}

export async function buscarPorId(req, res) {
  const evolucao = await evolucoesService.buscarPorId(Number(req.params.id));
  res.json(evolucao);
}

export async function criar(req, res) {
  const dados = criarEvolucaoSchema.parse(req.body);
  const evolucao = await evolucoesService.criar(dados);
  res.status(201).json(evolucao);
}

export async function atualizar(req, res) {
  const dados = atualizarEvolucaoSchema.parse(req.body);
  const evolucao = await evolucoesService.atualizar(Number(req.params.id), dados);
  res.json(evolucao);
}

export async function remover(req, res) {
  await evolucoesService.remover(Number(req.params.id));
  res.status(204).send();
}
