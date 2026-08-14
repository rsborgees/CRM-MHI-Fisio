import { z } from "zod";
import { numeroOpcional } from "../../utils/zodHelpers.js";

export const criarPacoteSchema = z.object({
  nome: z.string().min(2),
  descricao: z.string().optional(),
  preco: numeroOpcional(z.coerce.number().nonnegative()),
  validade_dias: numeroOpcional(z.coerce.number().int().positive()),
  ativo: z.boolean().optional(),
});

export const atualizarPacoteSchema = criarPacoteSchema.partial();
