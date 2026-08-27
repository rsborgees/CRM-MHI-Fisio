import * as agendamentosService from "../agendamentos/agendamentos.service.js";
import { enviarMensagem } from "../atendimento-ia/evolutionApi.js";

const FUSO_HORARIO_CLINICA = "America/Sao_Paulo";

function horaLocal(dataHora) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO_HORARIO_CLINICA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(dataHora));
}

function montarMensagem(agendamento) {
  const nome = agendamento.clientes.nome_confirmado ? agendamento.clientes.nome.split(" ")[0] : "";
  const saudacao = nome ? `Olá, ${nome}!` : "Olá!";
  const servico = agendamento.servicos?.nome ? ` de ${agendamento.servicos.nome}` : "";
  return `${saudacao} Passando pra lembrar que você tem uma sessão${servico} hoje às ${horaLocal(agendamento.data_hora)}. Te esperamos na MHI Fisio!`;
}

// Roda com frequência, não só uma vez por dia (ver agendador.js) — manda o lembrete pouco antes
// do horário de cada agendamento, em vez de despachar tudo de uma vez de manhã. Cada agendamento
// é tratado de forma independente — se o envio de um falhar (número inválido, Evolution API fora
// do ar), os outros continuam sendo processados normalmente, e esse fica pra tentar de novo na
// próxima execução (ainda dentro da janela de antecedência).
export async function enviarLembretesPendentes(antecedenciaMinutos) {
  const agendamentos = await agendamentosService.listarParaLembrete(antecedenciaMinutos);
  let enviados = 0;

  for (const agendamento of agendamentos) {
    const telefone = agendamento.clientes.celular || agendamento.clientes.telefone;
    if (!telefone) continue;

    try {
      await enviarMensagem(telefone, montarMensagem(agendamento));
      await agendamentosService.marcarLembreteEnviado(agendamento.id);
      enviados++;
    } catch (erro) {
      console.error(`Falha ao enviar lembrete do agendamento ${agendamento.id}:`, erro);
    }
  }

  return { total: agendamentos.length, enviados };
}
