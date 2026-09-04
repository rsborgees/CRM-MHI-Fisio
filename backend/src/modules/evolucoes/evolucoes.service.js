import { prisma } from "../../lib/prisma.js";

export async function listar({ cliente_id } = {}) {
  return prisma.evolucoes.findMany({
    where: { cliente_id: cliente_id ? Number(cliente_id) : undefined },
    orderBy: { data: "desc" },
  });
}

export async function buscarPorId(id) {
  return prisma.evolucoes.findUniqueOrThrow({ where: { id } });
}

export async function criar(dados) {
  return prisma.evolucoes.create({ data: dados });
}

export async function atualizar(id, dados) {
  return prisma.evolucoes.update({ where: { id }, data: dados });
}

export async function remover(id) {
  await prisma.evolucoes.delete({ where: { id } });
}
