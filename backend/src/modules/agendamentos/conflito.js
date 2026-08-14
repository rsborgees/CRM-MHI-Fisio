const DURACAO_PADRAO_MINUTOS = 60;

export function intervaloDoAgendamento({ data_hora, duracao_minutos }) {
  const inicio = new Date(data_hora);
  const fim = new Date(inicio.getTime() + (duracao_minutos ?? DURACAO_PADRAO_MINUTOS) * 60000);
  return { inicio, fim };
}

export function intervalosSeSobrepoem(a, b) {
  return a.inicio < b.fim && a.fim > b.inicio;
}
