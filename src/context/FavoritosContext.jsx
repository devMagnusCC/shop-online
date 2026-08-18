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

  // Recebe a lista de produtos existentes e remove do estado/localStorage
// os IDs de favoritos que nao correspondem a nenhum produto atual.
// Evita contadores "fantasma" quando um produto favoritado e excluido.
const syncFavoritos = (produtos) => {
    const idsValidos = new Set(produtos.map((p) => p.id));
    setFavoritos((prev) => {
      const filtrados = prev.filter((id) => idsValidos.has(id));
      return filtrados.length === prev.length ? prev : filtrados;
    });
  };

  return (
    <FavoritosContext.Provider value={{ favoritos, toggleFavorito, isFavorito, syncFavoritos }}>
      {children}
    </FavoritosContext.Provider>
  );
}

export function useFavoritos() {
  const ctx = useContext(FavoritosContext);
  if (!ctx) throw new Error('useFavoritos deve ser usado dentro de FavoritosProvider');
  return ctx;
}
