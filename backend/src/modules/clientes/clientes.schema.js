import { z } from "zod";

export const criarClienteSchema = z.object({
  nome: z.string().min(2),
  cpf_cnpj: z.string().optional(),
  data_nascimento: z.coerce.date().optional(),
  sexo: z.string().optional(),
  telefone: z.string().optional(),
  celular: z.string().optional(),
  email: z.string().email().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  cep: z.string().optional(),
  origem: z.string().optional(),
  status: z.enum(["novo_contato", "ativo", "inativo"]).optional(),
  observacoes: z.string().optional(),
});

export const atualizarClienteSchema = criarClienteSchema.partial();
