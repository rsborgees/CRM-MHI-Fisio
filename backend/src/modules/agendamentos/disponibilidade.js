import { intervaloDoAgendamento, intervalosSeSobrepoem } from "./conflito.js";

const DURACAO_PADRAO_MINUTOS = 60;
// Grade fixa de horários candidatos — independente da duração do serviço, senão serviços
// com duração que não divide 60 (ex: 45min) pulam horas cheias que estão livres (9h, 10h, 13h...)
// porque o cursor avançaria de 45 em 45 minutos a partir da abertura.
const INTERVALO_GRADE_MINUTOS = 15;

function horarioNoDia(data, horario) {
  const [hora, minuto] = horario.split(":").map(Number);
  const resultado = new Date(`${data}T00:00:00`);
  resultado.setHours(hora, minuto, 0, 0);
  return resultado;
}

export function gerarHorariosCandidatos({
  data,
  duracaoMinutos,
  horarioAbertura,
  horarioFechamento,
  horarioAlmocoInicio,
  horarioAlmocoFim,
  agendamentosExistentes,
  agora,
}) {
  const duracao = duracaoMinutos ?? DURACAO_PADRAO_MINUTOS;
  const inicioExpediente = horarioNoDia(data, horarioAbertura);
  const fimExpediente = horarioNoDia(data, horarioFechamento);

  const ocupados = agendamentosExistentes.map((agendamento) => intervaloDoAgendamento(agendamento));

  // O almoço entra na mesma lista de bloqueios que os agendamentos já existentes — pra um
  // candidato ser válido, ele não pode se sobrepor a nenhum dos dois.
  if (horarioAlmocoInicio && horarioAlmocoFim) {
    ocupados.push({ inicio: horarioNoDia(data, horarioAlmocoInicio), fim: horarioNoDia(data, horarioAlmocoFim) });
  }

  const candidatos = [];
  let cursor = new Date(inicioExpediente);

  while (cursor.getTime() + duracao * 60000 <= fimExpediente.getTime()) {
    const candidato = intervaloDoAgendamento({ data_hora: cursor, duracao_minutos: duracao });
    // Sem isso, pedir horários "para hoje" depois de o expediente já ter começado oferece
    // horários que já passaram (ex: sugerir 9h quando já são 10h47) — só importa pra data de
    // hoje, já que "agora" nunca alcança um dia futuro.
    const jaPassou = agora && candidato.inicio < agora;
    const conflita = ocupados.some((ocupado) => intervalosSeSobrepoem(candidato, ocupado));

    if (!jaPassou && !conflita) {
      candidatos.push(new Date(cursor));
    }

    cursor = new Date(cursor.getTime() + INTERVALO_GRADE_MINUTOS * 60000);
  }

  return candidatos;
}
