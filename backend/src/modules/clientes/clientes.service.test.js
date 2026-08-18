import { jest } from "@jest/globals";

const mockAgendamentosFindMany = jest.fn();
const mockAgendamentosDeleteMany = jest.fn();
const mockPagamentosDeleteMany = jest.fn();
const mockAvaliacoesDeleteMany = jest.fn();
const mockHistoricoDeleteMany = jest.fn();
const mockConversasDeleteMany = jest.fn();
const mockClientesDelete = jest.fn();

const tx = {
  agendamentos: { findMany: mockAgendamentosFindMany, deleteMany: mockAgendamentosDeleteMany },
  pagamentos: { deleteMany: mockPagamentosDeleteMany },
  avaliacoes: { deleteMany: mockAvaliacoesDeleteMany },
  historico_clientes: { deleteMany: mockHistoricoDeleteMany },
  conversas_whatsapp: { deleteMany: mockConversasDeleteMany },
  clientes: { delete: mockClientesDelete },
};

const mockTransaction = jest.fn((callback) => callback(tx));

jest.unstable_mockModule("../../lib/prisma.js", () => ({
  prisma: { $transaction: mockTransaction },
}));

const { remover } = await import("./clientes.service.js");

beforeEach(() => {
  jest.clearAllMocks();
  mockAgendamentosFindMany.mockResolvedValue([]);
});

test("ao excluir um cliente, remove em cascata pagamentos, avaliações, histórico, conversas e agendamentos antes do cliente", async () => {
  mockAgendamentosFindMany.mockResolvedValueOnce([{ id: 10 }, { id: 11 }]);

  await remover(5);

  expect(mockPagamentosDeleteMany).toHaveBeenCalledWith({
    where: { OR: [{ cliente_id: 5 }, { agendamento_id: { in: [10, 11] } }] },
  });
  expect(mockAvaliacoesDeleteMany).toHaveBeenCalledWith({
    where: { OR: [{ cliente_id: 5 }, { agendamento_id: { in: [10, 11] } }] },
  });
  expect(mockHistoricoDeleteMany).toHaveBeenCalledWith({ where: { cliente_id: 5 } });
  expect(mockConversasDeleteMany).toHaveBeenCalledWith({ where: { cliente_id: 5 } });
  expect(mockAgendamentosDeleteMany).toHaveBeenCalledWith({ where: { cliente_id: 5 } });
  expect(mockClientesDelete).toHaveBeenCalledWith({ where: { id: 5 } });
});

test("ao excluir um cliente sem nenhum agendamento, ainda remove pagamentos/avaliações vinculados só pelo cliente_id", async () => {
  mockAgendamentosFindMany.mockResolvedValueOnce([]);

  await remover(7);

  expect(mockPagamentosDeleteMany).toHaveBeenCalledWith({
    where: { OR: [{ cliente_id: 7 }, { agendamento_id: { in: [] } }] },
  });
  expect(mockClientesDelete).toHaveBeenCalledWith({ where: { id: 7 } });
});
