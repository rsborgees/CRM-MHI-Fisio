import * as usuariosService from "./usuarios.service.js";
import { criarUsuarioSchema, atualizarUsuarioSchema } from "./usuarios.schema.js";

export async function listar(req, res) {
  const usuarios = await usuariosService.listar();
  res.json(usuarios);
}

export async function criar(req, res) {
  const dados = criarUsuarioSchema.parse(req.body);
  const usuario = await usuariosService.criar(dados);
  res.status(201).json(usuario);
}

export async function atualizar(req, res) {
  const dados = atualizarUsuarioSchema.parse(req.body);
  const usuario = await usuariosService.atualizar(Number(req.params.id), dados);
  res.json(usuario);
}

export async function remover(req, res) {
  await usuariosService.remover(Number(req.params.id), req.usuario.id);
  res.status(204).send();
}
