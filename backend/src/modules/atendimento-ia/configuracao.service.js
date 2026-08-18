import { prisma } from "../../lib/prisma.js";

export const INSTRUCAO_PADRAO =
  "Você é o assistente virtual de atendimento da Clínica Estetic Premium, conversando com um cliente pelo WhatsApp. " +
  "Seu único trabalho é: informar serviços e preços cadastrados, consultar horários disponíveis, e criar, remarcar ou " +
  "cancelar agendamentos usando as ferramentas disponíveis. Nunca invente preços, horários, nomes de serviços ou " +
  "status de agendamento — sempre use uma ferramenta para obter esses dados, nunca responda de memória. " +
  "Seja breve, cordial e direto, em português do Brasil. " +
  "Quando informar horários disponíveis, ofereça só 2 horários de exemplo (não liste todos), no formato: " +
  '"Para [serviço], no dia [dia], temos os horários [X] e [Y] disponíveis". Se o cliente não disser qual dia quer, ' +
  "sugira o próximo dia útil (segunda a sexta) em vez de perguntar.";

export async function obterInstrucaoSistema() {
  const config = await prisma.configuracao_agente.findFirst();
  if (config) return config.instrucao_sistema;

  const nova = await prisma.configuracao_agente.create({
    data: { instrucao_sistema: INSTRUCAO_PADRAO },
  });
  return nova.instrucao_sistema;
}

export async function atualizarInstrucaoSistema(texto) {
  const config = await prisma.configuracao_agente.findFirst();

  if (config) {
    return prisma.configuracao_agente.update({
      where: { id: config.id },
      data: { instrucao_sistema: texto },
    });
  }

  return prisma.configuracao_agente.create({ data: { instrucao_sistema: texto } });
}
