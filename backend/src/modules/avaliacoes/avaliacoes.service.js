import { prisma } from "../../lib/prisma.js";

function calcularImc(dados) {
  if (!dados.imc && dados.peso && dados.altura) {
    return { ...dados, imc: Number((dados.peso / dados.altura ** 2).toFixed(2)) };
  }
  return dados;
}

export async function listar({ cliente_id } = {}) {
  return prisma.avaliacoes.findMany({
    where: { cliente_id: cliente_id ? Number(cliente_id) : undefined },
    orderBy: { data: "desc" },
  });
}

export async function buscarPorId(id) {
  return prisma.avaliacoes.findUniqueOrThrow({ where: { id } });
}

export async function criar(dados) {
  return prisma.avaliacoes.create({ data: calcularImc(dados) });
}

export async function atualizar(id, dados) {
  return prisma.avaliacoes.update({ where: { id }, data: calcularImc(dados) });
}

export async function remover(id) {
  await prisma.avaliacoes.delete({ where: { id } });
}
