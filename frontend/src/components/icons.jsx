const props = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function IconDashboard() {
  return (
    <svg {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

export function IconClientes() {
  return (
    <svg {...props}>
      <circle cx="8" cy="8" r="3.2" />
      <path d="M2.5 20c0-3.6 2.5-6 5.5-6s5.5 2.4 5.5 6" />
      <circle cx="17" cy="8" r="2.4" />
      <path d="M14.5 14.2c.7-.3 1.5-.4 2.3-.4 2.8 0 5 2.2 5.2 5" />
    </svg>
  )
}

export function IconProfissionais() {
  return (
    <svg {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7 18c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5" />
    </svg>
  )
}

export function IconServicos() {
  return (
    <svg {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  )
}

export function IconPacotes() {
  return (
    <svg {...props}>
      <path d="M3 8l9-5 9 5-9 5-9-5z" />
      <path d="M3 8v9l9 5 9-5V8" />
      <path d="M12 13v9" />
    </svg>
  )
}

export function IconAgenda() {
  return (
    <svg {...props}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 2v4M16 2v4" />
      <path d="M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2" />
    </svg>
  )
}

export function IconFinanceiro() {
  return (
    <svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 15c0 1.4 1.2 2.2 2.5 2.2s2.5-.7 2.5-2c0-1.4-1.2-1.8-2.5-2.2S9.5 12.2 9.5 11c0-1.3 1.2-2 2.5-2s2.3.6 2.5 1.7" />
    </svg>
  )
}

export function IconConversas() {
  return (
    <svg {...props}>
      <path d="M4 5h16v11H9l-4 4V5z" />
      <path d="M8 9h8M8 12.5h5" />
    </svg>
  )
}

export function IconUsuarios() {
  return (
    <svg {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <circle cx="12" cy="9.5" r="2.6" />
      <path d="M8 16c.6-2 2-3 4-3s3.4 1 4 3" />
      <path d="M8 3.5v-1M16 3.5v-1" />
    </svg>
  )
}

export function IconEditar() {
  return (
    <svg {...props} width="16" height="16">
      <path d="M4 20l1-4L16 5l3 3L8 19l-4 1z" />
      <path d="M14 7l3 3" />
    </svg>
  )
}

export function IconExcluir() {
  return (
    <svg {...props} width="16" height="16">
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

export function IconConfiguracoes() {
  return (
    <svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.35a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.65 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.65a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.35 9c.13.42.5 1.04 1.56 1.04H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15z" />
    </svg>
  )
}

export function IconPerfil() {
  return (
    <svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="10" r="3.2" />
      <path d="M6.3 18.5c.8-2.6 2.9-4 5.7-4s4.9 1.4 5.7 4" />
    </svg>
  )
}

export function IconSair() {
  return (
    <svg {...props}>
      <path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="M16 16l4-4-4-4" />
      <path d="M20 12H9" />
    </svg>
  )
}
