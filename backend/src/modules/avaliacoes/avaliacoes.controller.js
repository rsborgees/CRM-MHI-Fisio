import * as avaliacoesService from "./avaliacoes.service.js";
import { criarAvaliacaoSchema, atualizarAvaliacaoSchema } from "./avaliacoes.schema.js";

export async function listar(req, res) {
  const { cliente_id } = req.query;
  const avaliacoes = await avaliacoesService.listar({ cliente_id });
  res.json(avaliacoes);
}

export async function buscarPorId(req, res) {
  const avaliacao = await avaliacoesService.buscarPorId(Number(req.params.id));
  res.json(avaliacao);
}

export async function criar(req, res) {
  const dados = criarAvaliacaoSchema.parse(req.body);
  const avaliacao = await avaliacoesService.criar(dados);
  res.status(201).json(avaliacao);
}

export async function atualizar(req, res) {
  const dados = atualizarAvaliacaoSchema.parse(req.body);
  const avaliacao = await avaliacoesService.atualizar(Number(req.params.id), dados);
  res.json(avaliacao);
}

export async function remover(req, res) {
  await avaliacoesService.remover(Number(req.params.id));
  res.status(204).send();
}
