import { z } from "zod";
import { numeroOpcional } from "../../utils/zodHelpers.js";

export const criarAgendamentoSchema = z.object({
  cliente_id: z.coerce.number().int(),
  profissional_id: numeroOpcional(z.coerce.number().int()),
  servico_id: numeroOpcional(z.coerce.number().int()),
  pacote_id: numeroOpcional(z.coerce.number().int()),
  data_hora: z.coerce.date(),
  duracao_minutos: numeroOpcional(z.coerce.number().int().positive()),
  status: z.string().optional(),
  valor: numeroOpcional(z.coerce.number().nonnegative()),
  origem_agendamento: z.string().optional(),
  observacoes: z.string().optional(),
});

export const atualizarAgendamentoSchema = criarAgendamentoSchema.partial();
