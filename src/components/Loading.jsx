export default function Loading({ text = 'Carregando...' }) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600" />
        <p className="mt-3 text-gray-500 text-sm">{text}</p>
      </div>
    </div>
  );
}
