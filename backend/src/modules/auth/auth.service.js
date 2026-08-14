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
    { id: usuario.id, nome: usuario.nome, email: usuario.email },
    process.env.JWT_SECRET,
    { expiresIn: "8h" },
  );

  return {
    token,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
  };
}

export async function registrar({ nome, email, senha }) {
  const existente = await prisma.usuarios.findUnique({ where: { email } });
  if (existente) {
    throw new AppError("Já existe um usuário com este email", 409);
  }

  const senha_hash = await bcrypt.hash(senha, 10);

  const usuario = await prisma.usuarios.create({
    data: { nome, email, senha_hash },
  });

  return { id: usuario.id, nome: usuario.nome, email: usuario.email };
}
