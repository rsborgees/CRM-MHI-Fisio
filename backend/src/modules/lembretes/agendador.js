import cron from "node-cron";
import { enviarLembretesPendentes } from "./lembretes.service.js";

const FUSO_HORARIO_CLINICA = "America/Sao_Paulo";

export function iniciarAgendadorDeLembretes() {
  const antecedenciaMinutos = Number(process.env.LEMBRETE_ANTECEDENCIA_MINUTOS) || 60;
  const intervaloMinutos = Number(process.env.LEMBRETE_INTERVALO_VERIFICACAO_MINUTOS) || 10;

  cron.schedule(
    `*/${intervaloMinutos} * * * *`,
    async () => {
      const resultado = await enviarLembretesPendentes(antecedenciaMinutos);
      if (resultado.total > 0) {
        console.log(`Lembretes de agendamento: ${resultado.enviados}/${resultado.total} enviados.`);
      }
    },
    { timezone: FUSO_HORARIO_CLINICA },
  );

  console.log(
    `Agendador de lembretes ativo — confere a cada ${intervaloMinutos}min por agendamentos ` +
      `começando em até ${antecedenciaMinutos}min (${FUSO_HORARIO_CLINICA}).`,
  );
}
