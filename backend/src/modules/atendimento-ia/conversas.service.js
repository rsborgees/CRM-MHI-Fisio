import { prisma } from "../../lib/prisma.js";

export async function listar() {
  return prisma.conversas_whatsapp.findMany({
    include: { clientes: true },
    orderBy: { atualizado_em: "desc" },
  });
}

export async function carregarHistorico(clienteId) {
  const conversa = await prisma.conversas_whatsapp.findFirst({ where: { cliente_id: clienteId } });
  return conversa?.mensagens ?? [];
}

export async function buscarConversa(clienteId) {
  return prisma.conversas_whatsapp.findFirst({ where: { cliente_id: clienteId } });
}

export async function estaPausado(clienteId) {
  const conversa = await prisma.conversas_whatsapp.findFirst({ where: { cliente_id: clienteId } });
  return conversa?.pausado ?? false;
}

export async function definirPausado(clienteId, pausado) {
  await prisma.conversas_whatsapp.updateMany({ where: { cliente_id: clienteId }, data: { pausado } });
}

export async function salvarHistorico(clienteId, telefone, mensagens, pushName) {
  const conversa = await prisma.conversas_whatsapp.findFirst({ where: { cliente_id: clienteId } });

  if (conversa) {
    return prisma.conversas_whatsapp.update({
      where: { id: conversa.id },
      data: { mensagens, push_name: pushName ?? conversa.push_name },
    });
  }

  return prisma.conversas_whatsapp.create({
    data: { cliente_id: clienteId, telefone, mensagens, push_name: pushName },
  });
}
