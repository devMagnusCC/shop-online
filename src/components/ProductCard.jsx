import { Link } from 'react-router-dom';
import { useFavoritos } from '../context/FavoritosContext';

const PLACEHOLDER_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23e5e7eb'/%3E%3Ctext x='200' y='150' text-anchor='middle' fill='%239ca3af' font-family='sans-serif' font-size='16'%3ESem imagem%3C/text%3E%3C/svg%3E`;

function formatPreco(value) {
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function isVideo(url) {
  return /\.(mp4|webm|mov)$/i.test(url);
}

export default function ProductCard({ produto }) {
  const { toggleFavorito, isFavorito } = useFavoritos();
  const firstMedia = produto.midias?.[0] || produto.imagens?.[0];
  const hasVideo = firstMedia && isVideo(firstMedia);
  const fav = isFavorito(produto.id);

  return (
    <div className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 relative dark:bg-gray-800 dark:border-gray-700">
      <Link
        to={`/produto/${produto.id}`}
        className="block"
      >
        <div className="aspect-[4/3] overflow-hidden bg-gray-100 relative dark:bg-gray-700">
          {!firstMedia ? (
            <img
              src={PLACEHOLDER_SVG}
              alt={produto.nome}
              className="w-full h-full object-contain p-4"
            />
          ) : hasVideo ? (
            <>
              <video
                src={firstMedia}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                muted
                loop
                playsInline
                onMouseEnter={(e) => e.currentTarget.play()}
                onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
              />
              <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                Vídeo
              </span>
            </>
          ) : (
            <img
              src={firstMedia}
              alt={produto.nome}
              className="w-full h-full object-contain bg-white p-2 group-hover:scale-105 transition-transform duration-300 dark:bg-gray-800"
              loading="lazy"
            />
          )}
          {/* Botão favoritar */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorito(produto.id); }}
            className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 hover:bg-white shadow-sm transition-all z-10 dark:bg-gray-800/80 dark:hover:bg-gray-700"
            aria-label={fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <svg
              className={`w-5 h-5 transition-colors ${fav ? 'text-red-500' : 'text-gray-400 hover:text-red-400 dark:text-gray-500 dark:hover:text-red-400'}`}
              fill={fav ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          </button>
        </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 leading-snug min-h-[2.5em] dark:text-gray-100">
          {produto.nome}
        </h3>
        {produto.descricao && (
          <p className="text-gray-500 text-xs mt-1 line-clamp-2 leading-relaxed dark:text-gray-400">
            {produto.descricao}
          </p>
        )}
        <div className="mt-3 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
            {formatPreco(produto.preco)}
          </span>
          <span className="text-xs text-indigo-600 font-medium group-hover:underline dark:text-indigo-400">
            Ver mais →
          </span>
        </div>
      </div>
    </Link>
    </div>
  );
}
