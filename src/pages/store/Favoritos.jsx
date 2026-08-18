import { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { getProdutos } from '../../api';
import ProductCard from '../../components/ProductCard';
import Loading from '../../components/Loading';
import { useFavoritos } from '../../context/FavoritosContext';

export default function Favoritos() {
  const { search } = useOutletContext();
  const { favoritos, syncFavoritos } = useFavoritos();
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProdutos = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProdutos();
      const lista = data.data || [];
      setProdutos(lista);
      // Remove favoritos de produtos que não existem mais no catalogo
      syncFavoritos(lista);
    } catch (err) {
      setError('Erro ao carregar os produtos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProdutos();
  }, []);

  const favoritosList = produtos.filter((p) => favoritos.includes(p.id));

  const filteredFavoritos = favoritosList.filter((p) =>
    p.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 dark:text-gray-100">
          Meus Favoritos
        </h1>
        <p className="text-gray-500 max-w-lg mx-auto dark:text-gray-400">
          {favoritosList.length > 0
            ? `${favoritosList.length} produto(s) favoritado(s)`
            : 'Você ainda não favoritou nenhum produto'}
        </p>
      </div>

      {/* Loading */}
      {loading && <Loading text="Carregando produtos..." />}

      {/* Error */}
      {!loading && error && (
        <div className="text-center py-16">
          <div className="text-red-400 text-5xl mb-4">⚠</div>
          <p className="text-gray-700 mb-4 dark:text-gray-300">{error}</p>
          <button
            onClick={fetchProdutos}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Sem favoritos ainda */}
      {!loading && !error && favoritos.length === 0 && (
        <div className="text-center py-16">
          <div className="text-gray-300 text-5xl mb-4 dark:text-gray-600">💛</div>
          <h2 className="text-xl font-semibold text-gray-600 mb-2 dark:text-gray-300">
            Nenhum favorito ainda
          </h2>
          <p className="text-gray-400 mb-6 dark:text-gray-500">
            Clique no coração dos produtos para adicioná-los aqui
          </p>
          <Link
            to="/"
            className="inline-block px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
          >
            Ver produtos
          </Link>
        </div>
      )}

      {/* Nenhum resultado na busca */}
      {!loading && !error && favoritos.length > 0 && filteredFavoritos.length === 0 && (
        <div className="text-center py-16">
          <div className="text-gray-300 text-5xl mb-4 dark:text-gray-600">🔍</div>
          <h2 className="text-xl font-semibold text-gray-600 mb-2 dark:text-gray-300">
            Nenhum resultado para "{search}"
          </h2>
          <p className="text-gray-400 dark:text-gray-500">Tente outro termo de busca</p>
        </div>
      )}

      {/* Grid de favoritos */}
      {!loading && !error && filteredFavoritos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {filteredFavoritos.map((produto) => (
            <ProductCard key={produto.id} produto={produto} />
          ))}
        </div>
      )}
    </div>
  );
}
