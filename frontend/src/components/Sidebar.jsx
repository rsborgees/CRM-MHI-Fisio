import { NavLink, useNavigate } from 'react-router-dom'
import { getUsuarioAtual } from '../api'
import {
  IconDashboard,
  IconAgenda,
  IconClientes,
  IconConversas,
  IconFinanceiro,
  IconProfissionais,
  IconServicos,
  IconConfiguracoes,
  IconPerfil,
  IconUsuarios,
  IconSair,
} from './icons'
import './Sidebar.css'

const LINKS_BASE = [
  { to: '/dashboard', label: 'Dashboard', Icon: IconDashboard },
  { to: '/agenda', label: 'Agenda', Icon: IconAgenda },
  { to: '/clientes', label: 'Clientes', Icon: IconClientes },
  { to: '/conversas', label: 'Conversas', Icon: IconConversas },
  { to: '/financeiro', label: 'Financeiro', Icon: IconFinanceiro },
  { to: '/profissionais', label: 'Profissionais', Icon: IconProfissionais },
  { to: '/servicos', label: 'Serviços', Icon: IconServicos },
]

// Configurações do agente de IA é área técnica — some da barra pra quem é só "usuário".
const LINK_CONFIGURACOES = { to: '/configuracoes', label: 'Configurações', Icon: IconConfiguracoes }

function Sidebar() {
  const navigate = useNavigate()
  const usuario = getUsuarioAtual()
  const papel = usuario?.papel

  const links =
    papel === 'administrador' || papel === 'desenvolvedor' ? [...LINKS_BASE, LINK_CONFIGURACOES] : LINKS_BASE

  function handleLogout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand" title="Estetic Premium">
        <span className="brand-mark">EP</span>
      </div>

      <nav className="sidebar-nav">
        {links.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={label}
            className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
          >
            <Icon />
            <span className="sidebar-tooltip">{label}</span>
          </NavLink>
        ))}
      </nav>

      {papel === 'administrador' && (
        <NavLink
          to="/usuarios"
          aria-label="Usuários"
          className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
        >
          <IconUsuarios />
          <span className="sidebar-tooltip">Usuários</span>
        </NavLink>
      )}

      <NavLink
        to="/perfil"
        aria-label="Meu perfil"
        className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
      >
        <IconPerfil />
        <span className="sidebar-tooltip">Meu perfil</span>
      </NavLink>

      <button
        type="button"
        className="sidebar-logout"
        aria-label="Sair"
        onClick={handleLogout}
      >
        <IconSair />
        <span className="sidebar-tooltip">Sair</span>
      </button>
    </aside>
  )
}

export default Sidebar
