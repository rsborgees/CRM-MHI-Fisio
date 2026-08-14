export function variantesTelefoneBR(telefone) {
  const digitos = telefone.replace(/\D/g, "");
  const variantes = new Set([digitos]);

  if (digitos.startsWith("55") && digitos.length === 12) {
    const ddd = digitos.slice(2, 4);
    const numero = digitos.slice(4);
    variantes.add(`55${ddd}9${numero}`);
  } else if (digitos.startsWith("55") && digitos.length === 13) {
    const ddd = digitos.slice(2, 4);
    const numero = digitos.slice(5);
    variantes.add(`55${ddd}${numero}`);
  }

  return [...variantes];
}
