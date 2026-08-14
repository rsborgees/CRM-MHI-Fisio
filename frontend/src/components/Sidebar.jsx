import { NavLink, useNavigate } from 'react-router-dom'
import {
  IconDashboard,
  IconAgenda,
  IconClientes,
  IconConversas,
  IconFinanceiro,
  IconProfissionais,
  IconServicos,
  IconConfiguracoes,
  IconSair,
} from './icons'
import './Sidebar.css'

const links = [
  { to: '/dashboard', label: 'Dashboard', Icon: IconDashboard },
  { to: '/agenda', label: 'Agenda', Icon: IconAgenda },
  { to: '/clientes', label: 'Clientes', Icon: IconClientes },
  { to: '/conversas', label: 'Conversas', Icon: IconConversas },
  { to: '/financeiro', label: 'Financeiro', Icon: IconFinanceiro },
  { to: '/profissionais', label: 'Profissionais', Icon: IconProfissionais },
  { to: '/servicos', label: 'Serviços', Icon: IconServicos },
  { to: '/configuracoes', label: 'Configurações', Icon: IconConfiguracoes },
]

function Sidebar() {
  const navigate = useNavigate()

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
