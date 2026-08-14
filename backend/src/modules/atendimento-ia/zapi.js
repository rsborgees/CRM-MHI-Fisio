function baseUrl() {
  return `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}`;
}

export async function enviarMensagem(telefone, mensagem) {
  const resposta = await fetch(`${baseUrl()}/send-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: telefone, message: mensagem }),
  });

  if (!resposta.ok) {
    throw new Error(`Falha ao enviar mensagem via Z-API: ${resposta.status}`);
  }

  return resposta.json();
}
