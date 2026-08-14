import { prisma } from "../../lib/prisma.js";

export async function listar({ busca, categoria, ativo } = {}) {
  return prisma.servicos.findMany({
    where: {
      ativo: ativo !== undefined ? ativo === "true" : undefined,
      categoria: categoria || undefined,
      nome: busca ? { contains: busca, mode: "insensitive" } : undefined,
    },
    orderBy: { nome: "asc" },
  });
}

export async function buscarPorId(id) {
  return prisma.servicos.findUniqueOrThrow({ where: { id } });
}

export async function criar(dados) {
  return prisma.servicos.create({ data: dados });
}

export async function atualizar(id, dados) {
  return prisma.servicos.update({ where: { id }, data: dados });
}

export async function remover(id) {
  await prisma.servicos.delete({ where: { id } });
}
