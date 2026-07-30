import { createContext, useContext, useState, useEffect } from 'react';

const FavoritosContext = createContext(null);

const STORAGE_KEY = 'loja_favoritos';

export function FavoritosProvider({ children }) {
  const [favoritos, setFavoritos] = useState([]);

  // Carregar do localStorage ao montar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setFavoritos(JSON.parse(saved));
      }
    } catch {
      // localStorage indisponível ou corrompido
    }
  }, []);

  // Persistir no localStorage sempre que mudar
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favoritos));
    } catch {
      // localStorage indisponível
    }
  }, [favoritos]);

  const toggleFavorito = (id) => {
    setFavoritos((prev) =>
      prev.includes(id)
        ? prev.filter((fid) => fid !== id)
        : [...prev, id]
    );
  };

  const isFavorito = (id) => favoritos.includes(id);

  return (
    <FavoritosContext.Provider value={{ favoritos, toggleFavorito, isFavorito }}>
      {children}
    </FavoritosContext.Provider>
  );
}

export function useFavoritos() {
  const ctx = useContext(FavoritosContext);
  if (!ctx) throw new Error('useFavoritos deve ser usado dentro de FavoritosProvider');
  return ctx;
}
