import * as dashboardService from "./dashboard.service.js";

export async function resumo(req, res) {
  const dados = await dashboardService.resumo();
  res.json(dados);
}
