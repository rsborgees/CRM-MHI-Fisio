import * as agendamentosService from "../agendamentos/agendamentos.service.js";

const CAMPOS_CADASTRAIS = [
  { chave: "cpf_cnpj", rotulo: "CPF" },
  { chave: "data_nascimento", rotulo: "data de nascimento" },
  { chave: "email", rotulo: "email" },
  { chave: "endereco", rotulo: "endereço" },
];

// Calculado aqui (não deixado pra IA "lembrar" sozinha ao longo da conversa) — assim ela sempre
// sabe com certeza o que já está preenchido, mesmo numa conversa retomada dias depois.
function resumoCadastro(cliente) {
  const faltando = CAMPOS_CADASTRAIS.filter((campo) => !cliente[campo.chave]).map((campo) => campo.rotulo);
  if (faltando.length === 0) {
    return "Cadastro completo (CPF, data de nascimento, email e endereço já preenchidos) — não precisa pedir esses dados de novo.";
  }
  return `Dados cadastrais ainda faltando: ${faltando.join(", ")}.`;
}

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
    resumoCadastro(cliente),
  ];

  return partes.join(" ");
}
