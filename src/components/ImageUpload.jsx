import { useState, useRef } from 'react';
import { uploadImagens, deleteImagem } from '../api';

function isVideo(url) {
  return /\.(mp4|webm|mov)$/i.test(url);
}

export default function ImageUpload({ midias = [], onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const handleSelect = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const result = await uploadImagens(files);
      if (result.success) {
        onChange([...midias, ...result.data]);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao fazer upload');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = async (mediaPath) => {
    const filename = mediaPath.split('/').pop();
    try {
      await deleteImagem(filename);
    } catch {
      // Se falhar ao deletar do servidor, ainda remove da lista
    }
    onChange(midias.filter((m) => m !== mediaPath));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Mídias do Produto (imagens e/ou vídeos)
      </label>

      {/* Preview grid */}
      {midias.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-3">
          {midias.map((media, idx) => {
            const vid = isVideo(media);
            return (
              <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 border">
                {vid ? (
                  <div className="w-full h-full relative">
                    <video src={media} className="w-full h-full object-cover" muted playsInline />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </span>
                  </div>
                ) : (
                  <img src={media} alt={`Mídia ${idx + 1}`} className="w-full h-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(media)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
                  title="Remover"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload buttons */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (fileRef.current) {
                fileRef.current.accept = 'image/*';
                fileRef.current.click();
              }
            }}
            disabled={uploading}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Adicionar imagens
          </button>
          <button
            type="button"
            onClick={() => {
              if (fileRef.current) {
                fileRef.current.accept = 'video/*';
                fileRef.current.click();
              }
            }}
            disabled={uploading}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Adicionar vídeo
          </button>
          {uploading && (
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>

      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
      <p className="text-gray-400 text-xs mt-1">
        Imagens: JPG, PNG, GIF, WebP, SVG (máx. 5MB) | Vídeos: MP4, WebM, MOV (máx. 50MB)
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleSelect}
        className="hidden"
      />
    </div>
  );
}
