import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FavoritosProvider } from './context/FavoritosContext';
import { ThemeProvider } from './context/ThemeContext';
import StoreLayout from './pages/store/StoreLayout';
import Home from './pages/store/Home';
import ProductDetail from './pages/store/ProductDetail';
import Favoritos from './pages/store/Favoritos';
import Ajuda from './pages/store/Ajuda';
import AdminLayout from './pages/admin/AdminLayout';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import ProductForm from './pages/admin/ProductForm';
import Loading from './components/Loading';

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <Loading text="Verificando autenticação..." />;
  if (!user) return <Navigate to="/admin/login" replace />;

  return children;
}

function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <FavoritosProvider>
        <Routes>
          {/* Store routes */}
          <Route element={<StoreLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/produto/:id" element={<ProductDetail />} />
            <Route path="/favoritos" element={<Favoritos />} />
            <Route path="/ajuda" element={<Ajuda />} />
          </Route>

          {/* Admin login (no layout) */}
          <Route path="/admin/login" element={<Login />} />

          {/* Admin routes (protected) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="novo" element={<ProductForm />} />
            <Route path="editar/:id" element={<ProductForm />} />
          </Route>

          {/* 404 */}
          <Route
            path="*"
            element={
              <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <div className="text-center">
                  <h1 className="text-6xl font-bold text-gray-200 dark:text-gray-700 mb-4">404</h1>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">Página não encontrada</p>
                  <a
                    href="/"
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                  >
                    Voltar para loja
                  </a>
                </div>
              </div>
            }
          />
        </Routes>
        </FavoritosProvider>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
