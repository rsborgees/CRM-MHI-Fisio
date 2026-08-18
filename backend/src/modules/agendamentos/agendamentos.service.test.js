import { jest } from "@jest/globals";

const mockFindMany = jest.fn();
const mockCreate = jest.fn();
const mockUpdateManyClientes = jest.fn();
const mockServicoFindUniqueOrThrow = jest.fn();

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
    },
  },
}));

const { criar, horariosDisponiveis } = await import("./agendamentos.service.js");

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

test("horariosDisponiveis exclui horários já ocupados mesmo sem profissional informado", async () => {
  mockServicoFindUniqueOrThrow.mockResolvedValueOnce({ duracao_minutos: 60 });
  mockFindMany.mockResolvedValueOnce([
    { id: 37, data_hora: new Date("2026-08-19T11:00:00.000-03:00"), duracao_minutos: 60, profissional_id: null, status: "agendado" },
  ]);

  const horarios = await horariosDisponiveis({ servico_id: 5, data: "2026-08-19" });

  const ocupado = horarios.some((h) => new Date(h).toISOString() === new Date("2026-08-19T11:00:00.000-03:00").toISOString());
  expect(ocupado).toBe(false);
});
