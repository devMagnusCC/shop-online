import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Admin Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity" target="_blank">
              <img src="/logo.jpg" alt="Achadinhos Clubedodesconto" className="h-7 w-7 rounded-full object-cover" />
              <span className="font-bold text-gray-900">Achadinhos CD</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                target="_blank"
              >
                Ver loja ↗
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-red-500 hover:text-red-700 transition-colors cursor-pointer"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>


      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
