export async function enviarMensagem(telefone, mensagem) {
  const resposta = await fetch(
    `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.EVOLUTION_API_KEY,
      },
      body: JSON.stringify({ number: telefone, text: mensagem }),
    },
  );

  if (!resposta.ok) {
    throw new Error(`Falha ao enviar mensagem via Evolution API: ${resposta.status}`);
  }

  return resposta.json();
}
