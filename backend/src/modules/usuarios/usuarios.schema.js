import { z } from "zod";

const papelSchema = z.enum(["administrador", "desenvolvedor", "usuario"]);

export const criarUsuarioSchema = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  senha: z.string().min(6),
  papel: papelSchema,
});

export const atualizarUsuarioSchema = z.object({
  nome: z.string().min(2).optional(),
  email: z.string().email().optional(),
  papel: papelSchema.optional(),
  ativo: z.boolean().optional(),
});
