import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function RootRedirect() {
  const { user } = useAuth()
  return <Navigate to={user ? '/chat' : '/login'} replace />
}

export default RootRedirect