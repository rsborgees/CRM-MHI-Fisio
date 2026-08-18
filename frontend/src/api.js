const BASE_URL = 'http://localhost:3333'

export async function api(caminho, opcoes = {}) {
  const token = localStorage.getItem('token')

  const resposta = await fetch(`${BASE_URL}${caminho}`, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opcoes.headers,
    },
  })

  if (resposta.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    throw new Error('Sessão expirada')
  }

  const dados = await resposta.json().catch(() => null)

  if (!resposta.ok) {
    throw new Error(dados?.error || 'Erro na requisição')
  }

  return dados
}
