import { jest } from "@jest/globals";

jest.unstable_mockModule("../clientes/clientes.service.js", () => ({
  buscarPorTelefone: jest.fn().mockResolvedValue({ id: 3, nome: "Ana" }),
  criar: jest.fn(),
}));

jest.unstable_mockModule("./conversas.service.js", () => ({
  carregarHistorico: jest.fn().mockResolvedValue([]),
  salvarHistorico: jest.fn().mockResolvedValue({}),
  estaPausado: jest.fn().mockResolvedValue(false),
}));

jest.unstable_mockModule("./zapi.js", () => ({
  enviarMensagem: jest.fn().mockResolvedValue({}),
}));

jest.unstable_mockModule("./configuracao.service.js", () => ({
  obterInstrucaoSistema: jest.fn().mockResolvedValue("instrucao base de teste"),
}));

jest.unstable_mockModule("./resumoCliente.js", () => ({
  gerarResumoCliente: jest.fn().mockResolvedValue("resumo de teste"),
}));

jest.unstable_mockModule("./tools.js", () => ({
  DEFINICOES_FERRAMENTAS: [],
  gerarInstrucaoSistema: jest.fn().mockReturnValue("instrucao de teste"),
  executarFerramenta: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.unstable_mockModule("./llmClient.js", () => ({
  gerarResposta: jest.fn(),
}));

const llmClient = await import("./llmClient.js");
const { enviarMensagem } = await import("./zapi.js");
const { carregarHistorico, salvarHistorico, estaPausado } = await import("./conversas.service.js");
const { processarMensagemRecebida } = await import("./webhook.controller.js");

beforeEach(() => {
  jest.clearAllMocks();
  // Reatribui um array novo a cada teste — o código faz historico.push(...) diretamente
  // no valor retornado, então reusar a mesma referência entre testes vaza estado.
  carregarHistorico.mockResolvedValue([]);
  estaPausado.mockResolvedValue(false);
});

test("responde direto quando o modelo não pede nenhuma ferramenta", async () => {
  llmClient.gerarResposta.mockResolvedValueOnce({ texto: "Olá! Como posso ajudar?", chamadasDeFerramenta: [] });

  const resultado = await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "oi" });

  expect(resultado).toBe("Olá! Como posso ajudar?");
  expect(enviarMensagem).toHaveBeenCalledWith("5511999999999", "Olá! Como posso ajudar?");
});

test("executa a ferramenta pedida e volta pro modelo antes de responder", async () => {
  llmClient.gerarResposta
    .mockResolvedValueOnce({
      texto: "",
      chamadasDeFerramenta: [{ id: "1", nome: "consultarServicosPrecos", argumentos: {} }],
    })
    .mockResolvedValueOnce({ texto: "Temos limpeza de pele por R$150.", chamadasDeFerramenta: [] });

  const resultado = await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "quais servicos?" });

  expect(resultado).toBe("Temos limpeza de pele por R$150.");
  expect(llmClient.gerarResposta).toHaveBeenCalledTimes(2);
});

test("usa mensagem de fallback quando o modelo nunca conclui dentro do limite de iterações", async () => {
  llmClient.gerarResposta.mockResolvedValue({
    texto: "",
    chamadasDeFerramenta: [{ id: "1", nome: "consultarServicosPrecos", argumentos: {} }],
  });

  const resultado = await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "oi" });

  expect(resultado).toBe(
    "Não consegui concluir sua solicitação agora, vou chamar alguém da recepção para te ajudar.",
  );
});

test("salva o histórico e responde com fallback mesmo quando o modelo de IA falha", async () => {
  llmClient.gerarResposta.mockRejectedValueOnce(new Error("API key not valid"));

  const resultado = await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "oi" });

  expect(resultado).toBe(
    "Estou com dificuldade técnica agora, por favor tente novamente em alguns minutos ou fale com a recepção.",
  );
  expect(salvarHistorico).toHaveBeenCalledWith(
    3,
    "5511999999999",
    expect.arrayContaining([
      { papel: "usuario", conteudo: "oi" },
      {
        papel: "assistente",
        conteudo:
          "Estou com dificuldade técnica agora, por favor tente novamente em alguns minutos ou fale com a recepção.",
      },
    ]),
    undefined,
  );
  expect(enviarMensagem).toHaveBeenCalledWith(
    "5511999999999",
    "Estou com dificuldade técnica agora, por favor tente novamente em alguns minutos ou fale com a recepção.",
  );
});

test("manda só as últimas 20 mensagens pro modelo, mas salva o histórico completo", async () => {
  const historicoAntigo = Array.from({ length: 25 }, (_, indice) => ({
    papel: indice % 2 === 0 ? "usuario" : "assistente",
    conteudo: `mensagem antiga ${indice}`,
  }));
  carregarHistorico.mockResolvedValueOnce(historicoAntigo);
  llmClient.gerarResposta.mockResolvedValueOnce({ texto: "resposta nova", chamadasDeFerramenta: [] });

  await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "mensagem nova" });

  const chamada = llmClient.gerarResposta.mock.calls[0][0];
  expect(chamada.mensagens).toHaveLength(20);
  expect(chamada.mensagens.at(-1)).toEqual({ papel: "usuario", conteudo: "mensagem nova" });
  expect(chamada.mensagens[0]).toEqual({ papel: "usuario", conteudo: "mensagem antiga 6" });

  const historicoSalvo = salvarHistorico.mock.calls[0][2];
  expect(historicoSalvo).toHaveLength(27);
});

test("não chama a IA nem responde quando a conversa está pausada, mas salva a mensagem", async () => {
  estaPausado.mockResolvedValueOnce(true);

  const resultado = await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "oi" });

  expect(resultado).toBeNull();
  expect(llmClient.gerarResposta).not.toHaveBeenCalled();
  expect(enviarMensagem).not.toHaveBeenCalled();
  expect(salvarHistorico).toHaveBeenCalledWith(
    3,
    "5511999999999",
    [{ papel: "usuario", conteudo: "oi" }],
    undefined,
  );
});
