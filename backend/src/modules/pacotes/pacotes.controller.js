import * as pacotesService from "./pacotes.service.js";
import { criarPacoteSchema, atualizarPacoteSchema } from "./pacotes.schema.js";

export async function listar(req, res) {
  const { busca, ativo } = req.query;
  const pacotes = await pacotesService.listar({ busca, ativo });
  res.json(pacotes);
}

export async function buscarPorId(req, res) {
  const pacote = await pacotesService.buscarPorId(Number(req.params.id));
  res.json(pacote);
}

export async function criar(req, res) {
  const dados = criarPacoteSchema.parse(req.body);
  const pacote = await pacotesService.criar(dados);
  res.status(201).json(pacote);
}

export async function atualizar(req, res) {
  const dados = atualizarPacoteSchema.parse(req.body);
  const pacote = await pacotesService.atualizar(Number(req.params.id), dados);
  res.json(pacote);
}

export async function remover(req, res) {
  await pacotesService.remover(Number(req.params.id));
  res.status(204).send();
}
