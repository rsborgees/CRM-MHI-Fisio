import * as historicoService from "./historico.service.js";
import { criarHistoricoSchema } from "./historico.schema.js";

export async function listar(req, res) {
  const { cliente_id } = req.query;
  const historico = await historicoService.listar({ cliente_id });
  res.json(historico);
}

export async function criar(req, res) {
  const dados = criarHistoricoSchema.parse(req.body);
  const registro = await historicoService.criar(dados);
  res.status(201).json(registro);
}

export async function remover(req, res) {
  await historicoService.remover(Number(req.params.id));
  res.status(204).send();
}
