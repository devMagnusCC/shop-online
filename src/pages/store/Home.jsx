import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getProdutos } from '../../api';
import ProductCard from '../../components/ProductCard';
import Loading from '../../components/Loading';
import { CATEGORIAS } from '../../constants/categorias';

export default function Home() {
  const { search } = useOutletContext();
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categoriaAtiva, setCategoriaAtiva] = useState('');

  const fetchProdutos = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProdutos();
      setProdutos(data.data || []);
    } catch (err) {
      setError('Erro ao carregar os produtos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProdutos();
  }, []);

  const filteredProdutos = produtos.filter((p) => {
    const matchSearch = p.nome.toLowerCase().includes(search.toLowerCase());
    const matchCategoria = !categoriaAtiva || p.categoria === categoriaAtiva;
    return matchSearch && matchCategoria;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
          Nossos Produtos
        </h1>
        <p className="text-gray-500 max-w-lg mx-auto">
          Confira nossa seleção de produtos. Clique para ver detalhes e comprar.
        </p>
      </div>

      {/* Categorias */}
      {!loading && !error && produtos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-thin">
          <button
            onClick={() => setCategoriaAtiva('')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              categoriaAtiva === ''
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
          {CATEGORIAS.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoriaAtiva(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                categoriaAtiva === cat
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && <Loading text="Carregando produtos..." />}

      {/* Error */}
      {!loading && error && (
        <div className="text-center py-16">
          <div className="text-red-400 text-5xl mb-4">⚠</div>
          <p className="text-gray-700 mb-4">{error}</p>
          <button
            onClick={fetchProdutos}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Empty (sem produtos cadastrados) */}
      {!loading && !error && produtos.length === 0 && (
        <div className="text-center py-16">
          <div className="text-gray-300 text-5xl mb-4">🛍️</div>
          <h2 className="text-xl font-semibold text-gray-600 mb-2">
            Nenhum produto disponível
          </h2>
        </div>
      )}

      {/* Sem resultado na busca ou categoria */}
      {!loading && !error && produtos.length > 0 && filteredProdutos.length === 0 && (
        <div className="text-center py-16">
          <div className="text-gray-300 text-5xl mb-4">🔍</div>
          <h2 className="text-xl font-semibold text-gray-600 mb-2">
            {search
              ? `Nenhum resultado para "${search}"`
              : 'Nenhum produto nesta categoria'}
          </h2>
          <p className="text-gray-400">Tente outro termo de busca ou selecione outra categoria</p>
        </div>
      )}

      {/* Product Grid */}
      {!loading && !error && filteredProdutos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {filteredProdutos.map((produto) => (
            <ProductCard key={produto.id} produto={produto} />
          ))}
        </div>
      )}
    </div>
  );
}
