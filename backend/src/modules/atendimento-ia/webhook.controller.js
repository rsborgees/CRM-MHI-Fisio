import * as clientesService from "../clientes/clientes.service.js";
import * as conversasService from "./conversas.service.js";
import * as configuracaoService from "./configuracao.service.js";
import { gerarResumoCliente } from "./resumoCliente.js";
import * as llmClient from "./llmClient.js";
import { DEFINICOES_FERRAMENTAS, gerarInstrucaoSistema, executarFerramenta } from "./tools.js";
import { enviarMensagem } from "./evolutionApi.js";

const MAX_ITERACOES_FERRAMENTA = 5;
const MAX_MENSAGENS_CONTEXTO = 20;
const MENSAGEM_FALLBACK_ERRO =
  "Estou com dificuldade técnica agora, por favor tente novamente em alguns minutos ou fale com a recepção.";
const MENSAGEM_FALLBACK_LIMITE =
  "Não consegui concluir sua solicitação agora, vou chamar alguém da recepção para te ajudar.";
const MENSAGEM_FALLBACK_CONFIRMACAO_NAO_VERIFICADA =
  "Deixa eu confirmar de novo pra garantir que ficou certinho: qual serviço, data e horário você quer?";

// Ferramentas que de fato alteram um agendamento — se o texto final soa como confirmação
// dessas ações mas nenhuma delas foi chamada nesta resposta, a IA está inventando o resultado.
const FERRAMENTAS_DE_ACAO_EM_AGENDAMENTO = [
  "criarAgendamento",
  "remarcarAgendamento",
  "cancelarAgendamento",
  "atualizarNomeCliente",
];
const PALAVRAS_DE_CONFIRMACAO = [
  "agendad",
  "marcad",
  "remarcad",
  "reagendad",
  "cancelad",
  "confirmad",
  "realizad",
  "conclu",
  "registrad",
  "cadastrad",
  "nome salvo",
  "fechado",
  "fechamos",
];
const PALAVRAS_DE_INDISPONIBILIDADE = [
  "indispon",
  "não há disponibilidade",
  "não há horário",
  "não tem horário",
  "sem horário",
  "está completo",
  "já está ocupado",
  "esgotado",
];

function pareceConfirmarAcaoSemFerramenta(texto, chamadasAnteriores) {
  if (!texto) return false;

  const mencionaConfirmacao = PALAVRAS_DE_CONFIRMACAO.some((palavra) => texto.toLowerCase().includes(palavra));
  if (!mencionaConfirmacao) return false;

  const chamouFerramentaDeAcao = chamadasAnteriores.some(({ chamada }) =>
    FERRAMENTAS_DE_ACAO_EM_AGENDAMENTO.includes(chamada.nome),
  );
  return !chamouFerramentaDeAcao;
}

// Mesma ideia, na direção contrária: a IA nega disponibilidade sem nunca ter consultado a
// ferramenta que de fato sabe os horários livres — também é uma afirmação inventada.
function pareceNegarDisponibilidadeSemConsultar(texto, chamadasAnteriores) {
  if (!texto) return false;

  const mencionaIndisponibilidade = PALAVRAS_DE_INDISPONIBILIDADE.some((palavra) =>
    texto.toLowerCase().includes(palavra),
  );
  if (!mencionaIndisponibilidade) return false;

  const consultouDisponibilidade = chamadasAnteriores.some(
    ({ chamada }) => chamada.nome === "consultarHorariosDisponiveis",
  );
  return !consultouDisponibilidade;
}

function respostaPareceInventada(texto, chamadasAnteriores) {
  return (
    pareceConfirmarAcaoSemFerramenta(texto, chamadasAnteriores) ||
    pareceNegarDisponibilidadeSemConsultar(texto, chamadasAnteriores)
  );
}

const MENSAGENS_DE_ACAO = {
  criarAgendamento: "Agendamento confirmado",
  remarcarAgendamento: "Agendamento remarcado",
  cancelarAgendamento: "Agendamento cancelado",
};

function formatarDataHora(dataHora) {
  return new Date(dataHora).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// A data/hora que o cliente vê precisa vir sempre do banco, nunca da IA reescrevendo de
// memória — um modelo pequeno já confirmou "amanhã às 13h" quando o que foi salvo de fato
// era outro dia. Isso monta a confirmação a partir do resultado real da ferramenta.
function montarConfirmacaoDeterministica(nomeFerramenta, resultado) {
  const rotulo = MENSAGENS_DE_ACAO[nomeFerramenta];
  if (!rotulo) return null;

  const servico = resultado.servico ? `${resultado.servico} — ` : "";
  return `${rotulo}: ${servico}${formatarDataHora(resultado.data_hora)}.`;
}

async function resolverCliente(telefone, pushName) {
  const existente = await clientesService.buscarPorTelefone(telefone);
  if (existente) return existente;

  return clientesService.criar({
    nome: pushName || `Cliente WhatsApp ${telefone}`,
    celular: telefone,
    origem: "whatsapp",
    status: "novo_contato",
  });
}

async function obterRespostaDoAgente(clienteId, historico, instrucaoSistema) {
  let chamadasAnteriores = [];
  let historicoComAvisos = historico;
  let jaAvisouParaCorrigir = false;

  for (let iteracao = 0; iteracao < MAX_ITERACOES_FERRAMENTA; iteracao++) {
    const resposta = await llmClient.gerarResposta({
      mensagens: historicoComAvisos,
      ferramentas: DEFINICOES_FERRAMENTAS,
      chamadasAnteriores,
      instrucaoSistema,
    });

    if (resposta.chamadasDeFerramenta.length === 0) {
      if (!respostaPareceInventada(resposta.texto, chamadasAnteriores)) {
        return resposta.texto;
      }

      if (jaAvisouParaCorrigir) {
        return MENSAGEM_FALLBACK_CONFIRMACAO_NAO_VERIFICADA;
      }

      // A IA afirmou algo que só uma ferramenta poderia confirmar (agendou algo, ou disse que
      // não há horário) sem de fato chamá-la — avisa e dá mais uma chance antes de recusar.
      jaAvisouParaCorrigir = true;
      historicoComAvisos = [
        ...historicoComAvisos,
        { papel: "assistente", conteudo: resposta.texto },
        {
          papel: "usuario",
          conteudo:
            "[aviso do sistema, não é uma mensagem do cliente] Você afirmou uma informação (agendamento ou " +
            "disponibilidade de horário) sem chamar a ferramenta correspondente. Chame agora a ferramenta certa " +
            "antes de responder ao cliente.",
        },
      ];
      continue;
    }

    for (const chamada of resposta.chamadasDeFerramenta) {
      const resultado = await executarFerramenta(clienteId, chamada.nome, chamada.argumentos);
      chamadasAnteriores.push({ chamada, resultado });

      // Sucesso numa ferramenta de ação: confirma com o dado real do banco agora mesmo, sem
      // devolver o turno pra IA "narrar" o resultado (é exatamente aí que ela erra a data).
      if (!resultado.erro) {
        const confirmacao = montarConfirmacaoDeterministica(chamada.nome, resultado);
        if (confirmacao) return confirmacao;
      }
    }
  }

  return MENSAGEM_FALLBACK_LIMITE;
}

export async function processarMensagemRecebida({ telefone, mensagem, pushName }) {
  const cliente = await resolverCliente(telefone, pushName);

  const historico = await conversasService.carregarHistorico(cliente.id);
  const primeiraMensagem = historico.length === 0;
  historico.push({ papel: "usuario", conteudo: mensagem });

  // Enquanto a IA estiver pausada pra esse cliente, só guardamos a mensagem no
  // histórico (pra aparecer no painel) e não respondemos automaticamente.
  const pausado = await conversasService.estaPausado(cliente.id);
  if (pausado) {
    await conversasService.salvarHistorico(cliente.id, telefone, historico, pushName);
    return null;
  }

  const instrucaoBase = await configuracaoService.obterInstrucaoSistema();
  const resumoCliente = await gerarResumoCliente(cliente);
  const instrucaoSistema = gerarInstrucaoSistema({
    instrucaoBase,
    resumoCliente,
    nome: cliente.nome,
    primeiraMensagem,
  });

  // Manda só as últimas N mensagens pro modelo (memória de curto prazo) — o histórico
  // completo continua salvo no banco e visível no painel de Conversas independentemente disso.
  const contexto = historico.slice(-MAX_MENSAGENS_CONTEXTO);

  let textoFinal;
  try {
    textoFinal = await obterRespostaDoAgente(cliente.id, contexto, instrucaoSistema);
  } catch (erro) {
    console.error("Erro ao processar mensagem do WhatsApp:", erro);
    textoFinal = MENSAGEM_FALLBACK_ERRO;
  }

  // O modelo às vezes escreve **negrito** estilo Markdown, mas o WhatsApp usa *negrito*
  // (um asterisco só) — sem isso, o cliente veria os asteriscos duplos literalmente.
  textoFinal = textoFinal.replace(/\*\*(.+?)\*\*/g, "*$1*");

  // Salva o histórico e responde mesmo quando a IA falhou — o cliente escreveu de
  // verdade e isso precisa aparecer no painel de conversas independentemente do resultado.
  historico.push({ papel: "assistente", conteudo: textoFinal });
  await conversasService.salvarHistorico(cliente.id, telefone, historico, pushName);

  // O painel guarda a resposta inteira como uma mensagem só (mais fácil de ler), mas no
  // WhatsApp mandamos cada parágrafo como uma mensagem separada — fica mais natural do que
  // uma mensagem só cheia de quebra de linha.
  for (const parte of dividirEmMensagens(textoFinal)) {
    await enviarMensagem(telefone, parte);
  }

  return textoFinal;
}

function dividirEmMensagens(texto) {
  return texto
    .split(/\n\s*\n/)
    .map((parte) => parte.trim())
    .filter(Boolean);
}

function extrairTextoDaMensagem(mensagem) {
  return mensagem?.conversation ?? mensagem?.extendedTextMessage?.text ?? null;
}

export async function handleWebhook(req, res) {
  const { event, data } = req.body;

  // A Evolution API manda vários tipos de evento (conexão, presença, etc.) além de
  // mensagem recebida — só nos interessa messages.upsert.
  if (event !== "messages.upsert") {
    return res.status(200).json({ status: "ignorado" });
  }

  const remoteJid = data?.key?.remoteJid;
  const fromMe = data?.key?.fromMe;
  const isGroup = remoteJid?.endsWith("@g.us");
  const telefone = remoteJid?.split("@")[0];
  const mensagem = extrairTextoDaMensagem(data?.message);
  const senderName = data?.pushName;

  // Ignora eco de mensagens enviadas pela própria clínica, mensagens de grupo,
  // e mensagens que não são texto simples (ex: áudio, imagem sem legenda).
  if (fromMe || isGroup || !telefone || !mensagem) {
    return res.status(200).json({ status: "ignorado" });
  }

  try {
    await processarMensagemRecebida({ telefone, mensagem, pushName: senderName });
  } catch (erro) {
    console.error("Erro ao processar mensagem do WhatsApp:", erro);
    await enviarMensagem(telefone, MENSAGEM_FALLBACK_ERRO).catch(() => {});
  }

  res.status(200).json({ status: "ok" });
}
