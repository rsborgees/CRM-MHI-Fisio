import * as clientesService from "../clientes/clientes.service.js";
import * as conversasService from "./conversas.service.js";
import * as configuracaoService from "./configuracao.service.js";
import { gerarResumoCliente } from "./resumoCliente.js";
import * as llmClient from "./llmClient.js";
import { DEFINICOES_FERRAMENTAS, gerarInstrucaoSistema, executarFerramenta } from "./tools.js";
import { enviarMensagem } from "./zapi.js";

const MAX_ITERACOES_FERRAMENTA = 5;
const MAX_MENSAGENS_CONTEXTO = 20;
const MENSAGEM_FALLBACK_ERRO =
  "Estou com dificuldade técnica agora, por favor tente novamente em alguns minutos ou fale com a recepção.";
const MENSAGEM_FALLBACK_LIMITE =
  "Não consegui concluir sua solicitação agora, vou chamar alguém da recepção para te ajudar.";

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

  for (let iteracao = 0; iteracao < MAX_ITERACOES_FERRAMENTA; iteracao++) {
    const resposta = await llmClient.gerarResposta({
      mensagens: historico,
      ferramentas: DEFINICOES_FERRAMENTAS,
      chamadasAnteriores,
      instrucaoSistema,
    });

    if (resposta.chamadasDeFerramenta.length === 0) {
      return resposta.texto;
    }

    for (const chamada of resposta.chamadasDeFerramenta) {
      const resultado = await executarFerramenta(clienteId, chamada.nome, chamada.argumentos);
      chamadasAnteriores.push({ chamada, resultado });
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

  // Salva o histórico e responde mesmo quando a IA falhou — o cliente escreveu de
  // verdade e isso precisa aparecer no painel de conversas independentemente do resultado.
  historico.push({ papel: "assistente", conteudo: textoFinal });
  await conversasService.salvarHistorico(cliente.id, telefone, historico, pushName);
  await enviarMensagem(telefone, textoFinal);

  return textoFinal;
}

export async function handleWebhook(req, res) {
  const { phone, text, fromMe, isGroup, senderName } = req.body;
  const telefone = phone;
  const mensagem = text?.message;

  // Ignora eco de mensagens enviadas pela própria clínica, mensagens de grupo,
  // e callbacks do Z-API que não são mensagem de texto (ex: status de entrega, áudio, imagem).
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
