import OpenAI from "openai";

const cliente = new OpenAI({
  apiKey: process.env.LLM_API_KEY || "chave-nao-usada",
  baseURL: process.env.LLM_BASE_URL,
});

const MODELO = process.env.LLM_MODEL || "deepseek-chat";

function montarMensagens(mensagens, chamadasAnteriores, instrucaoSistema) {
  const resultado = [{ role: "system", content: instrucaoSistema }];

  for (const mensagem of mensagens) {
    resultado.push({
      role: mensagem.papel === "assistente" ? "assistant" : "user",
      content: mensagem.conteudo,
    });
  }

  for (const { chamada, resultado: resultadoFerramenta } of chamadasAnteriores) {
    resultado.push({
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: chamada.id,
          type: "function",
          function: { name: chamada.nome, arguments: JSON.stringify(chamada.argumentos) },
        },
      ],
    });
    resultado.push({
      role: "tool",
      tool_call_id: chamada.id,
      content: JSON.stringify(resultadoFerramenta),
    });
  }

  return resultado;
}

export async function gerarResposta({ mensagens, ferramentas, chamadasAnteriores = [], instrucaoSistema }) {
  const tools = ferramentas.map((ferramenta) => ({
    type: "function",
    function: {
      name: ferramenta.nome,
      description: ferramenta.descricao,
      parameters: ferramenta.parametros,
    },
  }));

  const resposta = await cliente.chat.completions.create({
    model: MODELO,
    messages: montarMensagens(mensagens, chamadasAnteriores, instrucaoSistema),
    tools,
  });

  const mensagemResposta = resposta.choices[0].message;

  const chamadasDeFerramenta = (mensagemResposta.tool_calls ?? []).map((toolCall) => ({
    id: toolCall.id,
    nome: toolCall.function.name,
    argumentos: JSON.parse(toolCall.function.arguments || "{}"),
  }));

  return {
    texto: mensagemResposta.content ?? "",
    chamadasDeFerramenta,
  };
}
