import * as conversasService from "./conversas.service.js";
import { enviarMensagem as enviarMensagemWhatsapp } from "./evolutionApi.js";
import { dividirEmMensagens } from "./webhook.controller.js";

export async function listar(req, res) {
  const conversas = await conversasService.listar();

  res.json(
    conversas.map((conversa) => ({
      cliente_id: conversa.cliente_id,
      nome: conversa.clientes.nome,
      telefone: conversa.telefone,
      push_name: conversa.push_name,
      pausado: conversa.pausado,
      ultima_mensagem: conversa.mensagens.at(-1)?.conteudo ?? "",
      atualizado_em: conversa.atualizado_em,
    })),
  );
}

export async function buscarPorCliente(req, res) {
  const clienteId = Number(req.params.clienteId);
  const mensagens = await conversasService.carregarHistorico(clienteId);
  const pausado = await conversasService.estaPausado(clienteId);
  res.json({ mensagens, pausado });
}

export async function definirPausa(req, res) {
  const { pausado } = req.body;
  await conversasService.definirPausado(Number(req.params.clienteId), Boolean(pausado));
  res.json({ pausado: Boolean(pausado) });
}

// Manda pelo WhatsApp de verdade a mensagem que o atendente digitou direto no CRM, e pausa a IA
// nessa conversa — senão o bot pode responder em cima logo depois, confundindo o cliente.
export async function enviarMensagem(req, res) {
  const clienteId = Number(req.params.clienteId);
  const { texto } = req.body;

  const conversa = await conversasService.buscarConversa(clienteId);
  if (!conversa) {
    return res.status(404).json({ error: "Conversa não encontrada" });
  }

  for (const parte of dividirEmMensagens(texto)) {
    await enviarMensagemWhatsapp(conversa.telefone, parte);
  }

  const mensagens = [...conversa.mensagens, { papel: "assistente", conteudo: texto }];
  await conversasService.salvarHistorico(clienteId, conversa.telefone, mensagens, conversa.push_name);
  await conversasService.definirPausado(clienteId, true);

  res.json({ mensagens, pausado: true });
}
