import { gerarHorariosCandidatos } from "./disponibilidade.js";

test("gera horários dentro do expediente quando não há conflito", () => {
  const candidatos = gerarHorariosCandidatos({
    data: "2026-01-10",
    duracaoMinutos: 60,
    horarioAbertura: "09:00",
    horarioFechamento: "11:00",
    agendamentosExistentes: [],
  });

  expect(candidatos).toHaveLength(2);
  expect(candidatos[0].getHours()).toBe(9);
  expect(candidatos[1].getHours()).toBe(10);
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

test("usa 60 minutos como duração padrão quando não informada", () => {
  const candidatos = gerarHorariosCandidatos({
    data: "2026-01-10",
    horarioAbertura: "09:00",
    horarioFechamento: "10:00",
    agendamentosExistentes: [],
  });

  expect(candidatos).toHaveLength(1);
});
