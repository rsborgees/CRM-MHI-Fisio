import * as clientesService from "../clientes/clientes.service.js";
import * as servicosService from "../servicos/servicos.service.js";
import * as profissionaisService from "../profissionais/profissionais.service.js";
import * as agendamentosService from "../agendamentos/agendamentos.service.js";
import * as pagamentosService from "../pagamentos/pagamentos.service.js";
import { AppError } from "../../utils/AppError.js";

const DIAS_DA_SEMANA = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

const MAX_HORARIOS_SUGERIDOS = 2;
const FUSO_HORARIO_CLINICA = "America/Sao_Paulo";
const FORMAS_PAGAMENTO_VALIDAS = ["dinheiro", "pix", "cartao_credito", "cartao_debito"];
// Pra agendamentos no mesmo dia, exige pelo menos esse intervalo a partir de agora — dá tempo
// da clínica se organizar e evita a IA oferecer um horário daqui a 10 minutos.
const ANTECEDENCIA_MINIMA_MESMO_DIA_MINUTOS = 120;

// Converte um horário (armazenado em UTC no banco) pro fuso da clínica, explicitamente —
// não depende do fuso configurado no servidor onde isso roda. Sem isso, a IA lê o número
// da hora em UTC direto da string e fala como se já fosse hora local (ex: 11h UTC = 8h em SP).
function paraDataHoraLocalISO(dataUTC) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_HORARIO_CLINICA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(dataUTC));

  const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
  return `${valor("year")}-${valor("month")}-${valor("day")}T${valor("hour")}:${valor("minute")}:00`;
}

// "9h" ou "9h30" — nunca "09:00", que soa formal demais pra uma mensagem de WhatsApp.
export function formatarHoraLocal(dataHoraUTC) {
  const [hora, minuto] = paraDataHoraLocalISO(dataHoraUTC).slice(11, 16).split(":");
  return minuto === "00" ? `${Number(hora)}h` : `${Number(hora)}h${minuto}`;
}

// "sexta-feira, 28/08" — pro cartão final de confirmação. Diferente de descreverDiaRelativo:
// ali "amanhã" é natural numa conversa ao vivo, mas numa mensagem que o cliente pode reler
// depois (é basicamente um comprovante) a data relativa fica ambígua — precisa do dia certo.
export function formatarDataCompletaLocal(dataHoraUTC) {
  const dataLocal = paraDataHoraLocalISO(dataHoraUTC).slice(0, 10);
  const [, mes, dia] = dataLocal.split("-");
  const diaSemana = DIAS_DA_SEMANA[new Date(`${dataLocal}T00:00:00`).getDay()];
  return `${diaSemana}, ${dia}/${mes}`;
}

function proximoDiaUtilISO() {
  const data = new Date();
  data.setDate(data.getDate() + 1);
  while (data.getDay() === 0 || data.getDay() === 6) {
    data.setDate(data.getDate() + 1);
  }
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// Usa o fuso da clínica explicitamente (mesma lógica de paraDataHoraLocalISO) em vez do fuso
// local do servidor — sem isso, perto da meia-noite UTC a IA recebe a data errada (ex: servidor
// já em "quinta" enquanto em São Paulo ainda é "quarta às 21h").
function formatarDataAtual() {
  const [dataLocal, horaLocal] = paraDataHoraLocalISO(new Date()).split("T");
  const diaSemana = DIAS_DA_SEMANA[new Date(`${dataLocal}T00:00:00`).getDay()];
  return (
    `Hoje é ${diaSemana}, ${dataLocal} (formato AAAA-MM-DD), agora são ${horaLocal.slice(0, 5)} ` +
    `(horário de Brasília). Use esta data e hora como referência para calcular "hoje", "amanhã", ` +
    '"essa semana", "daqui a pouco" e datas/horários relativos semelhantes — nunca use outra data ou hora como agora.'
  );
}

export function gerarInstrucaoSistema({ instrucaoBase, resumoCliente, nome, primeiraMensagem }) {
  let instrucao = `${instrucaoBase}\n\n${formatarDataAtual()}`;

  if (resumoCliente) {
    instrucao += `\n\nContexto sobre este cliente (não repita isso literalmente pra ele, é só pra você se situar): ${resumoCliente}`;
  }

  if (primeiraMensagem) {
    instrucao +=
      ` O nome salvo para este contato é "${nome}", vindo do perfil do WhatsApp, e pode não ser o nome completo ` +
      "real da pessoa. Nesta primeira mensagem, cumprimente o cliente de forma natural e pergunte como pode ajudar — " +
      "não peça o nome completo logo de cara, isso parece formulário de cadastro, não conversa. Só peça o nome " +
      "completo mais pra frente, num momento natural (por exemplo ao confirmar um agendamento), nunca como a " +
      "primeira pergunta. Quando ele informar o nome completo (nesta mensagem ou numa próxima), chame a ferramenta " +
      "atualizarNomeCliente pra salvar no cadastro — não pergunte de novo depois disso.";
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
    descricao:
      "Lista horários disponíveis, opcionalmente filtrando por data, serviço e profissional. Devolve só alguns " +
      "horários de exemplo (não a lista completa) e o total de horários livres naquele dia. Os horários já vêm " +
      "no horário local da clínica, prontos para copiar direto no data_hora de criarAgendamento — não precisa " +
      "converter fuso horário. O resultado inclui 'dia_semana' (ex: 'quarta-feira') — sempre use esse valor pra " +
      "falar o dia da semana com o cliente, nunca calcule você mesma, é fácil errar a conta.",
    parametros: {
      type: "object",
      properties: {
        data: {
          type: "string",
          description:
            "data no formato AAAA-MM-DD, se o cliente já disse qual dia quer. Deixe em branco se o cliente não " +
            "especificou — o sistema sugere automaticamente o próximo dia útil.",
        },
        nome_servico: {
          type: "string",
          description: "nome exato do serviço desejado (use o nome retornado por consultarServicosPrecos), se já escolhido",
        },
        nome_profissional: {
          type: "string",
          description: "nome exato do profissional desejado, se já escolhido",
        },
        periodo_dia: {
          type: "string",
          enum: ["manha", "tarde", "noite"],
          description:
            "use quando o cliente pedir um período específico (de manhã / à tarde / à noite) OU quando ele " +
            "recusar os horários já sugeridos e pedir outro período — chame a ferramenta de novo com este filtro " +
            "em vez de repetir os mesmos horários de exemplo que ele já rejeitou.",
        },
        hora_especifica: {
          type: "string",
          description:
            "se o cliente já pediu um horário exato (formato HH:mm), informe aqui pra confirmar diretamente se " +
            "ESSE horário está disponível — nunca conclua que não está só porque ele não apareceu nos exemplos " +
            "de 'horarios' retornados (esses são só alguns exemplos, não a lista completa).",
        },
      },
    },
  },
  {
    nome: "criarAgendamento",
    descricao: "Cria um novo agendamento para o cliente desta conversa.",
    parametros: {
      type: "object",
      properties: {
        nome_servico: {
          type: "string",
          description: "nome exato do serviço (use o nome retornado por consultarServicosPrecos, nunca um id)",
        },
        nome_profissional: {
          type: "string",
          description:
            "nome exato do profissional, só se o cliente já escolheu uma. Pode deixar em branco — o sistema " +
            "escolhe automaticamente quando só uma profissional atende o serviço, ou avisa se precisar perguntar " +
            "a preferência do cliente.",
        },
        data_hora: { type: "string", description: "data e hora no formato AAAA-MM-DDTHH:mm:00" },
        forma_pagamento: {
          type: "string",
          enum: ["dinheiro", "pix", "cartao_credito", "cartao_debito"],
          description:
            "forma de pagamento escolhida pelo cliente. Pergunte antes de agendar, se o serviço tiver preço e " +
            "você ainda não sabe. Se o cliente disser algo como 'cartão' sem especificar, pergunte se é crédito " +
            "ou débito.",
        },
      },
      required: ["nome_servico", "data_hora"],
    },
  },
  {
    nome: "remarcarAgendamento",
    descricao:
      "Muda a data/hora de um agendamento existente e ativo do cliente desta conversa. Nunca peça ou use um id " +
      "numérico de agendamento — o cliente não sabe esse número. Use o nome do serviço pra identificar qual agendamento.",
    parametros: {
      type: "object",
      properties: {
        nome_servico: {
          type: "string",
          description:
            "nome do serviço do agendamento que o cliente quer remarcar — obrigatório se ele tiver mais de um " +
            "agendamento ativo, opcional se só tiver um",
        },
        data_hora: { type: "string", description: "nova data e hora no formato AAAA-MM-DDTHH:mm:00" },
      },
      required: ["data_hora"],
    },
  },
  {
    nome: "cancelarAgendamento",
    descricao:
      "Cancela um agendamento existente e ativo do cliente desta conversa. Nunca peça ou use um id numérico de " +
      "agendamento — o cliente não sabe esse número. Use o nome do serviço pra identificar qual agendamento.",
    parametros: {
      type: "object",
      properties: {
        nome_servico: {
          type: "string",
          description:
            "nome do serviço do agendamento que o cliente quer cancelar — obrigatório se ele tiver mais de um " +
            "agendamento ativo, opcional se só tiver um",
        },
      },
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

async function resolverServicoPorNome(nomeServico) {
  if (!nomeServico) return null;

  const [servico] = await servicosService.listar({ busca: nomeServico, ativo: "true" });
  if (!servico) {
    const todos = await servicosService.listar({ ativo: "true" });
    throw new AppError(
      `Serviço "${nomeServico}" não encontrado. Serviços disponíveis: ${todos.map((s) => s.nome).join(", ")}.`,
      404,
    );
  }
  return servico;
}

async function resolverProfissionalPorNome(nomeProfissional) {
  if (!nomeProfissional) return null;

  const [profissional] = await profissionaisService.listar({ busca: nomeProfissional, ativo: "true" });
  if (!profissional) {
    const todos = await profissionaisService.listar({ ativo: "true" });
    throw new AppError(
      `Profissional "${nomeProfissional}" não encontrado. Profissionais disponíveis: ${todos.map((p) => p.nome).join(", ")}.`,
      404,
    );
  }
  return profissional;
}

async function profissionaisQueAtendemServico(servicoId) {
  const todos = await profissionaisService.listar({ ativo: "true" });
  return todos.filter((profissional) => profissional.servicosAtendidos?.some((servico) => servico.id === servicoId));
}

// Resolve qual profissional vai atender o agendamento quando o cliente não nomeia uma: se só
// uma profissional atende esse serviço, usa ela; se mais de uma atende, força a IA a perguntar
// a preferência do cliente antes de agendar; se nenhuma está vinculada ainda, segue sem
// profissional definida (recurso compartilhado da clínica, como já era antes dessa relação existir).
async function resolverProfissionalPorServico(servico) {
  const candidatas = await profissionaisQueAtendemServico(servico.id);
  if (candidatas.length === 1) return candidatas[0];
  if (candidatas.length > 1) {
    throw new AppError(
      `Mais de uma profissional atende ${servico.nome} (${candidatas.map((p) => p.nome).join(", ")}). Pergunte ao ` +
        'cliente de forma aberta se ele tem preferência de profissional (ex: "Você tem alguma preferência de ' +
        'profissional?") — não cite os nomes na pergunta, só informe quem atende se ele perguntar.',
      400,
    );
  }
  return null;
}

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

// Entre os horários disponíveis, prioriza os "redondos" (ex: 12:00) sobre os quebrados
// (ex: 12:30) ao escolher os exemplos pra sugerir — fica mais natural pro cliente escolher.
function escolherHorariosSugeridos(horarios) {
  const redondos = horarios.filter((horario) => new Date(horario).getUTCMinutes() === 0);
  const restantes = horarios.filter((horario) => !redondos.includes(horario));
  return [...redondos, ...restantes].slice(0, MAX_HORARIOS_SUGERIDOS);
}

// Sem isso, "consultarHorariosDisponiveis" sempre devolve os mesmos 2 primeiros horários do
// dia (os mais cedo) não importa quantas vezes for chamada — se o cliente recusar e pedir a
// tarde, a IA repetiria os mesmos horários de manhã por não ter como pedir um período diferente.
const FILTROS_PERIODO_DIA = {
  manha: (hora) => hora < 12,
  tarde: (hora) => hora >= 12 && hora < 18,
  noite: (hora) => hora >= 18,
};

function horaLocal(horarioUTC) {
  return Number(paraDataHoraLocalISO(horarioUTC).slice(11, 13));
}

// Se `data` for hoje (no fuso da clínica), remove horários antes do corte de antecedência
// mínima. A hora atual é arredondada pra baixo antes de somar a margem — às 9h09, o corte
// fica 11h00 (não 11h09), pra não descartar por poucos minutos um horário na hora cheia que
// já cumpre a margem em espírito. Pra qualquer outro dia, não filtra nada.
function comAntecedenciaMinimaSeHoje(horarios, data) {
  const agoraLocalISO = paraDataHoraLocalISO(new Date());
  const hojeLocal = agoraLocalISO.slice(0, 10);
  if (data !== hojeLocal) return horarios;

  const horaAtual = Number(agoraLocalISO.slice(11, 13));
  const horaCorte = String(horaAtual + ANTECEDENCIA_MINIMA_MESMO_DIA_MINUTOS / 60).padStart(2, "0");
  const limiteLocalISO = `${data}T${horaCorte}:00:00`;

  return horarios.filter((horario) => paraDataHoraLocalISO(horario) >= limiteLocalISO);
}

async function consultarHorariosDisponiveis(clienteId, argumentos) {
  const servico = await resolverServicoPorNome(argumentos.nome_servico);
  const profissional = await resolverProfissionalPorNome(argumentos.nome_profissional);
  // Se o cliente não disse qual dia quer, sugere o próximo dia útil em vez de perguntar
  // ou deixar o modelo inventar uma data.
  const data = argumentos.data || proximoDiaUtilISO();

  const todosHorarios = comAntecedenciaMinimaSeHoje(
    await agendamentosService.horariosDisponiveis({
      servico_id: servico?.id,
      profissional_id: profissional?.id,
      data,
    }),
    data,
  );

  const filtroPeriodo = FILTROS_PERIODO_DIA[argumentos.periodo_dia];
  const horarios = filtroPeriodo ? todosHorarios.filter((horario) => filtroPeriodo(horaLocal(horario))) : todosHorarios;

  const resultado = {
    data,
    // Calculado aqui, não pela IA — um modelo pequeno erra conta de "que dia da semana cai
    // essa data" com facilidade (ex: já disse "segunda-feira" pra uma data que era quarta).
    dia_semana: DIAS_DA_SEMANA[new Date(`${data}T00:00:00`).getDay()],
    horarios: escolherHorariosSugeridos(horarios).map(paraDataHoraLocalISO),
    total_disponivel: horarios.length,
  };

  // Sem isso, a IA só vê 2 exemplos e pode concluir errado que um horário específico que o
  // cliente pediu está indisponível só por não estar entre os 2 — aqui ela confirma de verdade.
  if (argumentos.hora_especifica) {
    const horarioProcuradoISO = `${data}T${argumentos.hora_especifica}:00`;
    resultado.horario_especifico_perguntado = horarioProcuradoISO;
    resultado.horario_especifico_disponivel = horarios.some(
      (horario) => paraDataHoraLocalISO(horario) === horarioProcuradoISO,
    );
  }

  return resultado;
}

async function criarAgendamento(clienteId, argumentos) {
  // O schema já marca nome_servico como obrigatório, mas nem todo modelo respeita isso —
  // sem essa checagem o agendamento é criado sem serviço vinculado (servico_id nulo).
  if (!argumentos.nome_servico) {
    throw new AppError("É necessário informar o nome do serviço para criar o agendamento.", 400);
  }

  // O nome só reflete o pushName do WhatsApp (ou o placeholder "Cliente WhatsApp ...") até o
  // cliente confirmar de verdade numa conversa — não dá pra agendar sem isso, mesmo que a IA
  // "esqueça" de perguntar antes. pushName pode ser um apelido, nome só de primeiro nome, ou
  // até de outra pessoa (o dono do número), então nunca é aceito como nome completo sem confirmar.
  const cliente = await clientesService.buscarPorId(clienteId);
  if (!cliente.nome_confirmado) {
    throw new AppError(
      "Antes de criar o agendamento, pergunte o nome completo do cliente e chame atualizarNomeCliente para salvar.",
      400,
    );
  }

  const servico = await resolverServicoPorNome(argumentos.nome_servico);

  // Checado antes de criar qualquer coisa no banco — se faltar, é melhor a IA perguntar e
  // tentar de novo do que criar o agendamento sem forma de pagamento definida (ou pior, criar
  // duas vezes numa retentativa). Só exige quando o serviço realmente tem um valor a cobrar.
  if (servico?.preco != null && !FORMAS_PAGAMENTO_VALIDAS.includes(argumentos.forma_pagamento)) {
    throw new AppError(
      "Antes de criar o agendamento, pergunte como o cliente prefere pagar (dinheiro, pix, cartão de crédito ou " +
        "cartão de débito) e informe a forma de pagamento.",
      400,
    );
  }

  let profissional;
  if (argumentos.nome_profissional) {
    profissional = await resolverProfissionalPorNome(argumentos.nome_profissional);
    const atende = profissional.servicosAtendidos?.some((s) => s.id === servico.id);
    if (!atende) {
      const quemAtende = await profissionaisQueAtendemServico(servico.id);
      throw new AppError(
        quemAtende.length > 0
          ? `${profissional.nome} não atende ${servico.nome}. Quem atende: ${quemAtende.map((p) => p.nome).join(", ")}.`
          : `${profissional.nome} não atende ${servico.nome}, e nenhuma outra profissional está vinculada a esse serviço ainda.`,
        400,
      );
    }
  } else {
    profissional = await resolverProfissionalPorServico(servico);
  }

  const agendamento = await agendamentosService.criar({
    cliente_id: clienteId,
    servico_id: servico?.id,
    profissional_id: profissional?.id,
    data_hora: new Date(argumentos.data_hora),
    duracao_minutos: servico?.duracao_minutos,
  });

  // Lança o valor do serviço como pendente assim que o cliente agenda pela IA — fica visível
  // no Financeiro pra cobrar depois. Só quando o serviço tem preço definido, e nunca deixa uma
  // falha aqui derrubar o agendamento que já foi criado com sucesso (o cliente já foi avisado
  // que agendou; tentar de novo criaria um agendamento duplicado).
  if (servico?.preco != null) {
    try {
      await pagamentosService.criar({
        cliente_id: clienteId,
        agendamento_id: agendamento.id,
        valor: servico.preco,
        forma_pagamento: argumentos.forma_pagamento,
        status: "pendente",
      });
    } catch (erro) {
      console.error(`Falha ao lançar pagamento pendente do agendamento ${agendamento.id}:`, erro);
    }
  }

  return {
    id: agendamento.id,
    status: agendamento.status,
    data_hora: agendamento.data_hora,
    servico: servico?.nome ?? null,
    preco: servico?.preco ?? null,
    nome_cliente: cliente.nome,
  };
}

// Resolve qual agendamento o cliente quer mudar/cancelar pelo nome do serviço, nunca por id —
// o cliente (e o modelo) não tem como saber um id numérico de agendamento. Como a busca já
// parte da lista de agendamentos DESSE cliente, a propriedade fica garantida por construção.
async function resolverAgendamentoDoClientePorServico(clienteId, nomeServico) {
  const agendamentos = await agendamentosService.listar({ cliente_id: clienteId });
  const ativos = agendamentos.filter((agendamento) => agendamento.status !== "cancelado");

  function listarAtivos() {
    return ativos
      .map((agendamento) => `${agendamento.servicos?.nome ?? "serviço"} em ${paraDataHoraLocalISO(agendamento.data_hora)}`)
      .join(", ");
  }

  if (ativos.length === 0) {
    throw new AppError("Este cliente não tem nenhum agendamento ativo no momento.", 404);
  }

  const candidatos = nomeServico
    ? ativos.filter((agendamento) => agendamento.servicos?.nome?.toLowerCase().includes(nomeServico.toLowerCase()))
    : ativos;

  if (candidatos.length === 0) {
    throw new AppError(
      `Não encontrei nenhum agendamento ativo para "${nomeServico}". Agendamentos ativos: ${listarAtivos()}.`,
      404,
    );
  }

  if (candidatos.length > 1) {
    throw new AppError(
      `O cliente tem mais de um agendamento ativo — peça pra ele especificar qual serviço. Agendamentos ativos: ${listarAtivos()}.`,
      400,
    );
  }

  return candidatos[0];
}

async function remarcarAgendamento(clienteId, argumentos) {
  const atual = await resolverAgendamentoDoClientePorServico(clienteId, argumentos.nome_servico);
  const agendamento = await agendamentosService.atualizar(atual.id, {
    data_hora: new Date(argumentos.data_hora),
  });
  return {
    id: agendamento.id,
    status: agendamento.status,
    data_hora: agendamento.data_hora,
    servico: atual.servicos?.nome ?? null,
  };
}

async function cancelarAgendamento(clienteId, argumentos) {
  const atual = await resolverAgendamentoDoClientePorServico(clienteId, argumentos.nome_servico);
  const agendamento = await agendamentosService.atualizar(atual.id, { status: "cancelado" });
  return {
    id: agendamento.id,
    status: agendamento.status,
    data_hora: atual.data_hora,
    servico: atual.servicos?.nome ?? null,
  };
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
  const cliente = await clientesService.atualizar(clienteId, { nome: argumentos.nome, nome_confirmado: true });
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
    // IDs vindos do modelo não são confiáveis (ele pode "inventar" um id que não existe) —
    // qualquer erro do serviço interno (ex: Prisma not-found) vira um resultado de ferramenta
    // recuperável em vez de derrubar a conversa inteira. O erro original ainda vai pro log.
    console.error(`Erro ao executar ferramenta "${nome}":`, erro);
    return { erro: "Não foi possível concluir essa ação com os dados informados. Confira e tente novamente." };
  }
}
