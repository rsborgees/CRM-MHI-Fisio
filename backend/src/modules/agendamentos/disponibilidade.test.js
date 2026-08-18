import { gerarHorariosCandidatos } from "./disponibilidade.js";

test("gera horários dentro do expediente quando não há conflito", () => {
  const candidatos = gerarHorariosCandidatos({
    data: "2026-01-10",
    duracaoMinutos: 60,
    horarioAbertura: "09:00",
    horarioFechamento: "11:00",
    agendamentosExistentes: [],
  });

  // Grade de 15 em 15 minutos: todo início possível para um agendamento de 60min
  // que ainda termina até as 11:00.
  expect(candidatos).toHaveLength(5);
  expect(candidatos[0].getHours()).toBe(9);
  expect(candidatos[0].getMinutes()).toBe(0);
  expect(candidatos.at(-1).getHours()).toBe(10);
  expect(candidatos.at(-1).getMinutes()).toBe(0);
});

test("remove horário que conflita com agendamento existente", () => {
  const candidatos = gerarHorariosCandidatos({
    data: "2026-01-10",
    duracaoMinutos: 60,
    horarioAbertura: "09:00",
    horarioFechamento: "11:00",
    agendamentosExistentes: [{ data_hora: "2026-01-10T09:00:00", duracao_minutos: 60 }],
  });

  expect(candidatos).toHaveLength(1);
  expect(candidatos[0].getHours()).toBe(10);
});

test("oferece horários de grade fixa mesmo quando a duração do serviço não divide a hora igualmente", () => {
  const candidatos = gerarHorariosCandidatos({
    data: "2026-01-10",
    duracaoMinutos: 45,
    horarioAbertura: "08:00",
    horarioFechamento: "17:00",
    agendamentosExistentes: [],
  });

  const horarios = candidatos.map((c) => `${c.getHours()}:${c.getMinutes()}`);
  expect(horarios).toContain("9:0");
  expect(horarios).toContain("10:0");
  expect(horarios).toContain("13:0");
});

test("usa 60 minutos como duração padrão quando não informada", () => {
  const candidatos = gerarHorariosCandidatos({
    data: "2026-01-10",
    horarioAbertura: "09:00",
    horarioFechamento: "10:00",
    agendamentosExistentes: [],
  });

  expect(candidatos).toHaveLength(1);
});
