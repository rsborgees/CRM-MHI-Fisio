import { z } from "zod";
import { numeroOpcional } from "../../utils/zodHelpers.js";

export const criarEvolucaoSchema = z.object({
  cliente_id: z.coerce.number().int(),
  agendamento_id: z.coerce.number().int(),
  data: z.coerce.date().optional(),
  evolucao_quadro: z.string().optional(),
  escala_dor: numeroOpcional(z.coerce.number().int().min(0).max(10)),
  conduta_realizada: z.string().optional(),
  resposta_tratamento: z.enum(["melhora", "estavel", "piora"]).optional(),
  observacoes: z.string().optional(),
  responsavel_id: numeroOpcional(z.coerce.number().int()),
});

export const atualizarEvolucaoSchema = criarEvolucaoSchema.partial();
