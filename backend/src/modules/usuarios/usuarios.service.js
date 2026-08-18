import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";

const CAMPOS_PUBLICOS = { id: true, nome: true, email: true, papel: true, ativo: true };

export async function listar() {
  return prisma.usuarios.findMany({
    select: CAMPOS_PUBLICOS,
    orderBy: { nome: "asc" },
  });
}

export async function criar({ nome, email, senha, papel }) {
  const existente = await prisma.usuarios.findUnique({ where: { email } });
  if (existente) {
    throw new AppError("Já existe um usuário com este email", 409);
  }

  const senha_hash = await bcrypt.hash(senha, 10);
  const usuario = await prisma.usuarios.create({ data: { nome, email, senha_hash, papel } });
  return { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel, ativo: usuario.ativo };
}

export async function atualizar(id, dados) {
  if (dados.email) {
    const emailEmUso = await prisma.usuarios.findUnique({ where: { email: dados.email } });
    if (emailEmUso && emailEmUso.id !== id) {
      throw new AppError("Já existe um usuário com este email", 409);
    }
  }

  const usuario = await prisma.usuarios.update({ where: { id }, data: dados });
  return { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel, ativo: usuario.ativo };
}

// Impede a pessoa de excluir a própria conta pelo painel — evita ficar sem nenhum administrador
// (ou trancar a si mesma fora do sistema) por engano.
export async function remover(id, idUsuarioLogado) {
  if (id === idUsuarioLogado) {
    throw new AppError("Você não pode excluir seu próprio usuário", 400);
  }
  await prisma.usuarios.delete({ where: { id } });
}
