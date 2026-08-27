import * as clientesService from "../clientes/clientes.service.js";
import * as conversasService from "./conversas.service.js";
import * as configuracaoService from "./configuracao.service.js";
import { gerarResumoCliente } from "./resumoCliente.js";
import * as llmClient from "./llmClient.js";
import {
  DEFINICOES_FERRAMENTAS,
  gerarInstrucaoSistema,
  executarFerramenta,
  formatarHoraLocal,
  formatarDataCompletaLocal,
} from "./tools.js";
import { enviarMensagem } from "./evolutionApi.js";

const MAX_ITERACOES_FERRAMENTA = 5;
const MAX_MENSAGENS_CONTEXTO = 20;
// Quanto tempo esperar depois de UMA mensagem antes de chamar a IA — se o cliente mandar mais
// mensagens "picotadas" (várias seguidas em vez de uma só) dentro dessa janela, a espera reinicia
// e todas entram numa resposta só, em vez de a IA responder (ou se confundir) a cada pedaço.
const TEMPO_ESPERA_MENSAGENS_PICOTADAS_MS = Number(process.env.DEBOUNCE_MENSAGENS_MS ?? 8000);
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
  "não está disponível",
  "não estão disponíveis",
  "não está livre",
  "não temos esse horário",
];

function pareceConfirmarAcaoSemFerramenta(texto, chamadasAnteriores) {
  if (!texto) return false;

  const mencionaConfirmacao = PALAVRAS_DE_CONFIRMACAO.some((palavra) => texto.toLowerCase().includes(palavra));
  if (!mencionaConfirmacao) return false;

  // Precisa ter tido SUCESSO, não só sido chamada — senão uma tentativa que falhou (ex: erro de
  // profissional ambíguo) já "libera" a IA pra afirmar sucesso numa resposta posterior sem
  // nunca ter de fato criado o agendamento.
  const chamouFerramentaDeAcaoComSucesso = chamadasAnteriores.some(
    ({ chamada, resultado }) => FERRAMENTAS_DE_ACAO_EM_AGENDAMENTO.includes(chamada.nome) && !resultado?.erro,
  );
  return !chamouFerramentaDeAcaoComSucesso;
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

// Casa "9h", "14h30" ou "10:00" — horários específicos que a IA estaria oferecendo como opção.
const PADRAO_HORARIO = /\b([01]?\d|2[0-3])h([0-5]\d)?\b|\b([01]?\d|2[0-3]):[0-5]\d\b/g;

// A IA (modelo local, não muito confiável) às vezes inventa horários de exemplo do nada, sem
// nunca ter chamado consultarHorariosDisponiveis — ex: "pra amanhã tenho 9h e 14h disponíveis"
// quando na verdade os horários livres eram outros. Só desconfia com 2+ menções: uma menção
// isolada normalmente é a IA confirmando um horário único que o próprio cliente pediu, não
// uma lista de opções sendo oferecida.
function pareceOferecerHorariosSemConsultar(texto, chamadasAnteriores) {
  if (!texto) return false;

  const mencoesDeHorario = texto.match(PADRAO_HORARIO) ?? [];
  if (mencoesDeHorario.length < 2) return false;

  const consultouDisponibilidade = chamadasAnteriores.some(
    ({ chamada }) => chamada.nome === "consultarHorariosDisponiveis",
  );
  return !consultouDisponibilidade;
}

// Mesma lógica pro preço: já vimos o modelo inventar um valor (e duração) totalmente errado
// sem nunca ter chamado consultarServicosPrecos.
function pareceInformarPrecoSemConsultar(texto, chamadasAnteriores) {
  if (!texto) return false;

  const mencionaPreco = /R\$\s*\d/.test(texto);
  if (!mencionaPreco) return false;

  const consultouPrecos = chamadasAnteriores.some(({ chamada }) => chamada.nome === "consultarServicosPrecos");
  return !consultouPrecos;
}

function respostaPareceInventada(texto, chamadasAnteriores) {
  return (
    pareceConfirmarAcaoSemFerramenta(texto, chamadasAnteriores) ||
    pareceNegarDisponibilidadeSemConsultar(texto, chamadasAnteriores) ||
    pareceOferecerHorariosSemConsultar(texto, chamadasAnteriores) ||
    pareceInformarPrecoSemConsultar(texto, chamadasAnteriores)
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

function formatarPreco(preco) {
  if (preco == null) return null;
  const numero = Number(preco);
  return Number.isInteger(numero) ? String(numero) : numero.toFixed(2).replace(".", ",");
}

// A data/hora que o cliente vê precisa vir sempre do banco, nunca da IA reescrevendo de
// memória — um modelo pequeno já confirmou "amanhã às 13h" quando o que foi salvo de fato
// era outro dia. Isso monta a confirmação a partir do resultado real da ferramenta.
//
// criarAgendamento usa o template com emoji (mesmo formato descrito no prompt) — é o momento
// de maior valor pro cliente, vale a mensagem mais bonita. Ainda assim, todo dado nela (nome,
// dia, hora, serviço, preço) vem do resultado real da ferramenta, nunca da IA.
function montarConfirmacaoDeterministica(nomeFerramenta, resultado) {
  if (nomeFerramenta === "criarAgendamento") {
    const primeiroNome = resultado.nome_cliente?.split(" ")[0] || "";
    const precoFormatado = formatarPreco(resultado.preco);

    return (
      `Perfeito${primeiroNome ? `, ${primeiroNome}` : ""}! 💙 Seu agendamento está confirmado:\n` +
      `📅 ${formatarDataCompletaLocal(resultado.data_hora)}\n` +
      `🕗 ${formatarHoraLocal(resultado.data_hora)}\n` +
      `🩺 ${resultado.servico ?? "Sessão"}\n` +
      (precoFormatado ? `💰 R$ ${precoFormatado}\n` : "") +
      `Esperamos você na MHI Fisio! 😊`
    );
  }

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
            "[aviso do sistema, não é uma mensagem do cliente] Você afirmou uma informação (agendamento, preço/duração " +
            "de serviço, ou horários disponíveis) sem chamar a ferramenta correspondente. Chame agora a ferramenta " +
            "certa antes de responder ao cliente.",
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

// Gera e manda a resposta pra UM cliente, considerando o histórico já acumulado até agora
// (incluindo eventuais mensagens picotadas que chegaram durante a espera do debounce).
async function gerarRespostaEEnviar(cliente, telefone, pushName, primeiraMensagem) {
  const instrucaoBase = await configuracaoService.obterInstrucaoSistema();
  const resumoCliente = await gerarResumoCliente(cliente);
  const instrucaoSistema = gerarInstrucaoSistema({
    instrucaoBase,
    resumoCliente,
    nome: cliente.nome,
    primeiraMensagem,
  });

  const historicoAtual = await conversasService.carregarHistorico(cliente.id);
  // Manda só as últimas N mensagens pro modelo (memória de curto prazo) — o histórico
  // completo continua salvo no banco e visível no painel de Conversas independentemente disso.
  const contexto = historicoAtual.slice(-MAX_MENSAGENS_CONTEXTO);

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

  // Recarrega de novo antes de salvar — se outra mensagem picotada entrou bem no meio da
  // geração da resposta, isso evita sobrescrever ela.
  const historicoParaSalvar = await conversasService.carregarHistorico(cliente.id);
  historicoParaSalvar.push({ papel: "assistente", conteudo: textoFinal });
  await conversasService.salvarHistorico(cliente.id, telefone, historicoParaSalvar, pushName);

  // O painel guarda a resposta inteira como uma mensagem só (mais fácil de ler), mas no
  // WhatsApp mandamos cada parágrafo como uma mensagem separada — fica mais natural do que
  // uma mensagem só cheia de quebra de linha.
  for (const parte of dividirEmMensagens(textoFinal)) {
    await enviarMensagem(telefone, parte);
  }

  return textoFinal;
}

// Estado de debounce por cliente: fila de salvamento (serializa leitura+escrita do histórico,
// pra duas mensagens quase simultâneas não sobrescreverem uma a outra) + o timer que dispara a
// resposta da IA + quem está esperando essa resposta (pode ser mais de um envio picotado).
const estadoPorCliente = new Map();

function obterEstadoDoCliente(clienteId) {
  let estado = estadoPorCliente.get(clienteId);
  if (!estado) {
    estado = { filaSalvar: Promise.resolve(), timer: null, primeiraMensagem: false, resolvers: [] };
    estadoPorCliente.set(clienteId, estado);
  }
  return estado;
}

export async function processarMensagemRecebida({ telefone, mensagem, pushName }) {
  const cliente = await resolverCliente(telefone, pushName);
  const estado = obterEstadoDoCliente(cliente.id);

  // Serializa leitura+escrita do histórico por cliente — sem isso, duas mensagens picotadas
  // chegando quase juntas poderiam ler o histórico antes uma da outra salvar, e uma sobrescreveria
  // a outra (não tem trava de banco num "lê tudo, adiciona, salva tudo").
  const chamadaDeSalvar = estado.filaSalvar.then(async () => {
    const historico = await conversasService.carregarHistorico(cliente.id);
    const primeiraMensagemDesteEnvio = historico.length === 0;
    historico.push({ papel: "usuario", conteudo: mensagem });
    await conversasService.salvarHistorico(cliente.id, telefone, historico, pushName);
    return primeiraMensagemDesteEnvio;
  });
  // A fila em si nunca fica "travada" rejeitada — quem chamou ainda vê o erro de verdade abaixo.
  estado.filaSalvar = chamadaDeSalvar.catch(() => {});
  const primeiraMensagemDesteEnvio = await chamadaDeSalvar;

  // Enquanto a IA estiver pausada pra esse cliente, só guardamos a mensagem no
  // histórico (pra aparecer no painel) e não respondemos automaticamente.
  const pausado = await conversasService.estaPausado(cliente.id);
  if (pausado) {
    return null;
  }

  // Só a PRIMEIRA mensagem de um lote picotado decide se é "primeira mensagem da conversa" —
  // as próximas mensagens do mesmo lote só reiniciam a espera, sem mexer nessa flag.
  if (!estado.timer) {
    estado.primeiraMensagem = primeiraMensagemDesteEnvio;
  } else {
    clearTimeout(estado.timer);
  }

  return new Promise((resolve) => {
    estado.resolvers.push(resolve);

    estado.timer = setTimeout(async () => {
      estadoPorCliente.delete(cliente.id);
      let textoFinal;
      try {
        textoFinal = await gerarRespostaEEnviar(cliente, telefone, pushName, estado.primeiraMensagem);
      } catch (erro) {
        console.error("Erro ao processar mensagem do WhatsApp:", erro);
        textoFinal = MENSAGEM_FALLBACK_ERRO;
        await enviarMensagem(telefone, MENSAGEM_FALLBACK_ERRO).catch(() => {});
      }
      estado.resolvers.forEach((resolver) => resolver(textoFinal));
    }, TEMPO_ESPERA_MENSAGENS_PICOTADAS_MS);
  });
}

export function dividirEmMensagens(texto) {
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

  // Não espera o processamento completo (que inclui a espera do debounce de mensagens picotadas
  // e o tempo da IA) pra responder o webhook — a Evolution API só precisa de uma confirmação
  // rápida de recebimento, não do resultado da conversa. O `return` da promise abaixo não atrasa
  // essa resposta (já foi enviada); só existe pra quem quiser aguardar a conclusão (ex: testes).
  const promessaProcessamento = processarMensagemRecebida({ telefone, mensagem, pushName: senderName }).catch(
    async (erro) => {
      console.error("Erro ao processar mensagem do WhatsApp:", erro);
      await enviarMensagem(telefone, MENSAGEM_FALLBACK_ERRO).catch(() => {});
    },
  );

  res.status(200).json({ status: "ok" });

  return promessaProcessamento;
}
