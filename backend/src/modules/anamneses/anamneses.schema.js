import { z } from "zod";
import { numeroOpcional } from "../../utils/zodHelpers.js";

export const criarAnamneseSchema = z.object({
  cliente_id: z.coerce.number().int(),
  agendamento_id: numeroOpcional(z.coerce.number().int()),
  data: z.coerce.date().optional(),
  queixa_principal: z.string().optional(),
  historico_doenca_atual: z.string().optional(),
  doencas_previas: z.string().optional(),
  cirurgias_anteriores: z.string().optional(),
  medicamentos_em_uso: z.string().optional(),
  alergias: z.string().optional(),
  historico_familiar: z.string().optional(),
  pratica_atividade_fisica: z.boolean().optional(),
  tabagismo: z.enum(["nunca_fumou", "ex_fumante", "fumante"]).optional(),
  consumo_alcool: z.enum(["nao_consome", "socialmente", "frequente"]).optional(),
  qualidade_sono: z.enum(["boa", "regular", "ruim"]).optional(),
  observacoes_adicionais: z.string().optional(),
  responsavel_id: numeroOpcional(z.coerce.number().int()),
});

export const atualizarAnamneseSchema = criarAnamneseSchema.partial();
