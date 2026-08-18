import { jest } from "@jest/globals";

jest.unstable_mockModule("./conversas.service.js", () => ({
  buscarConversa: jest.fn(),
  salvarHistorico: jest.fn().mockResolvedValue({}),
  definirPausado: jest.fn().mockResolvedValue({}),
}));

jest.unstable_mockModule("./evolutionApi.js", () => ({
  enviarMensagem: jest.fn().mockResolvedValue({}),
}));

const conversasService = await import("./conversas.service.js");
const { enviarMensagem: enviarMensagemWhatsapp } = await import("./evolutionApi.js");
const { enviarMensagem } = await import("./conversas.controller.js");

function criarRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("envia a mensagem pelo WhatsApp, salva no histórico e pausa a IA", async () => {
  conversasService.buscarConversa.mockResolvedValueOnce({
    id: 1,
    cliente_id: 5,
    telefone: "5511999999999",
    push_name: "Ana",
    mensagens: [{ papel: "usuario", conteudo: "oi" }],
  });
  const res = criarRes();

  await enviarMensagem({ params: { clienteId: "5" }, body: { texto: "Já te respondo!" } }, res);

  expect(enviarMensagemWhatsapp).toHaveBeenCalledWith("5511999999999", "Já te respondo!");
  expect(conversasService.salvarHistorico).toHaveBeenCalledWith(5, "5511999999999", [
    { papel: "usuario", conteudo: "oi" },
    { papel: "assistente", conteudo: "Já te respondo!" },
  ], "Ana");
  expect(conversasService.definirPausado).toHaveBeenCalledWith(5, true);
  expect(res.json).toHaveBeenCalledWith({
    mensagens: [
      { papel: "usuario", conteudo: "oi" },
      { papel: "assistente", conteudo: "Já te respondo!" },
    ],
    pausado: true,
  });
});

test("manda cada parágrafo como uma mensagem separada no WhatsApp, mas salva como uma entrada só no histórico", async () => {
  conversasService.buscarConversa.mockResolvedValueOnce({
    id: 1,
    cliente_id: 5,
    telefone: "5511999999999",
    push_name: "Ana",
    mensagens: [],
  });
  const res = criarRes();

  await enviarMensagem({ params: { clienteId: "5" }, body: { texto: "Parte 1\n\nParte 2" } }, res);

  expect(enviarMensagemWhatsapp).toHaveBeenCalledTimes(2);
  expect(enviarMensagemWhatsapp).toHaveBeenNthCalledWith(1, "5511999999999", "Parte 1");
  expect(enviarMensagemWhatsapp).toHaveBeenNthCalledWith(2, "5511999999999", "Parte 2");
  expect(conversasService.salvarHistorico).toHaveBeenCalledWith(5, "5511999999999", [
    { papel: "assistente", conteudo: "Parte 1\n\nParte 2" },
  ], "Ana");
});

test("devolve 404 quando a conversa não existe", async () => {
  conversasService.buscarConversa.mockResolvedValueOnce(null);
  const res = criarRes();

  await enviarMensagem({ params: { clienteId: "5" }, body: { texto: "oi" } }, res);

  expect(res.status).toHaveBeenCalledWith(404);
  expect(enviarMensagemWhatsapp).not.toHaveBeenCalled();
});
