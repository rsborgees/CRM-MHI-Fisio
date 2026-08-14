import { z } from "zod";

// Formulários mandam "" quando um campo numérico opcional fica em branco.
// z.coerce.number() transformaria isso em 0, o que quebra validações como
// .positive() e salva valores errados em campos que deveriam ficar vazios.
// Isso trata "" (e null) como "não informado" antes de tentar converter pra número.
export function numeroOpcional(schemaNumero) {
  return z.preprocess((valor) => (valor === "" || valor === null ? undefined : valor), schemaNumero.optional());
}
