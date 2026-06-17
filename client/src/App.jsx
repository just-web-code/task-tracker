import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Workspaces from './pages/Workspaces.jsx'
import WorkspaceDetail from './pages/WorkspaceDetail.jsx'
import ProjectBoard from './pages/ProjectBoard.jsx'
import ProjectStats from './pages/ProjectStats.jsx'

function Protected({ children }) {
  const { isAuthed } = useAuth()
  if (!isAuthed) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  const { isAuthed } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={isAuthed ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<Protected><Workspaces /></Protected>} />
      <Route path="/workspaces/:wid" element={<Protected><WorkspaceDetail /></Protected>} />
      <Route path="/projects/:pid" element={<Protected><ProjectBoard /></Protected>} />
      <Route path="/projects/:pid/stats" element={<Protected><ProjectStats /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
