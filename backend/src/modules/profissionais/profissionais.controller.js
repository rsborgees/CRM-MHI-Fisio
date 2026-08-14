import * as profissionaisService from "./profissionais.service.js";
import { criarProfissionalSchema, atualizarProfissionalSchema } from "./profissionais.schema.js";

export async function listar(req, res) {
  const { busca, ativo } = req.query;
  const profissionais = await profissionaisService.listar({ busca, ativo });
  res.json(profissionais);
}

export async function buscarPorId(req, res) {
  const profissional = await profissionaisService.buscarPorId(Number(req.params.id));
  res.json(profissional);
}

export async function criar(req, res) {
  const dados = criarProfissionalSchema.parse(req.body);
  const profissional = await profissionaisService.criar(dados);
  res.status(201).json(profissional);
}

export async function atualizar(req, res) {
  const dados = atualizarProfissionalSchema.parse(req.body);
  const profissional = await profissionaisService.atualizar(Number(req.params.id), dados);
  res.json(profissional);
}

export async function remover(req, res) {
  await profissionaisService.remover(Number(req.params.id));
  res.status(204).send();
}
