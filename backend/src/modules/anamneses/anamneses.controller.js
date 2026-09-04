import * as anamnesesService from "./anamneses.service.js";
import { criarAnamneseSchema, atualizarAnamneseSchema } from "./anamneses.schema.js";

export async function listar(req, res) {
  const { cliente_id } = req.query;
  const anamneses = await anamnesesService.listar({ cliente_id });
  res.json(anamneses);
}

export async function buscarPorId(req, res) {
  const anamnese = await anamnesesService.buscarPorId(Number(req.params.id));
  res.json(anamnese);
}

export async function criar(req, res) {
  const dados = criarAnamneseSchema.parse(req.body);
  const anamnese = await anamnesesService.criar(dados);
  res.status(201).json(anamnese);
}

export async function atualizar(req, res) {
  const dados = atualizarAnamneseSchema.parse(req.body);
  const anamnese = await anamnesesService.atualizar(Number(req.params.id), dados);
  res.json(anamnese);
}

export async function remover(req, res) {
  await anamnesesService.remover(Number(req.params.id));
  res.status(204).send();
}
