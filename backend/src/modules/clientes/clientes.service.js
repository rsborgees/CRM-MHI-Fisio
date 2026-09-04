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

// Excluir um cliente sem isso falhava (violação de chave estrangeira) sempre que ele já tinha
// pagamento, agendamento, anamnese, avaliação, evolução, conversa de WhatsApp ou histórico
// vinculado — o que é o caso normal de qualquer cliente com algum uso real. Por isso a exclusão
// precisa arrastar junto todos os dados dependentes, numa transação (tudo ou nada).
export async function remover(id) {
  await prisma.$transaction(async (tx) => {
    const agendamentos = await tx.agendamentos.findMany({ where: { cliente_id: id }, select: { id: true } });
    const agendamentoIds = agendamentos.map((agendamento) => agendamento.id);

    await tx.pagamentos.deleteMany({ where: { OR: [{ cliente_id: id }, { agendamento_id: { in: agendamentoIds } }] } });
    await tx.anamneses.deleteMany({ where: { OR: [{ cliente_id: id }, { agendamento_id: { in: agendamentoIds } }] } });
    await tx.avaliacoes.deleteMany({ where: { OR: [{ cliente_id: id }, { agendamento_id: { in: agendamentoIds } }] } });
    await tx.evolucoes.deleteMany({ where: { OR: [{ cliente_id: id }, { agendamento_id: { in: agendamentoIds } }] } });
    await tx.historico_clientes.deleteMany({ where: { cliente_id: id } });
    await tx.conversas_whatsapp.deleteMany({ where: { cliente_id: id } });
    await tx.agendamentos.deleteMany({ where: { cliente_id: id } });
    await tx.clientes.delete({ where: { id } });
  });
}

export async function buscarPorTelefone(telefone) {
  const variantes = variantesTelefoneBR(telefone);
  return prisma.clientes.findFirst({
    where: { OR: variantes.flatMap((variante) => [{ telefone: variante }, { celular: variante }]) },
  });
}
