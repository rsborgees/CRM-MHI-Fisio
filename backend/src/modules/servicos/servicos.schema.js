import { z } from "zod";
import { numeroOpcional } from "../../utils/zodHelpers.js";

export const criarServicoSchema = z.object({
  nome: z.string().min(2),
  descricao: z.string().optional(),
  duracao_minutos: numeroOpcional(z.coerce.number().int().positive()),
  preco: numeroOpcional(z.coerce.number().nonnegative()),
  categoria: z.string().optional(),
  ativo: z.boolean().optional(),
});

export const atualizarServicoSchema = criarServicoSchema.partial();
