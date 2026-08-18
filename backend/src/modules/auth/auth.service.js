import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";

export async function login({ email, senha }) {
  const usuario = await prisma.usuarios.findUnique({ where: { email } });

  if (!usuario || !usuario.ativo) {
    throw new AppError("Email ou senha inválidos", 401);
  }

  const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
  if (!senhaCorreta) {
    throw new AppError("Email ou senha inválidos", 401);
  }

  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
    process.env.JWT_SECRET,
    { expiresIn: "8h" },
  );

  return {
    token,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
  };
}

export async function buscarPerfil(id) {
  const usuario = await prisma.usuarios.findUniqueOrThrow({ where: { id } });
  return { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel };
}

export async function atualizarPerfil(id, { nome, email }) {
  const emailEmUso = await prisma.usuarios.findUnique({ where: { email } });
  if (emailEmUso && emailEmUso.id !== id) {
    throw new AppError("Já existe um usuário com este email", 409);
  }

  const usuario = await prisma.usuarios.update({ where: { id }, data: { nome, email } });
  return { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel };
}

export async function alterarSenha(id, { senhaAtual, novaSenha }) {
  const usuario = await prisma.usuarios.findUniqueOrThrow({ where: { id } });

  const senhaCorreta = await bcrypt.compare(senhaAtual, usuario.senha_hash);
  if (!senhaCorreta) {
    // 400, não 401: esse erro acontece com o usuário já autenticado (é sobre a senha ANTIGA
    // estar errada, não sobre a sessão) — usar 401 aqui faria o interceptor do frontend tratar
    // como "sessão expirada" e deslogar à força em vez de mostrar o erro no formulário.
    throw new AppError("Senha atual incorreta", 400);
  }

  const senha_hash = await bcrypt.hash(novaSenha, 10);
  await prisma.usuarios.update({ where: { id }, data: { senha_hash } });
}
