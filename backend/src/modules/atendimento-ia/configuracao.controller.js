import * as configuracaoService from "./configuracao.service.js";

export async function obter(req, res) {
  const instrucao_sistema = await configuracaoService.obterInstrucaoSistema();
  res.json({ instrucao_sistema, instrucao_padrao: configuracaoService.INSTRUCAO_PADRAO });
}

export async function atualizar(req, res) {
  const { instrucao_sistema } = req.body;

  if (!instrucao_sistema || !instrucao_sistema.trim()) {
    return res.status(422).json({ error: "instrucao_sistema não pode ficar vazio" });
  }

  await configuracaoService.atualizarInstrucaoSistema(instrucao_sistema);
  res.json({ instrucao_sistema });
}
