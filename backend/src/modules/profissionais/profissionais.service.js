import { prisma } from "../../lib/prisma.js";

export async function listar({ busca, ativo } = {}) {
  return prisma.profissionais.findMany({
    where: {
      ativo: ativo !== undefined ? ativo === "true" : undefined,
      nome: busca ? { contains: busca, mode: "insensitive" } : undefined,
    },
    include: { servicosAtendidos: true },
    orderBy: { nome: "asc" },
  });
}

export async function buscarPorId(id) {
  return prisma.profissionais.findUniqueOrThrow({ where: { id }, include: { servicosAtendidos: true } });
}

export async function criar(dados) {
  const { servico_ids, ...resto } = dados;
  return prisma.profissionais.create({
    data: {
      ...resto,
      servicosAtendidos: servico_ids !== undefined ? { connect: servico_ids.map((id) => ({ id })) } : undefined,
    },
    include: { servicosAtendidos: true },
  });
}

export async function atualizar(id, dados) {
  const { servico_ids, ...resto } = dados;
  return prisma.profissionais.update({
    where: { id },
    data: {
      ...resto,
      // "set" substitui a lista inteira de serviços vinculados pelo que foi marcado na tela.
      servicosAtendidos: servico_ids !== undefined ? { set: servico_ids.map((id) => ({ id })) } : undefined,
    },
    include: { servicosAtendidos: true },
  });
}

export async function remover(id) {
  await prisma.profissionais.delete({ where: { id } });
}
