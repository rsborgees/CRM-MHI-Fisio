import { prisma } from "../../lib/prisma.js";

export async function listar({ busca, ativo } = {}) {
  return prisma.profissionais.findMany({
    where: {
      ativo: ativo !== undefined ? ativo === "true" : undefined,
      nome: busca ? { contains: busca, mode: "insensitive" } : undefined,
    },
    orderBy: { nome: "asc" },
  });
}

export async function buscarPorId(id) {
  return prisma.profissionais.findUniqueOrThrow({ where: { id } });
}

export async function criar(dados) {
  return prisma.profissionais.create({ data: dados });
}

export async function atualizar(id, dados) {
  return prisma.profissionais.update({ where: { id }, data: dados });
}

export async function remover(id) {
  await prisma.profissionais.delete({ where: { id } });
}
