import * as authService from "./auth.service.js";
import { loginSchema, atualizarPerfilSchema, alterarSenhaSchema } from "./auth.schema.js";

export async function login(req, res) {
  const dados = loginSchema.parse(req.body);
  const resultado = await authService.login(dados);
  res.json(resultado);
}

export async function perfil(req, res) {
  const usuario = await authService.buscarPerfil(req.usuario.id);
  res.json(usuario);
}

export async function atualizarPerfil(req, res) {
  const dados = atualizarPerfilSchema.parse(req.body);
  const usuario = await authService.atualizarPerfil(req.usuario.id, dados);
  res.json(usuario);
}

export async function alterarSenha(req, res) {
  const dados = alterarSenhaSchema.parse(req.body);
  await authService.alterarSenha(req.usuario.id, dados);
  res.status(204).send();
}
