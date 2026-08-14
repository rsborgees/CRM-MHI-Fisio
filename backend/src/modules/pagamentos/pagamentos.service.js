import { prisma } from "../../lib/prisma.js";

export async function listar({ cliente_id, status } = {}) {
  return prisma.pagamentos.findMany({
    where: {
      cliente_id: cliente_id ? Number(cliente_id) : undefined,
      status: status || undefined,
    },
    include: { clientes: true, agendamentos: true, pacotes: true },
    orderBy: { data_pagamento: "desc" },
  });
}

export async function buscarPorId(id) {
  return prisma.pagamentos.findUniqueOrThrow({
    where: { id },
    include: { clientes: true, agendamentos: true, pacotes: true },
  });
}

export async function criar(dados) {
  return prisma.pagamentos.create({ data: dados });
}

export async function atualizar(id, dados) {
  return prisma.pagamentos.update({ where: { id }, data: dados });
}

export async function remover(id) {
  await prisma.pagamentos.delete({ where: { id } });
}
