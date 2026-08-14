import * as clientesService from "../clientes/clientes.service.js";
import * as servicosService from "../servicos/servicos.service.js";
import * as agendamentosService from "../agendamentos/agendamentos.service.js";
import { AppError } from "../../utils/AppError.js";

export function gerarInstrucaoSistema({ instrucaoBase, resumoCliente, nome, primeiraMensagem }) {
  let instrucao = instrucaoBase;

  if (resumoCliente) {
    instrucao += `\n\nContexto sobre este cliente (não repita isso literalmente pra ele, é só pra você se situar): ${resumoCliente}`;
  }

  if (primeiraMensagem) {
    instrucao +=
      ` O nome salvo para este contato é "${nome}", vindo do perfil do WhatsApp, e pode não ser o nome completo ` +
      "real da pessoa. Nesta primeira mensagem da conversa, cumprimente o cliente e, se ele ainda não tiver dito o " +
      "nome completo dele na própria mensagem, pergunte educadamente qual é antes de seguir com o atendimento. " +
      "Assim que ele informar o nome (nesta mensagem ou numa próxima), chame a ferramenta atualizarNomeCliente com " +
      "o nome completo pra salvar no cadastro — não pergunte de novo depois disso.";
  }

  return instrucao;
}

export const DEFINICOES_FERRAMENTAS = [
  {
    nome: "consultarServicosPrecos",
    descricao:
      "Lista os serviços ativos oferecidos pela clínica, com nome, descrição, categoria, duração e preço.",
    parametros: { type: "object", properties: {} },
  },
  {
    nome: "consultarHorariosDisponiveis",
    descricao: "Lista horários disponíveis numa data específica, opcionalmente filtrando por serviço e profissional.",
    parametros: {
      type: "object",
      properties: {
        data: { type: "string", description: "data no formato AAAA-MM-DD" },
        servico_id: { type: "number", description: "id do serviço desejado, se já escolhido" },
        profissional_id: { type: "number", description: "id do profissional desejado, se já escolhido" },
      },
      required: ["data"],
    },
  },
  {
    nome: "criarAgendamento",
    descricao: "Cria um novo agendamento para o cliente desta conversa.",
    parametros: {
      type: "object",
      properties: {
        servico_id: { type: "number" },
        profissional_id: { type: "number" },
        data_hora: { type: "string", description: "data e hora no formato AAAA-MM-DDTHH:mm:00" },
      },
      required: ["data_hora"],
    },
  },
  {
    nome: "remarcarAgendamento",
    descricao: "Muda a data/hora de um agendamento existente do cliente desta conversa.",
    parametros: {
      type: "object",
      properties: {
        agendamento_id: { type: "number" },
        data_hora: { type: "string" },
      },
      required: ["agendamento_id", "data_hora"],
    },
  },
  {
    nome: "cancelarAgendamento",
    descricao: "Cancela um agendamento existente do cliente desta conversa.",
    parametros: {
      type: "object",
      properties: { agendamento_id: { type: "number" } },
      required: ["agendamento_id"],
    },
  },
  {
    nome: "consultarMeusAgendamentos",
    descricao: "Lista os agendamentos (não cancelados) do cliente desta conversa.",
    parametros: { type: "object", properties: {} },
  },
  {
    nome: "atualizarNomeCliente",
    descricao: "Atualiza o nome completo do cliente desta conversa, depois que ele informar no WhatsApp.",
    parametros: {
      type: "object",
      properties: {
        nome: { type: "string", description: "nome completo informado pelo cliente" },
      },
      required: ["nome"],
    },
  },
];

async function consultarServicosPrecos() {
  const servicos = await servicosService.listar({ ativo: "true" });
  return {
    servicos: servicos.map((servico) => ({
      id: servico.id,
      nome: servico.nome,
      descricao: servico.descricao,
      categoria: servico.categoria,
      preco: servico.preco,
      duracao_minutos: servico.duracao_minutos,
    })),
  };
}

async function consultarHorariosDisponiveis(clienteId, argumentos) {
  const horarios = await agendamentosService.horariosDisponiveis({
    servico_id: argumentos.servico_id,
    profissional_id: argumentos.profissional_id,
    data: argumentos.data,
  });
  return { horarios };
}

async function criarAgendamento(clienteId, argumentos) {
  let duracao_minutos;
  if (argumentos.servico_id) {
    const servico = await servicosService.buscarPorId(Number(argumentos.servico_id));
    duracao_minutos = servico.duracao_minutos;
  }

  const agendamento = await agendamentosService.criar({
    cliente_id: clienteId,
    servico_id: argumentos.servico_id,
    profissional_id: argumentos.profissional_id,
    data_hora: new Date(argumentos.data_hora),
    duracao_minutos,
  });

  return { id: agendamento.id, status: agendamento.status, data_hora: agendamento.data_hora };
}

async function buscarAgendamentoDoCliente(clienteId, agendamentoId) {
  const agendamento = await agendamentosService.buscarPorId(Number(agendamentoId));
  if (agendamento.cliente_id !== clienteId) {
    throw new AppError("Agendamento não encontrado", 404);
  }
  return agendamento;
}

async function remarcarAgendamento(clienteId, argumentos) {
  const atual = await buscarAgendamentoDoCliente(clienteId, argumentos.agendamento_id);
  const agendamento = await agendamentosService.atualizar(atual.id, {
    data_hora: new Date(argumentos.data_hora),
  });
  return { id: agendamento.id, status: agendamento.status, data_hora: agendamento.data_hora };
}

async function cancelarAgendamento(clienteId, argumentos) {
  const atual = await buscarAgendamentoDoCliente(clienteId, argumentos.agendamento_id);
  const agendamento = await agendamentosService.atualizar(atual.id, { status: "cancelado" });
  return { id: agendamento.id, status: agendamento.status };
}

async function consultarMeusAgendamentos(clienteId) {
  const agendamentos = await agendamentosService.listar({ cliente_id: clienteId });
  return {
    agendamentos: agendamentos
      .filter((agendamento) => agendamento.status !== "cancelado")
      .map((agendamento) => ({
        id: agendamento.id,
        data_hora: agendamento.data_hora,
        status: agendamento.status,
        servico: agendamento.servicos?.nome ?? null,
      })),
  };
}

async function atualizarNomeCliente(clienteId, argumentos) {
  const cliente = await clientesService.atualizar(clienteId, { nome: argumentos.nome });
  return { id: cliente.id, nome: cliente.nome };
}

const EXECUTORES = {
  consultarServicosPrecos,
  consultarHorariosDisponiveis,
  criarAgendamento,
  remarcarAgendamento,
  cancelarAgendamento,
  consultarMeusAgendamentos,
  atualizarNomeCliente,
};

export async function executarFerramenta(clienteId, nome, argumentos) {
  const executor = EXECUTORES[nome];
  if (!executor) {
    throw new AppError(`Ferramenta desconhecida: ${nome}`, 400);
  }

  try {
    return await executor(clienteId, argumentos ?? {});
  } catch (erro) {
    if (erro instanceof AppError) {
      return { erro: erro.message };
    }
    throw erro;
  }
}
