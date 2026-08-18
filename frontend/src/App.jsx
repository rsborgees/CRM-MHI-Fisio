import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Agenda from './pages/Agenda'
import Clientes from './pages/Clientes'
import ClientePerfil from './pages/ClientePerfil'
import Conversas from './pages/Conversas'
import Financeiro from './pages/Financeiro'
import Profissionais from './pages/Profissionais'
import Servicos from './pages/Servicos'
import Pacotes from './pages/Pacotes'
import Configuracoes from './pages/Configuracoes'
import Perfil from './pages/Perfil'
import Usuarios from './pages/Usuarios'
import AreaProtegida from './components/AreaProtegida'
import RequirePapel from './components/RequirePapel'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<AreaProtegida />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/clientes/:id" element={<ClientePerfil />} />
          <Route path="/conversas" element={<Conversas />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/profissionais" element={<Profissionais />} />
          <Route path="/servicos" element={<Servicos />} />
          <Route path="/pacotes" element={<Pacotes />} />
          <Route
            path="/configuracoes"
            element={
              <RequirePapel papeis={['administrador', 'desenvolvedor']}>
                <Configuracoes />
              </RequirePapel>
            }
          />
          <Route path="/perfil" element={<Perfil />} />
          <Route
            path="/usuarios"
            element={
              <RequirePapel papeis={['administrador']}>
                <Usuarios />
              </RequirePapel>
            }
          />
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
