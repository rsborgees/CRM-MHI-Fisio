import { Navigate, Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import './AreaProtegida.css'

function AreaProtegida() {
  const token = localStorage.getItem('token')

  if (!token) {
    return <Navigate to="/login" />
  }

  return (
    <div className="area-protegida">
      <Sidebar />
      <main className="area-protegida-conteudo">
        <Outlet />
      </main>
    </div>
  )
}

export default AreaProtegida
