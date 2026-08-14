import { prisma } from "../../lib/prisma.js";

export async function listar({ busca, ativo } = {}) {
  return prisma.pacotes.findMany({
    where: {
      ativo: ativo !== undefined ? ativo === "true" : undefined,
      nome: busca ? { contains: busca, mode: "insensitive" } : undefined,
    },
    orderBy: { nome: "asc" },
  });
}

export async function buscarPorId(id) {
  return prisma.pacotes.findUniqueOrThrow({ where: { id } });
}

export async function criar(dados) {
  return prisma.pacotes.create({ data: dados });
}

export async function atualizar(id, dados) {
  return prisma.pacotes.update({ where: { id }, data: dados });
}

export async function remover(id) {
  await prisma.pacotes.delete({ where: { id } });
}
