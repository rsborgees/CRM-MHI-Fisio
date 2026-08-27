import { jest } from "@jest/globals";

jest.unstable_mockModule("../agendamentos/agendamentos.service.js", () => ({
  listarParaLembrete: jest.fn(),
  marcarLembreteEnviado: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../atendimento-ia/evolutionApi.js", () => ({
  enviarMensagem: jest.fn().mockResolvedValue({}),
}));

const agendamentosService = await import("../agendamentos/agendamentos.service.js");
const { enviarMensagem } = await import("../atendimento-ia/evolutionApi.js");
const { enviarLembretesPendentes } = await import("./lembretes.service.js");

beforeEach(() => {
  jest.clearAllMocks();
});

function agendamento(overrides = {}) {
  return {
    id: 1,
    data_hora: "2026-08-27T13:00:00.000Z",
    clientes: { nome: "Juliana Andrade Souza", nome_confirmado: true, celular: "5511999999999", telefone: null },
    servicos: { nome: "Fisioterapia Ortopédica" },
    ...overrides,
  };
}

test("envia lembrete e marca como enviado para cada agendamento na janela de antecedência", async () => {
  agendamentosService.listarParaLembrete.mockResolvedValue([agendamento()]);

  const resultado = await enviarLembretesPendentes(60);

  expect(agendamentosService.listarParaLembrete).toHaveBeenCalledWith(60);
  expect(enviarMensagem).toHaveBeenCalledWith("5511999999999", expect.stringContaining("Juliana"));
  expect(enviarMensagem).toHaveBeenCalledWith("5511999999999", expect.stringContaining("Fisioterapia Ortopédica"));
  expect(agendamentosService.marcarLembreteEnviado).toHaveBeenCalledWith(1);
  expect(resultado).toEqual({ total: 1, enviados: 1 });
});

test("usa telefone fixo quando não há celular cadastrado", async () => {
  agendamentosService.listarParaLembrete.mockResolvedValue([
    agendamento({ clientes: { nome: "Ana", nome_confirmado: true, celular: null, telefone: "5511888888888" } }),
  ]);

  await enviarLembretesPendentes(60);

  expect(enviarMensagem).toHaveBeenCalledWith("5511888888888", expect.any(String));
});

test("pula agendamento sem nenhum telefone cadastrado", async () => {
  agendamentosService.listarParaLembrete.mockResolvedValue([
    agendamento({ clientes: { nome: "Ana", nome_confirmado: true, celular: null, telefone: null } }),
  ]);

  const resultado = await enviarLembretesPendentes(60);

  expect(enviarMensagem).not.toHaveBeenCalled();
  expect(agendamentosService.marcarLembreteEnviado).not.toHaveBeenCalled();
  expect(resultado).toEqual({ total: 1, enviados: 0 });
});

test("continua processando os demais quando o envio de um falha", async () => {
  agendamentosService.listarParaLembrete.mockResolvedValue([
    agendamento({ id: 1 }),
    agendamento({ id: 2, clientes: { nome: "Outro Cliente", nome_confirmado: true, celular: "5511777777777", telefone: null } }),
  ]);
  enviarMensagem.mockRejectedValueOnce(new Error("Evolution API fora do ar")).mockResolvedValueOnce({});

  const resultado = await enviarLembretesPendentes(60);

  expect(agendamentosService.marcarLembreteEnviado).not.toHaveBeenCalledWith(1);
  expect(agendamentosService.marcarLembreteEnviado).toHaveBeenCalledWith(2);
  expect(resultado).toEqual({ total: 2, enviados: 1 });
});

test("usa saudação genérica quando o nome do cliente ainda não foi confirmado", async () => {
  agendamentosService.listarParaLembrete.mockResolvedValue([
    agendamento({ clientes: { nome: "Cliente WhatsApp 5511999999999", nome_confirmado: false, celular: "5511999999999", telefone: null } }),
  ]);

  await enviarLembretesPendentes(60);

  const mensagem = enviarMensagem.mock.calls[0][1];
  expect(mensagem).not.toContain("Cliente WhatsApp");
  expect(mensagem.startsWith("Olá!")).toBe(true);
});
