import { Navigate } from 'react-router-dom'
import { getUsuarioAtual } from '../api'

// Bloqueio só de UX (esconder/redirecionar) — a permissão de verdade é sempre imposta pelo
// backend (requireRole), então não tem problema de segurança em checar isso no navegador.
function RequirePapel({ papeis, children }) {
  const usuario = getUsuarioAtual()

  if (!usuario || !papeis.includes(usuario.papel)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default RequirePapel
