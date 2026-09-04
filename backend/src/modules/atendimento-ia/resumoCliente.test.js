import { jest } from "@jest/globals";

jest.unstable_mockModule("../agendamentos/agendamentos.service.js", () => ({
  listar: jest.fn(),
}));

const agendamentosService = await import("../agendamentos/agendamentos.service.js");
const { gerarResumoCliente } = await import("./resumoCliente.js");

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date("2026-01-15T12:00:00"));
});

afterEach(() => {
  jest.useRealTimers();
});

test("descreve cliente novo sem agendamentos", async () => {
  agendamentosService.listar.mockResolvedValueOnce([]);

  const resumo = await gerarResumoCliente({
    id: 1,
    nome: "Maria",
    status: "novo_contato",
    data_cadastro: "2026-01-15T10:00:00",
  });

  expect(resumo).toContain("Maria");
  expect(resumo).toContain("Primeira interação");
  expect(resumo).toContain("Total de agendamentos já feitos: 0");
  expect(resumo).toContain("Não tem nenhum agendamento futuro");
  expect(resumo).toContain("Dados cadastrais ainda faltando: CPF, data de nascimento, email, endereço");
});

test("descreve cliente antigo com agendamento futuro e um cancelado", async () => {
  agendamentosService.listar.mockResolvedValueOnce([
    { status: "cancelado", data_hora: "2025-01-01T10:00:00" },
    { status: "agendado", data_hora: "2026-02-01T10:00:00" },
  ]);

  const resumo = await gerarResumoCliente({
    id: 2,
    nome: "João",
    status: "ativo",
    data_cadastro: "2025-01-15T10:00:00",
    cpf_cnpj: "123.456.789-00",
    data_nascimento: "1990-01-01",
    email: "joao@example.com",
    endereco: "Rua das Flores, 100",
  });

  expect(resumo).toContain("João");
  expect(resumo).toContain("Cliente há 365 dia(s)");
  expect(resumo).toContain("Total de agendamentos já feitos: 2 (1 cancelado(s))");
  expect(resumo).toContain("Já tem um agendamento futuro marcado");
  expect(resumo).toContain("Cadastro completo");
});
