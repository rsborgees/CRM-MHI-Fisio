import * as authService from "./auth.service.js";
import { loginSchema, registrarSchema } from "./auth.schema.js";

export async function login(req, res) {
  const dados = loginSchema.parse(req.body);
  const resultado = await authService.login(dados);
  res.json(resultado);
}

export async function registrar(req, res) {
  const dados = registrarSchema.parse(req.body);
  const usuario = await authService.registrar(dados);
  res.status(201).json(usuario);
}
