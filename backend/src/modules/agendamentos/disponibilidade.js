import { intervaloDoAgendamento, intervalosSeSobrepoem } from "./conflito.js";

const DURACAO_PADRAO_MINUTOS = 60;
// Grade fixa de horários candidatos — independente da duração do serviço, senão serviços
// com duração que não divide 60 (ex: 45min) pulam horas cheias que estão livres (9h, 10h, 13h...)
// porque o cursor avançaria de 45 em 45 minutos a partir da abertura.
const INTERVALO_GRADE_MINUTOS = 15;

export function gerarHorariosCandidatos({
  data,
  duracaoMinutos,
  horarioAbertura,
  horarioFechamento,
  agendamentosExistentes,
}) {
  const duracao = duracaoMinutos ?? DURACAO_PADRAO_MINUTOS;
  const [horaAbertura, minAbertura] = horarioAbertura.split(":").map(Number);
  const [horaFechamento, minFechamento] = horarioFechamento.split(":").map(Number);

  const inicioExpediente = new Date(`${data}T00:00:00`);
  inicioExpediente.setHours(horaAbertura, minAbertura, 0, 0);
  const fimExpediente = new Date(`${data}T00:00:00`);
  fimExpediente.setHours(horaFechamento, minFechamento, 0, 0);

  const ocupados = agendamentosExistentes.map((agendamento) => intervaloDoAgendamento(agendamento));

  const candidatos = [];
  let cursor = new Date(inicioExpediente);

  while (cursor.getTime() + duracao * 60000 <= fimExpediente.getTime()) {
    const candidato = intervaloDoAgendamento({ data_hora: cursor, duracao_minutos: duracao });
    const conflita = ocupados.some((ocupado) => intervalosSeSobrepoem(candidato, ocupado));

    if (!conflita) {
      candidatos.push(new Date(cursor));
    }

    cursor = new Date(cursor.getTime() + INTERVALO_GRADE_MINUTOS * 60000);
  }

  return candidatos;
}
