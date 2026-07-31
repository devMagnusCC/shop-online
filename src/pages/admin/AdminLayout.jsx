import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
      {/* Admin Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 dark:bg-gray-900 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity" target="_blank">
              <img src="/logo.jpg" alt="Achadinhos Clubedodesconto" className="h-7 w-7 rounded-full object-cover" />
              <span className="font-bold text-gray-900 dark:text-gray-100">Achadinhos CD</span>
            </Link>
            <div className="flex items-center gap-4">
              <button
                onClick={toggleTheme}
                className="text-sm text-gray-400 hover:text-indigo-600 transition-colors dark:text-gray-300 dark:hover:text-indigo-400"
                aria-label={theme === 'dark' ? 'Usar modo claro' : 'Usar modo escuro'}
                title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
              >
                {theme === 'dark' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5m6.364 1.136l-1.06 1.06M21 12h-1.5m-1.136 6.364l-1.06-1.06M12 18.75V21m-4.773-4.227l-1.06 1.06M5.25 12H3.75m4.227-4.773L6.977 6.167M12 6.75a5.25 5.25 0 100 10.5 5.25 5.25 0 000-10.5z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                  </svg>
                )}
              </button>
              <Link
                to="/"
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors dark:text-gray-300 dark:hover:text-gray-400"
                target="_blank"
              >
                Ver loja ↗
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-red-500 hover:text-red-700 transition-colors cursor-pointer dark:hover:text-red-400"
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
