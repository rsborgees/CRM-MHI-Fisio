import { prisma } from "../../lib/prisma.js";
import { variantesTelefoneBR } from "./telefone.js";

export async function listar({ busca, status } = {}) {
  return prisma.clientes.findMany({
    where: {
      status: status || undefined,
      nome: busca ? { contains: busca, mode: "insensitive" } : undefined,
    },
    orderBy: { nome: "asc" },
  });
}

export async function buscarPorId(id) {
  return prisma.clientes.findUniqueOrThrow({ where: { id } });
}

export async function criar(dados) {
  return prisma.clientes.create({ data: dados });
}

export async function atualizar(id, dados) {
  return prisma.clientes.update({ where: { id }, data: dados });
}

export async function remover(id) {
  await prisma.clientes.delete({ where: { id } });
}

export async function buscarPorTelefone(telefone) {
  const variantes = variantesTelefoneBR(telefone);
  return prisma.clientes.findFirst({
    where: { OR: variantes.flatMap((variante) => [{ telefone: variante }, { celular: variante }]) },
  });
}
