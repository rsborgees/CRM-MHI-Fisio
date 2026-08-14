import { z } from "zod";
import { numeroOpcional } from "../../utils/zodHelpers.js";

export const criarAvaliacaoSchema = z.object({
  cliente_id: z.coerce.number().int(),
  agendamento_id: numeroOpcional(z.coerce.number().int()),
  data: z.coerce.date().optional(),
  peso: numeroOpcional(z.coerce.number().positive()),
  altura: numeroOpcional(z.coerce.number().positive()),
  imc: numeroOpcional(z.coerce.number().positive()),
  medidas: z.record(z.string(), z.any()).optional(),
  obs_pele: z.string().optional(),
  obs_corporal: z.string().optional(),
  recomendacoes: z.string().optional(),
  responsavel_id: numeroOpcional(z.coerce.number().int()),
});

export const atualizarAvaliacaoSchema = criarAvaliacaoSchema.partial();
