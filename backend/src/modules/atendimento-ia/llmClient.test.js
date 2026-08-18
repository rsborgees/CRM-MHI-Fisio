import { jest } from "@jest/globals";

const mockCreate = jest.fn();

jest.unstable_mockModule("openai", () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

const { gerarResposta } = await import("./llmClient.js");

const FERRAMENTAS = [
  { nome: "criarAgendamento", descricao: "Cria um agendamento", parametros: { type: "object", properties: {} } },
];

beforeEach(() => {
  jest.clearAllMocks();
});

test("gerarResposta usa tool_calls normalmente quando o modelo os retorna no formato correto", async () => {
  mockCreate.mockResolvedValueOnce({
    choices: [
      {
        message: {
          content: null,
          tool_calls: [{ id: "1", function: { name: "criarAgendamento", arguments: '{"data_hora":"2026-01-10"}' } }],
        },
      },
    ],
  });

  const resultado = await gerarResposta({ mensagens: [], ferramentas: FERRAMENTAS, instrucaoSistema: "instrucao" });

  expect(resultado.chamadasDeFerramenta).toEqual([
    { id: "1", nome: "criarAgendamento", argumentos: { data_hora: "2026-01-10" } },
  ]);
});

test("gerarResposta recupera chamada de ferramenta escrita como JSON solto no texto (modelos que não usam tool_calls)", async () => {
  mockCreate.mockResolvedValueOnce({
    choices: [
      {
        message: {
          content:
            '{"name": "criarAgendamento", "arguments": {"nome_servico": "Depilação a laser", "data_hora": "2026-08-18T10:00:00"}}',
          tool_calls: [],
        },
      },
    ],
  });

  const resultado = await gerarResposta({ mensagens: [], ferramentas: FERRAMENTAS, instrucaoSistema: "instrucao" });

  expect(resultado.chamadasDeFerramenta).toHaveLength(1);
  expect(resultado.chamadasDeFerramenta[0].nome).toBe("criarAgendamento");
  expect(resultado.chamadasDeFerramenta[0].argumentos).toEqual({
    nome_servico: "Depilação a laser",
    data_hora: "2026-08-18T10:00:00",
  });
});

test("gerarResposta ignora texto solto que não corresponde a nenhuma ferramenta conhecida", async () => {
  mockCreate.mockResolvedValueOnce({
    choices: [{ message: { content: "Olá! Como posso ajudar?", tool_calls: [] } }],
  });

  const resultado = await gerarResposta({ mensagens: [], ferramentas: FERRAMENTAS, instrucaoSistema: "instrucao" });

  expect(resultado.chamadasDeFerramenta).toEqual([]);
  expect(resultado.texto).toBe("Olá! Como posso ajudar?");
});

test("gerarResposta extrai a chamada de ferramenta mesmo quando há prosa antes do JSON", async () => {
  mockCreate.mockResolvedValueOnce({
    choices: [
      {
        message: {
          content:
            'Aguarde um momento, vou verificar.\n\n{"name": "criarAgendamento", "arguments": {"nome_servico": "Depilação a Laser", "data_hora": "2026-08-18T10:00:00"}}',
          tool_calls: [],
        },
      },
    ],
  });

  const resultado = await gerarResposta({ mensagens: [], ferramentas: FERRAMENTAS, instrucaoSistema: "instrucao" });

  expect(resultado.chamadasDeFerramenta).toHaveLength(1);
  expect(resultado.chamadasDeFerramenta[0].nome).toBe("criarAgendamento");
  expect(resultado.chamadasDeFerramenta[0].argumentos).toEqual({
    nome_servico: "Depilação a Laser",
    data_hora: "2026-08-18T10:00:00",
  });
});

test("gerarResposta nunca devolve pro cliente um bloco JSON solto que sobrou no texto", async () => {
  mockCreate.mockResolvedValueOnce({
    choices: [
      {
        message: {
          content:
            'Desculpe, não há esse horário disponível.\n\nEla quer outro horário\n\n{"name": "ferramentaQueNaoExiste", "arguments": {"x": 1}}',
          tool_calls: [],
        },
      },
    ],
  });

  const resultado = await gerarResposta({ mensagens: [], ferramentas: FERRAMENTAS, instrucaoSistema: "instrucao" });

  expect(resultado.chamadasDeFerramenta).toEqual([]);
  expect(resultado.texto).not.toContain("{");
  expect(resultado.texto).toContain("Desculpe, não há esse horário disponível.");
});
