import { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('admin_token');
    const username = sessionStorage.getItem('admin_username');
    if (token && username) {
      setUser({ username, token });
    }
    setLoading(false);
  }, []);

  const loginFn = async (username, password) => {
    const data = await apiLogin(username, password);
    if (data.success) {
      sessionStorage.setItem('admin_token', data.token);
      sessionStorage.setItem('admin_username', data.username);
      setUser({ username: data.username, token: data.token });
    }
    return data;
  };

  const logout = () => {
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_username');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login: loginFn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
