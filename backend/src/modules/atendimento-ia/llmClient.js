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

function extrairJsonEmbutido(texto) {
  if (!texto) return null;

  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (inicio === -1 || fim === -1 || fim <= inicio) return null;

  try {
    return { corpo: JSON.parse(texto.slice(inicio, fim + 1)), inicio };
  } catch {
    return null;
  }
}

function extrairChamadaEmbutidaNoTexto(texto, ferramentas) {
  const encontrado = extrairJsonEmbutido(texto);
  if (!encontrado?.corpo?.name || !ferramentas.some((ferramenta) => ferramenta.nome === encontrado.corpo.name)) {
    return null;
  }

  return {
    id: `sintetico-${Math.random().toString(36).slice(2, 10)}`,
    nome: encontrado.corpo.name,
    argumentos: encontrado.corpo.arguments ?? encontrado.corpo.parameters ?? {},
  };
}

// Defesa extra: mesmo quando o JSON solto não corresponde a nenhuma ferramenta conhecida
// (nome inventado, chamada malformada), ele nunca deve vazar pro cliente como texto cru.
function removerJsonEmbutidoDoTexto(texto) {
  const encontrado = extrairJsonEmbutido(texto);
  if (!encontrado?.corpo?.name) return texto;
  return texto.slice(0, encontrado.inicio).trim();
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

  let chamadasDeFerramenta = (mensagemResposta.tool_calls ?? []).map((toolCall) => ({
    id: toolCall.id,
    nome: toolCall.function.name,
    argumentos: JSON.parse(toolCall.function.arguments || "{}"),
  }));

  if (chamadasDeFerramenta.length === 0) {
    const chamadaEmbutida = extrairChamadaEmbutidaNoTexto(mensagemResposta.content, ferramentas);
    if (chamadaEmbutida) {
      chamadasDeFerramenta = [chamadaEmbutida];
    }
  }

  return {
    texto:
      chamadasDeFerramenta.length > 0
        ? mensagemResposta.content ?? ""
        : removerJsonEmbutidoDoTexto(mensagemResposta.content ?? ""),
    chamadasDeFerramenta,
  };
}
