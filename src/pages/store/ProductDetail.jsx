import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProduto } from '../../api';
import ImageGallery from '../../components/ImageGallery';
import Loading from '../../components/Loading';
import { useFavoritos } from '../../context/FavoritosContext';

function formatPreco(value) {
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export default function ProductDetail() {
  const { id } = useParams();
  const [produto, setProduto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { toggleFavorito, isFavorito } = useFavoritos();

  const fetchProduto = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProduto(id);
      setProduto(data.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Produto não encontrado');
      } else {
        setError('Erro ao carregar o produto. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduto();
    window.scrollTo(0, 0);
  }, [id]);

  if (loading) return <Loading text="Carregando produto..." />;

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="text-gray-300 text-5xl mb-4 dark:text-gray-600">
          {error.includes('não encontrado') ? '🔍' : '⚠'}
        </div>
        <h2 className="text-xl font-semibold text-gray-700 mb-2 dark:text-gray-300">{error}</h2>
        <Link
          to="/"
          className="inline-block mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
        >
          ← Voltar para loja
        </Link>
      </div>
    );
  }

  if (!produto) return null;

  // Suporta tanto 'midias' (novo) quanto 'imagens' (legado)
  const listaMidias = produto.midias || produto.imagens || [];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <nav className="mb-6 text-sm text-gray-400 dark:text-gray-500">
        <Link to="/" className="hover:text-indigo-600 transition-colors">
          Loja
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600 dark:text-gray-300">{produto.nome}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Mídias */}
        <div>
          <ImageGallery midias={listaMidias} />
        </div>

        {/* Detalhes */}
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              {produto.nome}
            </h1>
            <button
              onClick={() => toggleFavorito(produto.id)}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors dark:hover:bg-gray-800"
              aria-label={isFavorito(produto.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              <svg
                className={`w-6 h-6 transition-colors ${isFavorito(produto.id) ? 'text-red-500' : 'text-gray-400 hover:text-red-400 dark:text-gray-500 dark:hover:text-red-400'}`}
                fill={isFavorito(produto.id) ? 'currentColor' : 'none'}
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </button>
          </div>

          <div className="text-3xl font-bold text-indigo-600 mb-6 dark:text-indigo-400">
            {formatPreco(produto.preco)}
          </div>

          {produto.descricao && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 dark:text-gray-400">
                Descrição
              </h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap dark:text-gray-300">
                {produto.descricao}
              </p>
            </div>
          )}

          <div className="mt-auto pt-6 border-t border-gray-100 dark:border-gray-800">
            <a
              href={produto.linkCompra}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center px-8 py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
            >
              Comprar agora
              <svg
                className="ml-2 w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
            <p className="text-xs text-gray-400 text-center mt-2 dark:text-gray-500">
              Você será redirecionado para finalizar a compra
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
