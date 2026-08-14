import { jest } from "@jest/globals";

jest.unstable_mockModule("../clientes/clientes.service.js", () => ({
  atualizar: jest.fn().mockResolvedValue({ id: 2, nome: "Maria Silva" }),
}));

jest.unstable_mockModule("../agendamentos/agendamentos.service.js", () => ({
  criar: jest.fn().mockResolvedValue({ id: 1, status: "agendado", data_hora: "2026-01-10T10:00:00.000Z" }),
  atualizar: jest.fn().mockResolvedValue({ id: 10, status: "cancelado" }),
  buscarPorId: jest.fn(),
  listar: jest.fn().mockResolvedValue([]),
  horariosDisponiveis: jest.fn().mockResolvedValue([]),
}));

jest.unstable_mockModule("../servicos/servicos.service.js", () => ({
  listar: jest.fn().mockResolvedValue([]),
  buscarPorId: jest.fn().mockResolvedValue({ id: 5, duracao_minutos: 30 }),
}));

const agendamentosService = await import("../agendamentos/agendamentos.service.js");
const clientesService = await import("../clientes/clientes.service.js");
const { executarFerramenta, gerarInstrucaoSistema } = await import("./tools.js");

test("criarAgendamento ignora cliente_id vindo do modelo e usa o cliente da conversa", async () => {
  await executarFerramenta(2, "criarAgendamento", {
    cliente_id: 999,
    servico_id: 5,
    data_hora: "2026-01-10T10:00:00",
  });

  expect(agendamentosService.criar).toHaveBeenCalledWith(
    expect.objectContaining({ cliente_id: 2, duracao_minutos: 30 }),
  );
});

test("cancelarAgendamento recusa se o agendamento não pertence ao cliente da conversa", async () => {
  agendamentosService.buscarPorId.mockResolvedValueOnce({ id: 10, cliente_id: 999, status: "agendado" });

  const resultado = await executarFerramenta(2, "cancelarAgendamento", { agendamento_id: 10 });

  expect(resultado).toEqual({ erro: "Agendamento não encontrado" });
  expect(agendamentosService.atualizar).not.toHaveBeenCalled();
});

test("cancelarAgendamento funciona quando o agendamento pertence ao cliente da conversa", async () => {
  agendamentosService.buscarPorId.mockResolvedValueOnce({ id: 10, cliente_id: 2, status: "agendado" });

  const resultado = await executarFerramenta(2, "cancelarAgendamento", { agendamento_id: 10 });

  expect(resultado).toEqual({ id: 10, status: "cancelado" });
  expect(agendamentosService.atualizar).toHaveBeenCalledWith(10, { status: "cancelado" });
});

test("atualizarNomeCliente salva o nome informado pelo cliente da conversa", async () => {
  const resultado = await executarFerramenta(2, "atualizarNomeCliente", { nome: "Maria Silva" });

  expect(clientesService.atualizar).toHaveBeenCalledWith(2, { nome: "Maria Silva" });
  expect(resultado).toEqual({ id: 2, nome: "Maria Silva" });
});

test("ferramenta desconhecida gera erro", async () => {
  await expect(executarFerramenta(2, "ferramentaQueNaoExiste", {})).rejects.toThrow(
    "Ferramenta desconhecida: ferramentaQueNaoExiste",
  );
});

test("gerarInstrucaoSistema devolve só a base fora da primeira mensagem", () => {
  const resultado = gerarInstrucaoSistema({
    instrucaoBase: "base de teste",
    nome: "Rafaella",
    primeiraMensagem: false,
  });

  expect(resultado).toBe("base de teste");
});

test("gerarInstrucaoSistema pede pra confirmar o nome na primeira mensagem", () => {
  const resultado = gerarInstrucaoSistema({
    instrucaoBase: "base de teste",
    nome: "Rafaella",
    primeiraMensagem: true,
  });

  expect(resultado).toContain("base de teste");
  expect(resultado).toContain("Rafaella");
  expect(resultado).toContain("atualizarNomeCliente");
});

test("gerarInstrucaoSistema inclui o resumo do cliente quando fornecido", () => {
  const resultado = gerarInstrucaoSistema({
    instrucaoBase: "base de teste",
    resumoCliente: "Nome: Rafaella. Total de agendamentos já feitos: 3 (0 cancelado(s)).",
    primeiraMensagem: false,
  });

  expect(resultado).toContain("base de teste");
  expect(resultado).toContain("Total de agendamentos já feitos: 3");
});
