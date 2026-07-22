import { Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Chat from './pages/Chat'
import Dashboard from './pages/admin/Dashboard'
import UploadDocument from './pages/admin/UploadDocument'
import DocumentManagement from './pages/admin/DocumentManagement'
import DocumentChunks from './pages/admin/DocumentChunks'
import ProtectedRoute from './components/layout/ProtectedRoute'
import RootRedirect from './pages/RootRedirect'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />

      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/upload"
        element={
          <ProtectedRoute>
            <UploadDocument />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/documents"
        element={
          <ProtectedRoute>
            <DocumentManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/documents/:id"
        element={
          <ProtectedRoute>
            <DocumentChunks />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App