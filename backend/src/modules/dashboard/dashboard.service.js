import { prisma } from "../../lib/prisma.js";

function inicioDoDia() {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
}

function fimDoDia() {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);
}

function inicioDoMes() {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), 1);
}

export async function resumo() {
  const [
    clientesAtivos,
    totalClientes,
    novosClientesMes,
    totalAgendamentos,
    agendamentosHoje,
    faturamentoMes,
  ] = await Promise.all([
    prisma.clientes.count({ where: { status: "ativo" } }),
    prisma.clientes.count(),
    prisma.clientes.count({ where: { data_cadastro: { gte: inicioDoMes() } } }),
    prisma.agendamentos.count(),
    prisma.agendamentos.findMany({
      where: {
        data_hora: { gte: inicioDoDia(), lte: fimDoDia() },
        status: { not: "cancelado" },
      },
      include: { clientes: true, profissionais: true, servicos: true },
      orderBy: { data_hora: "asc" },
    }),
    prisma.pagamentos.aggregate({
      _sum: { valor: true },
      where: { data_pagamento: { gte: inicioDoMes() }, status: "pago" },
    }),
  ]);

  return {
    clientesAtivos,
    totalClientes,
    novosClientesMes,
    totalAgendamentos,
    agendamentosHoje: {
      quantidade: agendamentosHoje.length,
      lista: agendamentosHoje,
    },
    faturamentoMes: faturamentoMes._sum.valor ?? 0,
  };
}
