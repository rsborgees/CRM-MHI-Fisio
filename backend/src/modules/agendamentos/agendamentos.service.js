import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { intervaloDoAgendamento, intervalosSeSobrepoem } from "./conflito.js";
import { gerarHorariosCandidatos } from "./disponibilidade.js";

export async function listar({ data, data_inicio, data_fim, profissional_id, cliente_id, status } = {}) {
  const where = {
    profissional_id: profissional_id ? Number(profissional_id) : undefined,
    cliente_id: cliente_id ? Number(cliente_id) : undefined,
    status: status || undefined,
  };

  if (data) {
    const inicio = new Date(`${data}T00:00:00`);
    const fim = new Date(`${data}T23:59:59.999`);
    where.data_hora = { gte: inicio, lte: fim };
  } else if (data_inicio && data_fim) {
    where.data_hora = {
      gte: new Date(`${data_inicio}T00:00:00`),
      lte: new Date(`${data_fim}T23:59:59.999`),
    };
  }

  return prisma.agendamentos.findMany({
    where,
    include: { clientes: true, profissionais: true, servicos: true, pacotes: true },
    orderBy: { data_hora: "asc" },
  });
}

export async function buscarPorId(id) {
  return prisma.agendamentos.findUniqueOrThrow({
    where: { id },
    include: { clientes: true, profissionais: true, servicos: true, pacotes: true },
  });
}

async function verificarConflito({ profissional_id, data_hora, duracao_minutos, ignorarId }) {
  const intervaloNovo = intervaloDoAgendamento({ data_hora, duracao_minutos });

  // Sem profissional definido, o agendamento ocupa o recurso compartilhado da clínica —
  // precisa checar contra TODOS os agendamentos do horário, não só os do mesmo profissional,
  // senão dois agendamentos "sem profissional" nunca conflitam entre si.
  const candidatos = await prisma.agendamentos.findMany({
    where: {
      profissional_id: profissional_id || undefined,
      status: { not: "cancelado" },
      id: ignorarId ? { not: ignorarId } : undefined,
    },
  });

  const conflito = candidatos.some((agendamento) =>
    intervalosSeSobrepoem(intervaloNovo, intervaloDoAgendamento(agendamento)),
  );

  if (conflito) {
    throw new AppError(
      profissional_id ? "Este profissional já tem um agendamento nesse horário" : "Já existe um agendamento nesse horário",
      409,
    );
  }
}

export async function criar(dados) {
  await verificarConflito(dados);
  const agendamento = await prisma.agendamentos.create({ data: dados });

  // Primeiro agendamento de verdade promove o contato de "novo_contato" pra "ativo".
  await prisma.clientes.updateMany({
    where: { id: dados.cliente_id, status: "novo_contato" },
    data: { status: "ativo" },
  });

  return agendamento;
}

export async function atualizar(id, dados) {
  if (dados.data_hora || dados.profissional_id || dados.duracao_minutos) {
    const atual = await prisma.agendamentos.findUniqueOrThrow({ where: { id } });
    await verificarConflito({
      profissional_id: dados.profissional_id ?? atual.profissional_id,
      data_hora: dados.data_hora ?? atual.data_hora,
      duracao_minutos: dados.duracao_minutos ?? atual.duracao_minutos,
      ignorarId: id,
    });
  }

  return prisma.agendamentos.update({ where: { id }, data: dados });
}

export async function remover(id) {
  await prisma.agendamentos.delete({ where: { id } });
}

export async function horariosDisponiveis({ servico_id, profissional_id, data }) {
  let duracao_minutos;

  if (servico_id) {
    const servico = await prisma.servicos.findUniqueOrThrow({ where: { id: Number(servico_id) } });
    duracao_minutos = servico.duracao_minutos;
  }

  // Mesma lógica de verificarConflito: sem profissional definido, precisa olhar TODOS os
  // agendamentos do dia (não só os de um profissional específico) pra não sugerir um horário
  // que já está ocupado por outro agendamento sem profissional.
  const agendamentosExistentes = await prisma.agendamentos.findMany({
    where: {
      profissional_id: profissional_id ? Number(profissional_id) : undefined,
      status: { not: "cancelado" },
      data_hora: { gte: new Date(`${data}T00:00:00`), lte: new Date(`${data}T23:59:59`) },
    },
  });

  const candidatos = gerarHorariosCandidatos({
    data,
    duracaoMinutos: duracao_minutos,
    horarioAbertura: process.env.HORARIO_ABERTURA || "09:00",
    horarioFechamento: process.env.HORARIO_FECHAMENTO || "19:00",
    agendamentosExistentes,
  });

  return candidatos.map((candidato) => candidato.toISOString());
}
