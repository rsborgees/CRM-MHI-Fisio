import { jest } from "@jest/globals";

jest.unstable_mockModule("../clientes/clientes.service.js", () => ({
  atualizar: jest.fn().mockResolvedValue({ id: 2, nome: "Maria Silva", nome_confirmado: true }),
  buscarPorId: jest.fn().mockResolvedValue({ id: 2, nome: "Maria Silva", nome_confirmado: true }),
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

jest.unstable_mockModule("../profissionais/profissionais.service.js", () => ({
  listar: jest.fn().mockResolvedValue([]),
}));

jest.unstable_mockModule("../pagamentos/pagamentos.service.js", () => ({
  criar: jest.fn().mockResolvedValue({ id: 1 }),
}));

const agendamentosService = await import("../agendamentos/agendamentos.service.js");
const clientesService = await import("../clientes/clientes.service.js");
const servicosService = await import("../servicos/servicos.service.js");
const profissionaisService = await import("../profissionais/profissionais.service.js");
const pagamentosService = await import("../pagamentos/pagamentos.service.js");
const { executarFerramenta, gerarInstrucaoSistema } = await import("./tools.js");

beforeEach(() => {
  jest.clearAllMocks();
});

test("criarAgendamento resolve o serviço pelo nome (não pede id numérico ao modelo)", async () => {
  servicosService.listar.mockResolvedValueOnce([
    { id: 5, nome: "Sessão de Fisioterapia", duracao_minutos: 30 },
  ]);

  await executarFerramenta(2, "criarAgendamento", {
    cliente_id: 999,
    nome_servico: "Sessão de Fisioterapia",
    data_hora: "2026-01-10T10:00:00",
  });

  expect(servicosService.listar).toHaveBeenCalledWith({ busca: "Sessão de Fisioterapia", ativo: "true" });
  expect(agendamentosService.criar).toHaveBeenCalledWith(
    expect.objectContaining({ cliente_id: 2, servico_id: 5, duracao_minutos: 30 }),
  );
});

test("criarAgendamento devolve erro com a lista de serviços válidos quando o nome não é encontrado", async () => {
  servicosService.listar.mockResolvedValueOnce([]);
  servicosService.listar.mockResolvedValueOnce([
    { id: 4, nome: "RPG" },
    { id: 5, nome: "Sessão de Fisioterapia" },
  ]);

  const resultado = await executarFerramenta(2, "criarAgendamento", {
    nome_servico: "Pilates Clínico",
    data_hora: "2026-01-10T10:00:00",
  });

  expect(resultado.erro).toContain("Pilates Clínico");
  expect(resultado.erro).toContain("RPG");
  expect(resultado.erro).toContain("Sessão de Fisioterapia");
  expect(agendamentosService.criar).not.toHaveBeenCalled();
});

test("criarAgendamento recusa quando o modelo não informa nome_servico (evita agendamento sem serviço vinculado)", async () => {
  const resultado = await executarFerramenta(2, "criarAgendamento", { data_hora: "2026-01-10T10:00:00" });

  expect(resultado).toEqual({
    erro: "É necessário informar o nome do serviço para criar o agendamento.",
  });
  expect(agendamentosService.criar).not.toHaveBeenCalled();
});

function calcularProximoDiaUtilEsperado() {
  const data = new Date();
  data.setDate(data.getDate() + 1);
  while (data.getDay() === 0 || data.getDay() === 6) {
    data.setDate(data.getDate() + 1);
  }
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

test("consultarHorariosDisponiveis usa o próximo dia útil quando o cliente não especifica a data", async () => {
  agendamentosService.horariosDisponiveis.mockResolvedValueOnce([]);

  await executarFerramenta(2, "consultarHorariosDisponiveis", {});

  expect(agendamentosService.horariosDisponiveis).toHaveBeenCalledWith(
    expect.objectContaining({ data: calcularProximoDiaUtilEsperado() }),
  );
});

test("consultarHorariosDisponiveis converte os horários (UTC) pro fuso de São Paulo antes de sugerir", async () => {
  // 12:00Z e 13:00Z são 09:00 e 10:00 em São Paulo (UTC-3) — a IA não deve ver o "12"/"13" crus.
  agendamentosService.horariosDisponiveis.mockResolvedValueOnce([
    "2026-01-10T12:00:00.000Z",
    "2026-01-10T13:00:00.000Z",
  ]);

  const resultado = await executarFerramenta(2, "consultarHorariosDisponiveis", { data: "2026-01-10" });

  expect(resultado.horarios).toEqual(["2026-01-10T09:00:00", "2026-01-10T10:00:00"]);
});

test("consultarHorariosDisponiveis informa o dia da semana calculado pelo código, não deixa a IA calcular (reproduz caso real: modelo disse 'segunda' quando era quarta)", async () => {
  agendamentosService.horariosDisponiveis.mockResolvedValueOnce([]);

  const resultado = await executarFerramenta(2, "consultarHorariosDisponiveis", { data: "2026-08-19" });

  // 2026-08-19 é uma quarta-feira de verdade.
  expect(resultado.dia_semana).toBe("quarta-feira");
});

test("consultarHorariosDisponiveis confirma quando o horário específico pedido pelo cliente está disponível", async () => {
  agendamentosService.horariosDisponiveis.mockResolvedValueOnce([
    "2026-01-10T12:00:00.000Z", // 09:00 em SP
    "2026-01-10T13:00:00.000Z", // 10:00 em SP
  ]);

  const resultado = await executarFerramenta(2, "consultarHorariosDisponiveis", {
    data: "2026-01-10",
    hora_especifica: "10:00",
  });

  expect(resultado.horario_especifico_disponivel).toBe(true);
  expect(resultado.horario_especifico_perguntado).toBe("2026-01-10T10:00:00");
});

test("consultarHorariosDisponiveis informa quando o horário específico pedido NÃO está disponível", async () => {
  agendamentosService.horariosDisponiveis.mockResolvedValueOnce([
    "2026-01-10T12:00:00.000Z", // só 09:00 em SP está livre
  ]);

  const resultado = await executarFerramenta(2, "consultarHorariosDisponiveis", {
    data: "2026-01-10",
    hora_especifica: "10:00",
  });

  expect(resultado.horario_especifico_disponivel).toBe(false);
});

test("consultarHorariosDisponiveis prefere horários redondos (terminados em 00) entre os exemplos sugeridos", async () => {
  agendamentosService.horariosDisponiveis.mockResolvedValueOnce([
    "2026-01-10T12:00:00.000Z",
    "2026-01-10T12:30:00.000Z",
    "2026-01-10T13:00:00.000Z",
    "2026-01-10T13:30:00.000Z",
  ]);

  const resultado = await executarFerramenta(2, "consultarHorariosDisponiveis", { data: "2026-01-10" });

  expect(resultado.horarios).toEqual(["2026-01-10T09:00:00", "2026-01-10T10:00:00"]);
});

test("consultarHorariosDisponiveis completa com horários não-redondos se não houver 2 horários redondos", async () => {
  agendamentosService.horariosDisponiveis.mockResolvedValueOnce([
    "2026-01-10T12:00:00.000Z",
    "2026-01-10T12:30:00.000Z",
  ]);

  const resultado = await executarFerramenta(2, "consultarHorariosDisponiveis", { data: "2026-01-10" });

  expect(resultado.horarios).toEqual(["2026-01-10T09:00:00", "2026-01-10T09:30:00"]);
});

test("consultarHorariosDisponiveis limita o retorno a 2 horários de exemplo, mas informa quantos existem no total", async () => {
  agendamentosService.horariosDisponiveis.mockResolvedValueOnce([
    "2026-01-10T12:00:00.000Z",
    "2026-01-10T13:00:00.000Z",
    "2026-01-10T14:00:00.000Z",
    "2026-01-10T15:00:00.000Z",
  ]);

  const resultado = await executarFerramenta(2, "consultarHorariosDisponiveis", { data: "2026-01-10" });

  expect(resultado.horarios).toEqual(["2026-01-10T09:00:00", "2026-01-10T10:00:00"]);
  expect(resultado.total_disponivel).toBe(4);
});

test("consultarHorariosDisponiveis filtra por período do dia quando o cliente recusa os horários sugeridos e pede a tarde", async () => {
  agendamentosService.horariosDisponiveis.mockResolvedValueOnce([
    "2026-01-10T11:00:00.000Z", // 08:00 em SP (manhã)
    "2026-01-10T12:00:00.000Z", // 09:00 em SP (manhã)
    "2026-01-10T18:00:00.000Z", // 15:00 em SP (tarde)
    "2026-01-10T19:00:00.000Z", // 16:00 em SP (tarde)
  ]);

  const resultado = await executarFerramenta(2, "consultarHorariosDisponiveis", {
    data: "2026-01-10",
    periodo_dia: "tarde",
  });

  expect(resultado.horarios).toEqual(["2026-01-10T15:00:00", "2026-01-10T16:00:00"]);
  expect(resultado.total_disponivel).toBe(2);
});

test("consultarHorariosDisponiveis resolve serviço e profissional pelo nome", async () => {
  servicosService.listar.mockResolvedValueOnce([{ id: 5, nome: "Sessão de Fisioterapia" }]);
  profissionaisService.listar.mockResolvedValueOnce([{ id: 7, nome: "Ana" }]);

  await executarFerramenta(2, "consultarHorariosDisponiveis", {
    data: "2026-01-10",
    nome_servico: "Sessão de Fisioterapia",
    nome_profissional: "Ana",
  });

  expect(agendamentosService.horariosDisponiveis).toHaveBeenCalledWith({
    servico_id: 5,
    profissional_id: 7,
    data: "2026-01-10",
  });
});

test("cancelarAgendamento recusa quando o cliente não tem nenhum agendamento ativo", async () => {
  agendamentosService.listar.mockResolvedValueOnce([]);

  const resultado = await executarFerramenta(2, "cancelarAgendamento", {});

  expect(resultado.erro).toContain("nenhum agendamento ativo");
  expect(agendamentosService.atualizar).not.toHaveBeenCalled();
});

test("cancelarAgendamento funciona quando há só um agendamento ativo, sem precisar dizer o serviço", async () => {
  agendamentosService.listar.mockResolvedValueOnce([
    { id: 10, cliente_id: 2, status: "agendado", data_hora: "2026-01-10T10:00:00.000Z", servicos: { nome: "Sessão de Fisioterapia" } },
  ]);
  agendamentosService.atualizar.mockResolvedValueOnce({ id: 10, status: "cancelado" });

  const resultado = await executarFerramenta(2, "cancelarAgendamento", {});

  expect(resultado).toEqual({
    id: 10,
    status: "cancelado",
    data_hora: "2026-01-10T10:00:00.000Z",
    servico: "Sessão de Fisioterapia",
  });
  expect(agendamentosService.atualizar).toHaveBeenCalledWith(10, { status: "cancelado" });
});

test("cancelarAgendamento pede pra especificar o serviço quando há mais de um agendamento ativo", async () => {
  agendamentosService.listar.mockResolvedValueOnce([
    { id: 10, cliente_id: 2, status: "agendado", data_hora: "2026-01-10T10:00:00.000Z", servicos: { nome: "Sessão de Fisioterapia" } },
    { id: 11, cliente_id: 2, status: "agendado", data_hora: "2026-01-11T10:00:00.000Z", servicos: { nome: "RPG" } },
  ]);

  const resultado = await executarFerramenta(2, "cancelarAgendamento", {});

  expect(resultado.erro).toContain("mais de um agendamento ativo");
  expect(agendamentosService.atualizar).not.toHaveBeenCalled();
});

test("criarAgendamento recusa quando o cliente ainda não tem nome cadastrado (só o placeholder do WhatsApp)", async () => {
  // Não configura servicosService.listar aqui: a checagem de nome_confirmado acontece antes de
  // resolver o serviço, então esse mock nunca seria consumido — deixá-lo "pendurado" vazava pro
  // próximo teste que chamasse listar, mascarado só porque coincidia com o valor que eles já usavam.
  clientesService.buscarPorId.mockResolvedValueOnce({ id: 2, nome: "Cliente WhatsApp 5511999999999", nome_confirmado: false });

  const resultado = await executarFerramenta(2, "criarAgendamento", {
    nome_servico: "Sessão de Fisioterapia",
    data_hora: "2026-01-10T10:00:00",
  });

  expect(resultado.erro).toContain("nome completo");
  expect(agendamentosService.criar).not.toHaveBeenCalled();
});

test("criarAgendamento recusa quando o nome veio só do pushName do WhatsApp e o cliente nunca confirmou (reproduz caso real)", async () => {
  clientesService.buscarPorId.mockResolvedValueOnce({ id: 2, nome: "Rafaella", nome_confirmado: false });

  const resultado = await executarFerramenta(2, "criarAgendamento", {
    nome_servico: "Sessão de Fisioterapia",
    data_hora: "2026-01-10T10:00:00",
  });

  expect(resultado.erro).toContain("nome completo");
  expect(agendamentosService.criar).not.toHaveBeenCalled();
});

test("criarAgendamento agenda automaticamente com a única profissional que atende o serviço", async () => {
  servicosService.listar.mockResolvedValueOnce([{ id: 5, nome: "Sessão de Fisioterapia", duracao_minutos: 30 }]);
  profissionaisService.listar.mockResolvedValueOnce([
    { id: 2, nome: "Larissa", servicosAtendidos: [{ id: 5 }] },
    { id: 3, nome: "Pedro", servicosAtendidos: [{ id: 9 }] },
  ]);

  await executarFerramenta(2, "criarAgendamento", {
    nome_servico: "Sessão de Fisioterapia",
    data_hora: "2026-01-10T10:00:00",
  });

  expect(agendamentosService.criar).toHaveBeenCalledWith(expect.objectContaining({ profissional_id: 2 }));
});

test("criarAgendamento pede pra perguntar a preferência quando mais de uma profissional atende o serviço", async () => {
  servicosService.listar.mockResolvedValueOnce([{ id: 5, nome: "Sessão de Fisioterapia", duracao_minutos: 30 }]);
  profissionaisService.listar.mockResolvedValueOnce([
    { id: 2, nome: "Larissa", servicosAtendidos: [{ id: 5 }] },
    { id: 3, nome: "Pedro", servicosAtendidos: [{ id: 5 }] },
  ]);

  const resultado = await executarFerramenta(2, "criarAgendamento", {
    nome_servico: "Sessão de Fisioterapia",
    data_hora: "2026-01-10T10:00:00",
  });

  expect(resultado.erro).toContain("Larissa");
  expect(resultado.erro).toContain("Pedro");
  expect(agendamentosService.criar).not.toHaveBeenCalled();
});

test("criarAgendamento recusa quando a profissional nomeada não atende o serviço", async () => {
  servicosService.listar.mockResolvedValueOnce([{ id: 5, nome: "Sessão de Fisioterapia", duracao_minutos: 30 }]);
  profissionaisService.listar
    .mockResolvedValueOnce([{ id: 3, nome: "Pedro", servicosAtendidos: [{ id: 9 }] }])
    .mockResolvedValueOnce([
      { id: 2, nome: "Larissa", servicosAtendidos: [{ id: 5 }] },
      { id: 3, nome: "Pedro", servicosAtendidos: [{ id: 9 }] },
    ]);

  const resultado = await executarFerramenta(2, "criarAgendamento", {
    nome_servico: "Sessão de Fisioterapia",
    nome_profissional: "Pedro",
    data_hora: "2026-01-10T10:00:00",
  });

  expect(resultado.erro).toContain("Pedro");
  expect(resultado.erro).toContain("Larissa");
  expect(agendamentosService.criar).not.toHaveBeenCalled();
});

test("criarAgendamento segue sem profissional quando nenhuma está vinculada ao serviço ainda", async () => {
  servicosService.listar.mockResolvedValueOnce([{ id: 5, nome: "Sessão de Fisioterapia", duracao_minutos: 30 }]);
  profissionaisService.listar.mockResolvedValueOnce([{ id: 2, nome: "Larissa", servicosAtendidos: [] }]);

  await executarFerramenta(2, "criarAgendamento", {
    nome_servico: "Sessão de Fisioterapia",
    data_hora: "2026-01-10T10:00:00",
  });

  expect(agendamentosService.criar).toHaveBeenCalledWith(expect.objectContaining({ profissional_id: undefined }));
});

test("criarAgendamento devolve o nome do serviço no resultado (pra montar a confirmação sem depender do modelo)", async () => {
  servicosService.listar.mockResolvedValueOnce([{ id: 5, nome: "Sessão de Fisioterapia", duracao_minutos: 30 }]);

  const resultado = await executarFerramenta(2, "criarAgendamento", {
    nome_servico: "Sessão de Fisioterapia",
    data_hora: "2026-01-10T10:00:00",
  });

  expect(resultado).toEqual(
    expect.objectContaining({ id: 1, status: "agendado", servico: "Sessão de Fisioterapia" }),
  );
});

test("criarAgendamento lança o valor do serviço como pagamento pendente", async () => {
  servicosService.listar.mockResolvedValueOnce([
    { id: 5, nome: "Sessão de Fisioterapia", duracao_minutos: 30, preco: "120" },
  ]);

  await executarFerramenta(2, "criarAgendamento", {
    nome_servico: "Sessão de Fisioterapia",
    data_hora: "2026-01-10T10:00:00",
    forma_pagamento: "pix",
  });

  expect(pagamentosService.criar).toHaveBeenCalledWith({
    cliente_id: 2,
    agendamento_id: 1,
    valor: "120",
    forma_pagamento: "pix",
    status: "pendente",
  });
});

test("criarAgendamento recusa quando o serviço tem preço mas a forma de pagamento não foi informada", async () => {
  servicosService.listar.mockResolvedValueOnce([
    { id: 5, nome: "Sessão de Fisioterapia", duracao_minutos: 30, preco: "120" },
  ]);

  const resultado = await executarFerramenta(2, "criarAgendamento", {
    nome_servico: "Sessão de Fisioterapia",
    data_hora: "2026-01-10T10:00:00",
  });

  expect(resultado.erro).toContain("forma de pagamento");
  expect(agendamentosService.criar).not.toHaveBeenCalled();
  expect(pagamentosService.criar).not.toHaveBeenCalled();
});

test("criarAgendamento recusa forma de pagamento fora da lista aceita", async () => {
  servicosService.listar.mockResolvedValueOnce([
    { id: 5, nome: "Sessão de Fisioterapia", duracao_minutos: 30, preco: "120" },
  ]);

  const resultado = await executarFerramenta(2, "criarAgendamento", {
    nome_servico: "Sessão de Fisioterapia",
    data_hora: "2026-01-10T10:00:00",
    forma_pagamento: "boleto",
  });

  expect(resultado.erro).toContain("forma de pagamento");
  expect(agendamentosService.criar).not.toHaveBeenCalled();
});

test("criarAgendamento não lança pagamento quando o serviço não tem preço definido", async () => {
  servicosService.listar.mockResolvedValueOnce([
    { id: 5, nome: "Sessão de Fisioterapia", duracao_minutos: 30, preco: null },
  ]);

  await executarFerramenta(2, "criarAgendamento", {
    nome_servico: "Sessão de Fisioterapia",
    data_hora: "2026-01-10T10:00:00",
  });

  expect(pagamentosService.criar).not.toHaveBeenCalled();
});

test("criarAgendamento não falha o agendamento se o lançamento do pagamento pendente der erro", async () => {
  servicosService.listar.mockResolvedValueOnce([
    { id: 5, nome: "Sessão de Fisioterapia", duracao_minutos: 30, preco: "120" },
  ]);
  pagamentosService.criar.mockRejectedValueOnce(new Error("banco fora do ar"));

  const resultado = await executarFerramenta(2, "criarAgendamento", {
    nome_servico: "Sessão de Fisioterapia",
    data_hora: "2026-01-10T10:00:00",
    forma_pagamento: "dinheiro",
  });

  expect(resultado).toEqual(expect.objectContaining({ id: 1, status: "agendado" }));
  expect(resultado.erro).toBeUndefined();
});

test("remarcarAgendamento resolve o agendamento certo pelo nome do serviço quando há mais de um ativo", async () => {
  agendamentosService.listar.mockResolvedValueOnce([
    { id: 10, cliente_id: 2, status: "agendado", data_hora: "2026-01-09T10:00:00.000Z", servicos: { nome: "Sessão de Fisioterapia" } },
    { id: 11, cliente_id: 2, status: "agendado", data_hora: "2026-01-10T10:00:00.000Z", servicos: { nome: "RPG" } },
  ]);
  agendamentosService.atualizar.mockResolvedValueOnce({
    id: 11,
    status: "agendado",
    data_hora: "2026-01-15T10:00:00.000Z",
  });

  const resultado = await executarFerramenta(2, "remarcarAgendamento", {
    nome_servico: "RPG",
    data_hora: "2026-01-15T10:00:00",
  });

  expect(agendamentosService.atualizar).toHaveBeenCalledWith(11, { data_hora: new Date("2026-01-15T10:00:00") });
  expect(resultado).toEqual(
    expect.objectContaining({ id: 11, status: "agendado", servico: "RPG" }),
  );
});

test("remarcarAgendamento recusa quando não encontra agendamento ativo pro serviço informado", async () => {
  agendamentosService.listar.mockResolvedValueOnce([
    { id: 10, cliente_id: 2, status: "agendado", data_hora: "2026-01-09T10:00:00.000Z", servicos: { nome: "Sessão de Fisioterapia" } },
  ]);

  const resultado = await executarFerramenta(2, "remarcarAgendamento", {
    nome_servico: "RPG",
    data_hora: "2026-01-15T10:00:00",
  });

  expect(resultado.erro).toContain("RPG");
  expect(agendamentosService.atualizar).not.toHaveBeenCalled();
});

test("atualizarNomeCliente salva o nome informado pelo cliente da conversa e marca como confirmado", async () => {
  const resultado = await executarFerramenta(2, "atualizarNomeCliente", { nome: "Maria Silva" });

  expect(clientesService.atualizar).toHaveBeenCalledWith(2, { nome: "Maria Silva", nome_confirmado: true });
  expect(resultado).toEqual({ id: 2, nome: "Maria Silva" });
});

test("executarFerramenta devolve erro genérico (não estoura) quando o serviço interno lança um erro que não é AppError", async () => {
  agendamentosService.horariosDisponiveis.mockRejectedValueOnce(new Error("registro não encontrado no banco"));

  const resultado = await executarFerramenta(2, "consultarHorariosDisponiveis", { data: "2026-01-10" });

  expect(resultado).toEqual({
    erro: "Não foi possível concluir essa ação com os dados informados. Confira e tente novamente.",
  });
});

test("ferramenta desconhecida gera erro", async () => {
  await expect(executarFerramenta(2, "ferramentaQueNaoExiste", {})).rejects.toThrow(
    "Ferramenta desconhecida: ferramentaQueNaoExiste",
  );
});

test("gerarInstrucaoSistema devolve a base mais a data atual fora da primeira mensagem", () => {
  const resultado = gerarInstrucaoSistema({
    instrucaoBase: "base de teste",
    nome: "Rafaella",
    primeiraMensagem: false,
  });

  expect(resultado).toContain("base de teste");
  expect(resultado).toMatch(/Hoje é .+, \d{4}-\d{2}-\d{2}/);
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
