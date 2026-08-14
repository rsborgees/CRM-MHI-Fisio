import * as servicosService from "./servicos.service.js";
import { criarServicoSchema, atualizarServicoSchema } from "./servicos.schema.js";

export async function listar(req, res) {
  const { busca, categoria, ativo } = req.query;
  const servicos = await servicosService.listar({ busca, categoria, ativo });
  res.json(servicos);
}

export async function buscarPorId(req, res) {
  const servico = await servicosService.buscarPorId(Number(req.params.id));
  res.json(servico);
}

export async function criar(req, res) {
  const dados = criarServicoSchema.parse(req.body);
  const servico = await servicosService.criar(dados);
  res.status(201).json(servico);
}

export async function atualizar(req, res) {
  const dados = atualizarServicoSchema.parse(req.body);
  const servico = await servicosService.atualizar(Number(req.params.id), dados);
  res.json(servico);
}

export async function remover(req, res) {
  await servicosService.remover(Number(req.params.id));
  res.status(204).send();
}
