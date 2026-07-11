import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth ต้องถูกใช้ภายใน AuthProvider เท่านั้น')
  }
  return context
}