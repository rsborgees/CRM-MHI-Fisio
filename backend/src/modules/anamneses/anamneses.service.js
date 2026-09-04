import { prisma } from "../../lib/prisma.js";

export async function listar({ cliente_id } = {}) {
  return prisma.anamneses.findMany({
    where: { cliente_id: cliente_id ? Number(cliente_id) : undefined },
    orderBy: { data: "desc" },
  });
}

export async function buscarPorId(id) {
  return prisma.anamneses.findUniqueOrThrow({ where: { id } });
}

export async function criar(dados) {
  return prisma.anamneses.create({ data: dados });
}

export async function atualizar(id, dados) {
  return prisma.anamneses.update({ where: { id }, data: dados });
}

export async function remover(id) {
  await prisma.anamneses.delete({ where: { id } });
}
