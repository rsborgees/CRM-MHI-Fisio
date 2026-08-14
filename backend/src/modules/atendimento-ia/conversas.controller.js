import * as conversasService from "./conversas.service.js";

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
