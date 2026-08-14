import { prisma } from "../../lib/prisma.js";

export async function listar({ cliente_id } = {}) {
  return prisma.historico_clientes.findMany({
    where: { cliente_id: cliente_id ? Number(cliente_id) : undefined },
    orderBy: { data: "desc" },
  });
}

export async function criar(dados) {
  return prisma.historico_clientes.create({ data: dados });
}

export async function remover(id) {
  await prisma.historico_clientes.delete({ where: { id } });
}
