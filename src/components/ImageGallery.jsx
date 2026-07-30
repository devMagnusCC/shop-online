import { useState } from 'react';

const PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='450' viewBox='0 0 600 450'%3E%3Crect width='600' height='450' fill='%23e5e7eb'/%3E%3Ctext x='300' y='225' text-anchor='middle' fill='%239ca3af' font-family='sans-serif' font-size='16'%3ESem imagem%3C/text%3E%3C/svg%3E`;

function isVideo(url) {
  return /\.(mp4|webm|mov)$/i.test(url);
}

export default function ImageGallery({ imagens = [], midias }) {
  // Aceita tanto 'imagens' (legado) quanto 'midias' (novo)
  const lista = midias || imagens;
  const [selected, setSelected] = useState(0);

  const items = lista.length > 0 ? lista : [PLACEHOLDER];
  const currentIsVideo = isVideo(items[selected]);

  return (
    <div>
      {/* Media principal */}
      <div className="w-full max-h-[500px] rounded-xl overflow-hidden bg-gray-100 mb-3 flex items-center justify-center">
        {currentIsVideo ? (
          <video
            src={items[selected]}
            controls
            playsInline
            className="w-full h-auto max-h-[500px] object-contain"
          >
            Seu navegador não suporta vídeo.
          </video>
        ) : (
          <img
            src={items[selected]}
            alt="Produto"
            className="w-full h-auto max-h-[500px] object-contain bg-white"
          />
        )}
      </div>

      {/* Miniaturas */}
      {items.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {items.map((media, idx) => {
            const vid = isVideo(media);
            return (
              <button
                key={idx}
                onClick={() => setSelected(idx)}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all relative ${
                  idx === selected
                    ? 'border-indigo-500 opacity-100 ring-1 ring-indigo-500'
                    : 'border-transparent opacity-60 hover:opacity-80'
                }`}
              >
                {vid ? (
                  <>
                    <video src={media} className="w-full h-full object-cover" muted playsInline />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </span>
                  </>
                ) : (
                  <img
                    src={media}
                    alt={`Miniatura ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
