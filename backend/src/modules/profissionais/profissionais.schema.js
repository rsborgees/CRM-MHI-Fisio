import { z } from "zod";

export const criarProfissionalSchema = z.object({
  nome: z.string().min(2),
  especialidade: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email().optional(),
  observacoes: z.string().optional(),
  ativo: z.boolean().optional(),
  servico_ids: z.array(z.number()).optional(),
});

export const atualizarProfissionalSchema = criarProfissionalSchema.partial();
