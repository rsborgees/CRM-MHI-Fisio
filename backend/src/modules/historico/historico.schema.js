import { z } from "zod";

export const criarHistoricoSchema = z.object({
  cliente_id: z.coerce.number().int(),
  data: z.coerce.date().optional(),
  tipo: z.string().optional(),
  descricao: z.string().optional(),
  responsavel_id: z.coerce.number().int().optional(),
});
