import { z } from "zod";
import { numeroOpcional } from "../../utils/zodHelpers.js";

export const criarPagamentoSchema = z.object({
  cliente_id: z.coerce.number().int(),
  agendamento_id: numeroOpcional(z.coerce.number().int()),
  pacote_id: numeroOpcional(z.coerce.number().int()),
  data_pagamento: z.coerce.date().optional(),
  valor: z.coerce.number().positive(),
  forma_pagamento: z.string().optional(),
  status: z.string().optional(),
  observacoes: z.string().optional(),
});

export const atualizarPagamentoSchema = criarPagamentoSchema.partial();
