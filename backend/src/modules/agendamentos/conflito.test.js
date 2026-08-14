import { intervaloDoAgendamento, intervalosSeSobrepoem } from "./conflito.js";

test("horários que se cruzam no meio geram conflito", () => {
  const a = intervaloDoAgendamento({ data_hora: "2026-01-10T10:00:00", duracao_minutos: 60 });
  const b = intervaloDoAgendamento({ data_hora: "2026-01-10T10:30:00", duracao_minutos: 60 });

  expect(intervalosSeSobrepoem(a, b)).toBe(true);
});

test("horários encostados (um termina quando o outro começa) não geram conflito", () => {
  const a = intervaloDoAgendamento({ data_hora: "2026-01-10T10:00:00", duracao_minutos: 60 });
  const b = intervaloDoAgendamento({ data_hora: "2026-01-10T11:00:00", duracao_minutos: 60 });

  expect(intervalosSeSobrepoem(a, b)).toBe(false);
});

test("horários em dias diferentes não geram conflito", () => {
  const a = intervaloDoAgendamento({ data_hora: "2026-01-10T10:00:00", duracao_minutos: 60 });
  const b = intervaloDoAgendamento({ data_hora: "2026-01-11T10:00:00", duracao_minutos: 60 });

  expect(intervalosSeSobrepoem(a, b)).toBe(false);
});

test("usa duração padrão de 60 minutos quando não informada", () => {
  const a = intervaloDoAgendamento({ data_hora: "2026-01-10T10:00:00" });

  expect(a.fim.getTime() - a.inicio.getTime()).toBe(60 * 60000);
});
