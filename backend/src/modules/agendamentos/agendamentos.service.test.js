import { jest } from "@jest/globals";

const mockFindMany = jest.fn();
const mockCreate = jest.fn();
const mockUpdateManyClientes = jest.fn();
const mockServicoFindUniqueOrThrow = jest.fn();
const mockServicoFindUnique = jest.fn();

jest.unstable_mockModule("../../lib/prisma.js", () => ({
  prisma: {
    agendamentos: {
      findMany: mockFindMany,
      create: mockCreate,
    },
    clientes: {
      updateMany: mockUpdateManyClientes,
    },
    servicos: {
      findUniqueOrThrow: mockServicoFindUniqueOrThrow,
      findUnique: mockServicoFindUnique,
    },
  },
}));

const { criar, horariosDisponiveis, listarParaLembrete } = await import("./agendamentos.service.js");

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockResolvedValue({ id: 1, cliente_id: 2, data_hora: new Date("2026-08-19T11:00:00.000Z") });
  mockUpdateManyClientes.mockResolvedValue({});
});

test("criar recusa quando já existe um agendamento no mesmo horário, mesmo sem profissional informado", async () => {
  mockFindMany.mockResolvedValueOnce([
    { id: 37, data_hora: new Date("2026-08-19T11:00:00.000Z"), duracao_minutos: 30, profissional_id: null, status: "agendado" },
  ]);

  await expect(
    criar({ cliente_id: 2, servico_id: 5, data_hora: new Date("2026-08-19T11:00:00.000Z"), duracao_minutos: 30 }),
  ).rejects.toThrow(/já existe um agendamento/i);

  expect(mockCreate).not.toHaveBeenCalled();
});

test("criar funciona normalmente quando não há conflito de horário", async () => {
  mockFindMany.mockResolvedValueOnce([]);

  await criar({ cliente_id: 2, servico_id: 5, data_hora: new Date("2026-08-19T12:00:00.000Z"), duracao_minutos: 30 });

  expect(mockCreate).toHaveBeenCalled();
});

test("criar busca a duração real do serviço quando duracao_minutos não é informado (ex: tela de Agenda)", async () => {
  mockFindMany.mockResolvedValueOnce([]);
  mockServicoFindUnique.mockResolvedValueOnce({ id: 5, duracao_minutos: 30 });

  await criar({ cliente_id: 2, servico_id: 5, data_hora: new Date("2026-08-19T09:00:00.000-03:00") });

  expect(mockServicoFindUnique).toHaveBeenCalledWith({ where: { id: 5 } });
  expect(mockCreate).toHaveBeenCalledWith({
    data: expect.objectContaining({ duracao_minutos: 30 }),
  });
});

test("criar não bloqueia por engano quando o serviço real (30min) cabe antes do almoço, mesmo sem duracao_minutos informado (reproduz caso real: tela de Agenda sempre assumia 60min e bloqueava sem necessidade)", async () => {
  mockFindMany.mockResolvedValueOnce([]);
  mockServicoFindUnique.mockResolvedValueOnce({ id: 5, duracao_minutos: 30 });

  // 11h15 + 30min real = termina 11h45, antes do almoço (12h-13h). Com o padrão errado de
  // 60min, terminaria 12h15 e seria bloqueado à toa.
  await criar({ cliente_id: 2, servico_id: 5, data_hora: new Date("2026-08-19T11:15:00.000-03:00") });

  expect(mockCreate).toHaveBeenCalled();
});

test("criar usa o padrão de 60min pra checar conflito quando não há duracao_minutos nem servico_id", async () => {
  mockFindMany.mockResolvedValueOnce([]);

  // Sem servico_id pra consultar, cai no padrão de 60min — 11h30 + 60min invade o almoço.
  await expect(
    criar({ cliente_id: 2, data_hora: new Date("2026-08-19T11:30:00.000-03:00") }),
  ).rejects.toThrow(/almoço/i);

  expect(mockServicoFindUnique).not.toHaveBeenCalled();
});

test("criar recusa agendamento no horário de almoço (12h às 13h), mesmo sem nenhum outro agendamento conflitante", async () => {
  // não enfileira mockFindMany: o bloqueio do almoço acontece antes de consultar conflitos
  // no banco, então prisma.agendamentos.findMany nem chega a ser chamado.
  await expect(
    criar({ cliente_id: 2, servico_id: 5, data_hora: new Date("2026-08-19T12:00:00.000-03:00"), duracao_minutos: 30 }),
  ).rejects.toThrow(/almoço/i);

  expect(mockCreate).not.toHaveBeenCalled();
});

test("criar recusa agendamento que começa antes do almoço mas invade o horário (ex: 11:30 com 60min)", async () => {
  await expect(
    criar({ cliente_id: 2, servico_id: 5, data_hora: new Date("2026-08-19T11:30:00.000-03:00"), duracao_minutos: 60 }),
  ).rejects.toThrow(/almoço/i);

  expect(mockCreate).not.toHaveBeenCalled();
});

test("horariosDisponiveis exclui horários já ocupados mesmo sem profissional informado", async () => {
  mockServicoFindUniqueOrThrow.mockResolvedValueOnce({ duracao_minutos: 60 });
  mockFindMany.mockResolvedValueOnce([
    { id: 37, data_hora: new Date("2026-08-19T11:00:00.000-03:00"), duracao_minutos: 60, profissional_id: null, status: "agendado" },
  ]);

  const horarios = await horariosDisponiveis({ servico_id: 5, data: "2026-08-19" });

  const ocupado = horarios.some((h) => new Date(h).toISOString() === new Date("2026-08-19T11:00:00.000-03:00").toISOString());
  expect(ocupado).toBe(false);
});

test("listarParaLembrete busca agendamentos ativos, sem lembrete enviado, dentro da janela de antecedência", async () => {
  mockFindMany.mockResolvedValueOnce([]);

  await listarParaLembrete(60);

  expect(mockFindMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        status: { not: "cancelado" },
        lembrete_enviado: false,
        data_hora: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
      }),
    }),
  );

  const { data_hora } = mockFindMany.mock.calls[0][0].where;
  const diferencaMinutos = (data_hora.lte.getTime() - data_hora.gte.getTime()) / 60000;
  expect(diferencaMinutos).toBeCloseTo(60, 1);
});
