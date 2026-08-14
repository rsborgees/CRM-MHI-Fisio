import * as clientesService from "./clientes.service.js";
import { criarClienteSchema, atualizarClienteSchema } from "./clientes.schema.js";

export async function listar(req, res) {
  const { busca, status } = req.query;
  const clientes = await clientesService.listar({ busca, status });
  res.json(clientes);
}

export async function buscarPorId(req, res) {
  const cliente = await clientesService.buscarPorId(Number(req.params.id));
  res.json(cliente);
}

export async function criar(req, res) {
  const dados = criarClienteSchema.parse(req.body);
  const cliente = await clientesService.criar(dados);
  res.status(201).json(cliente);
}

export async function atualizar(req, res) {
  const dados = atualizarClienteSchema.parse(req.body);
  const cliente = await clientesService.atualizar(Number(req.params.id), dados);
  res.json(cliente);
}

export async function remover(req, res) {
  await clientesService.remover(Number(req.params.id));
  res.status(204).send();
}
