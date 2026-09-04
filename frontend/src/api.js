export const BASE_URL = 'http://localhost:3336'

// Lê o papel/nome/email direto do token, sem outra chamada à API — o backend já embute isso no
// JWT no login. É só pra decisões de exibição no front (esconder telas); a permissão de verdade
// é sempre checada de novo no backend (requireRole), então não tem problema alguém "destravar"
// isso no navegador.
export function getUsuarioAtual() {
  const token = localStorage.getItem('token')
  if (!token) return null

  try {
    const payloadBase64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const padding = '='.repeat((4 - (payloadBase64.length % 4)) % 4)
    return JSON.parse(atob(payloadBase64 + padding))
  } catch {
    return null
  }
}

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
