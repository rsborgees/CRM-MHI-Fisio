import * as agendamentosService from "../agendamentos/agendamentos.service.js";

export async function gerarResumoCliente(cliente) {
  const agendamentos = await agendamentosService.listar({ cliente_id: cliente.id });

  const cancelados = agendamentos.filter((agendamento) => agendamento.status === "cancelado").length;
  const futuro = agendamentos.find(
    (agendamento) => agendamento.status !== "cancelado" && new Date(agendamento.data_hora) > new Date(),
  );

  const diasComoCliente = Math.max(
    0,
    Math.floor((Date.now() - new Date(cliente.data_cadastro).getTime()) / (1000 * 60 * 60 * 24)),
  );

  const partes = [
    cliente.nome_confirmado
      ? `Nome (já confirmado pelo próprio cliente em conversa anterior, não precisa perguntar de novo): ${cliente.nome}.`
      : `Nome (ainda NÃO confirmado pelo cliente — é só o nome do perfil do WhatsApp, pode estar errado ou incompleto): ${cliente.nome}.`,
    `Status: ${cliente.status}.`,
    diasComoCliente > 0 ? `Cliente há ${diasComoCliente} dia(s).` : "Primeira interação com este contato.",
    `Total de agendamentos já feitos: ${agendamentos.length} (${cancelados} cancelado(s)).`,
    futuro
      ? `Já tem um agendamento futuro marcado para ${new Date(futuro.data_hora).toLocaleString("pt-BR")}.`
      : "Não tem nenhum agendamento futuro marcado.",
  ];

  return partes.join(" ");
}
