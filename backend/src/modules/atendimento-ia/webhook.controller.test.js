import { jest } from "@jest/globals";

// Delay zero pro debounce de "mensagens picotadas" — nos testes não tem por que esperar de
// verdade; o mecanismo de cancelar/reagendar timer funciona igual não importa a duração.
process.env.DEBOUNCE_MENSAGENS_MS = "0";

jest.unstable_mockModule("../clientes/clientes.service.js", () => ({
  buscarPorTelefone: jest.fn().mockResolvedValue({ id: 3, nome: "Ana" }),
  criar: jest.fn(),
}));

jest.unstable_mockModule("./conversas.service.js", () => ({
  carregarHistorico: jest.fn().mockResolvedValue([]),
  salvarHistorico: jest.fn().mockResolvedValue({}),
  estaPausado: jest.fn().mockResolvedValue(false),
}));

jest.unstable_mockModule("./evolutionApi.js", () => ({
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
  formatarHoraLocal: jest.fn().mockReturnValue("10h"),
  formatarDataCompletaLocal: jest.fn().mockReturnValue("sexta-feira, 28/08"),
}));

jest.unstable_mockModule("./llmClient.js", () => ({
  gerarResposta: jest.fn(),
}));

const llmClient = await import("./llmClient.js");
const { enviarMensagem } = await import("./evolutionApi.js");
const { carregarHistorico, salvarHistorico, estaPausado } = await import("./conversas.service.js");
const { executarFerramenta } = await import("./tools.js");
const { processarMensagemRecebida, handleWebhook } = await import("./webhook.controller.js");

function criarRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

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

test("converte negrito estilo Markdown (**texto**) pro formato do WhatsApp (*texto*)", async () => {
  llmClient.gerarResposta
    .mockResolvedValueOnce({
      texto: "não deveria ser usado",
      chamadasDeFerramenta: [{ id: "1", nome: "consultarServicosPrecos", argumentos: {} }],
    })
    .mockResolvedValueOnce({ texto: "Temos **Sessão de Fisioterapia** por R$250.", chamadasDeFerramenta: [] });

  await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "quais servicos?" });

  expect(enviarMensagem).toHaveBeenCalledWith("5511999999999", "Temos *Sessão de Fisioterapia* por R$250.");
});

test("manda cada parágrafo da resposta como uma mensagem separada no WhatsApp, em vez de uma só com quebras de linha", async () => {
  llmClient.gerarResposta
    .mockResolvedValueOnce({
      texto: "não deveria ser usado",
      chamadasDeFerramenta: [{ id: "1", nome: "consultarHorariosDisponiveis", argumentos: { data: "2026-08-18" } }],
    })
    .mockResolvedValueOnce({
      texto: "Para depilação a laser, no dia amanhã, temos os horários 12h e 13h disponíveis.\n\nQuer agendar algum desses?",
      chamadasDeFerramenta: [],
    });

  const resultado = await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "tem horário amanhã?" });

  expect(resultado).toContain("Quer agendar algum desses?");
  expect(enviarMensagem).toHaveBeenCalledTimes(2);
  expect(enviarMensagem).toHaveBeenNthCalledWith(
    1,
    "5511999999999",
    "Para depilação a laser, no dia amanhã, temos os horários 12h e 13h disponíveis.",
  );
  expect(enviarMensagem).toHaveBeenNthCalledWith(2, "5511999999999", "Quer agendar algum desses?");
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
  carregarHistorico.mockResolvedValue(historicoAntigo);
  llmClient.gerarResposta.mockResolvedValueOnce({ texto: "resposta nova", chamadasDeFerramenta: [] });

  await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "mensagem nova" });

  const chamada = llmClient.gerarResposta.mock.calls[0][0];
  expect(chamada.mensagens).toHaveLength(20);
  expect(chamada.mensagens.at(-1)).toEqual({ papel: "usuario", conteudo: "mensagem nova" });
  expect(chamada.mensagens[0]).toEqual({ papel: "usuario", conteudo: "mensagem antiga 6" });

  const historicoSalvo = salvarHistorico.mock.calls.at(-1)[2];
  expect(historicoSalvo).toHaveLength(27);
});

test("handleWebhook ignora eventos que não são messages.upsert", async () => {
  const res = criarRes();

  await handleWebhook({ body: { event: "connection.update", data: {} } }, res);

  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({ status: "ignorado" });
  expect(llmClient.gerarResposta).not.toHaveBeenCalled();
});

test("handleWebhook ignora mensagem de grupo", async () => {
  const res = criarRes();

  await handleWebhook(
    {
      body: {
        event: "messages.upsert",
        data: {
          key: { remoteJid: "120363000000000000@g.us", fromMe: false, id: "1" },
          pushName: "Ana",
          message: { conversation: "oi" },
        },
      },
    },
    res,
  );

  expect(res.json).toHaveBeenCalledWith({ status: "ignorado" });
  expect(llmClient.gerarResposta).not.toHaveBeenCalled();
});

test("handleWebhook ignora eco de mensagem enviada pela própria clínica", async () => {
  const res = criarRes();

  await handleWebhook(
    {
      body: {
        event: "messages.upsert",
        data: {
          key: { remoteJid: "5511999999999@s.whatsapp.net", fromMe: true, id: "1" },
          pushName: "Ana",
          message: { conversation: "oi" },
        },
      },
    },
    res,
  );

  expect(res.json).toHaveBeenCalledWith({ status: "ignorado" });
  expect(llmClient.gerarResposta).not.toHaveBeenCalled();
});

test("handleWebhook extrai telefone e texto de uma mensagem simples e processa normalmente", async () => {
  llmClient.gerarResposta.mockResolvedValueOnce({ texto: "Olá!", chamadasDeFerramenta: [] });
  const res = criarRes();

  await handleWebhook(
    {
      body: {
        event: "messages.upsert",
        data: {
          key: { remoteJid: "5511999999999@s.whatsapp.net", fromMe: false, id: "1" },
          pushName: "Ana",
          message: { conversation: "oi" },
        },
      },
    },
    res,
  );

  expect(enviarMensagem).toHaveBeenCalledWith("5511999999999", "Olá!");
  expect(res.json).toHaveBeenCalledWith({ status: "ok" });
});

test("handleWebhook extrai texto de extendedTextMessage", async () => {
  llmClient.gerarResposta.mockResolvedValueOnce({ texto: "Olá!", chamadasDeFerramenta: [] });
  const res = criarRes();

  await handleWebhook(
    {
      body: {
        event: "messages.upsert",
        data: {
          key: { remoteJid: "5511999999999@s.whatsapp.net", fromMe: false, id: "1" },
          pushName: "Ana",
          message: { extendedTextMessage: { text: "oi, tudo bem?" } },
        },
      },
    },
    res,
  );

  expect(enviarMensagem).toHaveBeenCalledWith("5511999999999", "Olá!");
  expect(res.json).toHaveBeenCalledWith({ status: "ok" });
});

test("handleWebhook ignora mensagem sem texto (ex: áudio, imagem sem legenda)", async () => {
  const res = criarRes();

  await handleWebhook(
    {
      body: {
        event: "messages.upsert",
        data: {
          key: { remoteJid: "5511999999999@s.whatsapp.net", fromMe: false, id: "1" },
          pushName: "Ana",
          message: { audioMessage: {} },
        },
      },
    },
    res,
  );

  expect(res.json).toHaveBeenCalledWith({ status: "ignorado" });
  expect(llmClient.gerarResposta).not.toHaveBeenCalled();
});

test("quando o agendamento é criado com sucesso, a confirmação é montada pelo backend (não pela IA)", async () => {
  llmClient.gerarResposta.mockResolvedValueOnce({
    texto: "não deveria ser usado",
    chamadasDeFerramenta: [
      {
        id: "1",
        nome: "criarAgendamento",
        argumentos: { nome_servico: "Sessão de Fisioterapia", data_hora: "2026-08-18T10:00:00" },
      },
    ],
  });
  executarFerramenta.mockResolvedValueOnce({
    id: 1,
    status: "agendado",
    data_hora: "2026-08-18T13:00:00.000Z",
    servico: "Sessão de Fisioterapia",
  });

  const resultado = await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "quero agendar" });

  expect(resultado).toContain("Sessão de Fisioterapia");
  expect(resultado).not.toBe("não deveria ser usado");
  expect(llmClient.gerarResposta).toHaveBeenCalledTimes(1);
});

test("confirmação de criarAgendamento usa o template com emoji, nome, dia, hora e preço reais", async () => {
  llmClient.gerarResposta.mockResolvedValueOnce({
    texto: "não deveria ser usado",
    chamadasDeFerramenta: [
      { id: "1", nome: "criarAgendamento", argumentos: { nome_servico: "RPG", data_hora: "2026-08-28T09:00:00" } },
    ],
  });
  executarFerramenta.mockResolvedValueOnce({
    id: 1,
    status: "agendado",
    data_hora: "2026-08-28T12:00:00.000Z",
    servico: "RPG",
    preco: "120",
    nome_cliente: "Juliana Andrade Souza",
  });

  const resultado = await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "quero agendar" });

  expect(resultado).toBe(
    "Perfeito, Juliana! 💙 Seu agendamento está confirmado:\n" +
      "📅 sexta-feira, 28/08\n" +
      "🕗 10h\n" +
      "🩺 RPG\n" +
      "💰 R$ 120\n" +
      "Esperamos você na MHI Fisio! 😊",
  );
});

test("confirmação de criarAgendamento não quebra sem nome ou preço (mocks parciais)", async () => {
  llmClient.gerarResposta.mockResolvedValueOnce({
    texto: "não deveria ser usado",
    chamadasDeFerramenta: [
      { id: "1", nome: "criarAgendamento", argumentos: { nome_servico: "RPG", data_hora: "2026-08-28T09:00:00" } },
    ],
  });
  executarFerramenta.mockResolvedValueOnce({ id: 1, status: "agendado", data_hora: "2026-08-28T12:00:00.000Z", servico: "RPG" });

  const resultado = await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "quero agendar" });

  expect(resultado).toBe(
    "Perfeito! 💙 Seu agendamento está confirmado:\n📅 sexta-feira, 28/08\n🕗 10h\n🩺 RPG\nEsperamos você na MHI Fisio! 😊",
  );
});

test("pede correção quando a IA confirma um agendamento sem chamar a ferramenta, e usa a confirmação determinística da chamada real que vem depois", async () => {
  llmClient.gerarResposta
    .mockResolvedValueOnce({ texto: "Sua depilação a laser foi agendada com sucesso!", chamadasDeFerramenta: [] })
    .mockResolvedValueOnce({
      texto: "não deveria ser usado",
      chamadasDeFerramenta: [
        { id: "1", nome: "criarAgendamento", argumentos: { nome_servico: "Sessão de Fisioterapia", data_hora: "2026-08-18T10:00:00" } },
      ],
    });
  executarFerramenta.mockResolvedValueOnce({
    id: 1,
    status: "agendado",
    data_hora: "2026-08-18T13:00:00.000Z",
    servico: "Sessão de Fisioterapia",
  });

  const resultado = await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "quero agendar" });

  expect(resultado).toContain("Sessão de Fisioterapia");
  expect(llmClient.gerarResposta).toHaveBeenCalledTimes(2);
});

test("pede correção quando criarAgendamento falha (ex: profissional ambíguo) mas a IA confirma sucesso mesmo assim (reproduz caso real)", async () => {
  llmClient.gerarResposta
    .mockResolvedValueOnce({
      texto: "não deveria ser usado",
      chamadasDeFerramenta: [
        { id: "1", nome: "criarAgendamento", argumentos: { nome_servico: "Sessão de Fisioterapia", data_hora: "2026-08-19T15:00:00" } },
      ],
    })
    .mockResolvedValueOnce({
      texto: "Fechado, ficou pra amanhã às 15h, depilação a laser.",
      chamadasDeFerramenta: [],
    })
    .mockResolvedValueOnce({
      texto: "não deveria ser usado",
      chamadasDeFerramenta: [
        {
          id: "2",
          nome: "criarAgendamento",
          argumentos: { nome_servico: "Sessão de Fisioterapia", data_hora: "2026-08-19T15:00:00", nome_profissional: "Larissa" },
        },
      ],
    });
  executarFerramenta
    .mockResolvedValueOnce({ erro: "Mais de uma profissional atende Sessão de Fisioterapia. Pergunte ao cliente..." })
    .mockResolvedValueOnce({ id: 1, status: "agendado", data_hora: "2026-08-19T18:00:00.000Z", servico: "Sessão de Fisioterapia" });

  const resultado = await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "quero agendar" });

  expect(resultado).not.toBe("Fechado, ficou pra amanhã às 15h, depilação a laser.");
  expect(resultado).toContain("Sessão de Fisioterapia");
  expect(llmClient.gerarResposta).toHaveBeenCalledTimes(3);
});

test("pede correção quando a IA diz que registrou o nome do cliente sem chamar atualizarNomeCliente", async () => {
  llmClient.gerarResposta
    .mockResolvedValueOnce({ texto: "Ok! Cliente registrado como Fernanda Costa Lima.", chamadasDeFerramenta: [] })
    .mockResolvedValueOnce({
      texto: "não deveria ser usado",
      chamadasDeFerramenta: [{ id: "1", nome: "atualizarNomeCliente", argumentos: { nome: "Fernanda Costa Lima" } }],
    })
    .mockResolvedValueOnce({ texto: "Prontinho, nome salvo!", chamadasDeFerramenta: [] });
  executarFerramenta.mockResolvedValueOnce({ id: 3, nome: "Fernanda Costa Lima" });

  const resultado = await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "Meu nome é Fernanda Costa Lima" });

  expect(resultado).toBe("Prontinho, nome salvo!");
  expect(llmClient.gerarResposta).toHaveBeenCalledTimes(3);
});

test("pede correção quando a IA diz 'realizado com sucesso' sem chamar a ferramenta (variação de palavra não coberta antes)", async () => {
  llmClient.gerarResposta
    .mockResolvedValueOnce({ texto: "Agendamento realizado com sucesso: RPG às 16h.", chamadasDeFerramenta: [] })
    .mockResolvedValueOnce({
      texto: "não deveria ser usado",
      chamadasDeFerramenta: [
        { id: "1", nome: "criarAgendamento", argumentos: { nome_servico: "RPG", data_hora: "2026-08-17T16:00:00" } },
      ],
    });
  executarFerramenta.mockResolvedValueOnce({
    id: 1,
    status: "agendado",
    data_hora: "2026-08-17T19:00:00.000Z",
    servico: "RPG",
  });

  const resultado = await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "quero agendar" });

  expect(resultado).toContain("RPG");
  expect(llmClient.gerarResposta).toHaveBeenCalledTimes(2);
});

test("pede correção quando a IA diz 'Fechado!' sem chamar a ferramenta (variação de palavra não coberta antes)", async () => {
  llmClient.gerarResposta
    .mockResolvedValueOnce({
      texto: "Fechado! Seu horário ficou para amanhã, dia 19/08, às 9h, para RPG. 😊 Te esperamos aqui!",
      chamadasDeFerramenta: [],
    })
    .mockResolvedValueOnce({
      texto: "não deveria ser usado",
      chamadasDeFerramenta: [
        { id: "1", nome: "criarAgendamento", argumentos: { nome_servico: "RPG", data_hora: "2026-08-19T09:00:00" } },
      ],
    });
  executarFerramenta.mockResolvedValueOnce({
    id: 1,
    status: "agendado",
    data_hora: "2026-08-19T12:00:00.000Z",
    servico: "RPG",
  });

  const resultado = await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "quero agendar" });

  expect(resultado).toContain("RPG");
  expect(llmClient.gerarResposta).toHaveBeenCalledTimes(2);
});

test("devolve mensagem segura (não a confirmação fabricada) quando a IA insiste em confirmar sem ferramenta mesmo após o aviso", async () => {
  llmClient.gerarResposta
    .mockResolvedValueOnce({ texto: "Sua depilação a laser foi agendada!", chamadasDeFerramenta: [] })
    .mockResolvedValueOnce({ texto: "Confirmado, já está no sistema!", chamadasDeFerramenta: [] });

  const resultado = await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "quero agendar" });

  expect(resultado).not.toContain("Confirmado, já está no sistema!");
  expect(llmClient.gerarResposta).toHaveBeenCalledTimes(2);
});

test("pede correção quando a IA nega disponibilidade sem consultar horários, e aceita a resposta real que vem depois", async () => {
  llmClient.gerarResposta
    .mockResolvedValueOnce({ texto: "Infelizmente não há disponibilidade nesse horário.", chamadasDeFerramenta: [] })
    .mockResolvedValueOnce({
      texto: "",
      chamadasDeFerramenta: [{ id: "1", nome: "consultarHorariosDisponiveis", argumentos: { data: "2026-08-17" } }],
    })
    .mockResolvedValueOnce({ texto: "Temos sim horário às 16h hoje!", chamadasDeFerramenta: [] });

  const resultado = await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "tem horário hoje?" });

  expect(resultado).toBe("Temos sim horário às 16h hoje!");
  expect(llmClient.gerarResposta).toHaveBeenCalledTimes(3);
});

test("pede correção quando a IA diz 'não está disponível' e inventa outros horários sem consultar (variação de frase não coberta antes)", async () => {
  llmClient.gerarResposta
    .mockResolvedValueOnce({
      texto: "Esse horário não está disponível. Mas tenho 14h e 15h, algum desses funciona?",
      chamadasDeFerramenta: [],
    })
    .mockResolvedValueOnce({
      texto: "",
      chamadasDeFerramenta: [{ id: "1", nome: "consultarHorariosDisponiveis", argumentos: { data: "2026-08-21" } }],
    })
    .mockResolvedValueOnce({ texto: "Temos 15h e 17h disponíveis nessa sexta.", chamadasDeFerramenta: [] });

  const resultado = await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "queria as 16h, nao tem?" });

  expect(resultado).toBe("Temos 15h e 17h disponíveis nessa sexta.");
  expect(llmClient.gerarResposta).toHaveBeenCalledTimes(3);
});

test("pede correção quando a IA oferece horários específicos sem nunca ter consultado a disponibilidade (reproduz caso real)", async () => {
  llmClient.gerarResposta
    .mockResolvedValueOnce({
      texto: "não deveria ser usado",
      chamadasDeFerramenta: [{ id: "0", nome: "consultarServicosPrecos", argumentos: {} }],
    })
    .mockResolvedValueOnce({
      texto: "A RPG custa R$ 160 e dura cerca de 45 minutos.\n\nPara amanhã tenho 9h e 14h disponíveis, qual fica melhor?",
      chamadasDeFerramenta: [],
    })
    .mockResolvedValueOnce({
      texto: "não deveria ser usado",
      chamadasDeFerramenta: [{ id: "1", nome: "consultarHorariosDisponiveis", argumentos: { data: "2026-08-19" } }],
    })
    .mockResolvedValueOnce({ texto: "Amanhã temos 8h e 9h disponíveis, qual fica melhor?", chamadasDeFerramenta: [] });
  executarFerramenta.mockResolvedValueOnce({ servicos: [] }).mockResolvedValueOnce({ horarios: [], total_disponivel: 0 });

  const resultado = await processarMensagemRecebida({
    telefone: "5511999999999",
    mensagem: "Quero fazer radiofrequência facial",
  });

  expect(resultado).toBe("Amanhã temos 8h e 9h disponíveis, qual fica melhor?");
  expect(llmClient.gerarResposta).toHaveBeenCalledTimes(4);
});

test("pede correção quando a IA informa um preço sem nunca ter consultado consultarServicosPrecos", async () => {
  llmClient.gerarResposta
    .mockResolvedValueOnce({
      texto: "O procedimento custa R$ 350 e a sessão dura cerca de 60 minutos.",
      chamadasDeFerramenta: [],
    })
    .mockResolvedValueOnce({
      texto: "não deveria ser usado",
      chamadasDeFerramenta: [{ id: "1", nome: "consultarServicosPrecos", argumentos: {} }],
    })
    .mockResolvedValueOnce({ texto: "O procedimento custa R$ 160 e dura cerca de 45 minutos.", chamadasDeFerramenta: [] });
  executarFerramenta.mockResolvedValueOnce({ servicos: [] });

  const resultado = await processarMensagemRecebida({
    telefone: "5511999999999",
    mensagem: "Quero fazer radiofrequência facial",
  });

  expect(resultado).toBe("O procedimento custa R$ 160 e dura cerca de 45 minutos.");
  expect(llmClient.gerarResposta).toHaveBeenCalledTimes(3);
});

test("não bloqueia quando a IA menciona um único horário confirmando o que o próprio cliente pediu", async () => {
  llmClient.gerarResposta.mockResolvedValueOnce({
    texto: "Perfeito, então às 15h fica ótimo!",
    chamadasDeFerramenta: [],
  });

  const resultado = await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "pode ser às 15h" });

  expect(resultado).toBe("Perfeito, então às 15h fica ótimo!");
  expect(llmClient.gerarResposta).toHaveBeenCalledTimes(1);
});

test("não bloqueia quando a IA nega disponibilidade depois de realmente ter consultado horários", async () => {
  llmClient.gerarResposta
    .mockResolvedValueOnce({
      texto: "",
      chamadasDeFerramenta: [{ id: "1", nome: "consultarHorariosDisponiveis", argumentos: { data: "2026-08-17" } }],
    })
    .mockResolvedValueOnce({ texto: "Infelizmente não há disponibilidade hoje.", chamadasDeFerramenta: [] });

  const resultado = await processarMensagemRecebida({ telefone: "5511999999999", mensagem: "tem horário hoje?" });

  expect(resultado).toBe("Infelizmente não há disponibilidade hoje.");
  expect(llmClient.gerarResposta).toHaveBeenCalledTimes(2);
});

test("junta mensagens picotadas (mandadas em sequência) numa única resposta, em vez de responder a cada pedaço", async () => {
  llmClient.gerarResposta.mockResolvedValueOnce({
    texto: "Oi! RPG pra amanhã de manhã, já vejo os horários pra você.",
    chamadasDeFerramenta: [],
  });

  // as três chegam "picotadas" (uma logo depois da outra, antes de qualquer resposta) — só a
  // ÚLTIMA chamada deve de fato disparar a IA, com o histórico das três já salvo.
  const p1 = processarMensagemRecebida({ telefone: "5511999999999", mensagem: "oi" });
  const p2 = processarMensagemRecebida({ telefone: "5511999999999", mensagem: "queria fazer radiofrequência facial" });
  const p3 = processarMensagemRecebida({ telefone: "5511999999999", mensagem: "pra amanhã de manhã" });

  const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

  // as três chamadas resolvem pra mesma resposta final (a que realmente foi enviada ao cliente).
  expect(r1).toBe(r2);
  expect(r2).toBe(r3);
  expect(llmClient.gerarResposta).toHaveBeenCalledTimes(1);
  expect(enviarMensagem).toHaveBeenCalledTimes(1);

  const mensagensEnviadasAoModelo = llmClient.gerarResposta.mock.calls[0][0].mensagens;
  expect(mensagensEnviadasAoModelo).toEqual([
    { papel: "usuario", conteudo: "oi" },
    { papel: "usuario", conteudo: "queria fazer radiofrequência facial" },
    { papel: "usuario", conteudo: "pra amanhã de manhã" },
  ]);

  const historicoSalvoFinal = salvarHistorico.mock.calls.at(-1)[2];
  expect(historicoSalvoFinal).toHaveLength(4);
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
