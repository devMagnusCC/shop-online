import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProdutos, deleteProduto, updateProduto, verificarPreco } from '../../api';
import Loading from '../../components/Loading';

function formatPreco(value) {
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export default function Dashboard() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [verificandoPreco, setVerificandoPreco] = useState(null);
  const [precoModal, setPrecoModal] = useState(null);

  const fetchProdutos = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProdutos();
      setProdutos(data.data || []);
    } catch (err) {
      setError('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProdutos();
  }, []);

  const handleDelete = async (id) => {
    setDeleting(true);
    try {
      await deleteProduto(id);
      setProdutos((prev) => prev.filter((p) => p.id !== id));
      setSuccessMsg('Produto removido com sucesso!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError('Erro ao remover produto');
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const handleVerificarPreco = async (id) => {
    setVerificandoPreco(id);
    setError(null);
    try {
      const result = await verificarPreco(id);
      const modalData = { ...result.data, produtoId: id };

      // Se o backend não conseguiu, tenta consultar direto do navegador
      if (result.data.suportada && result.data.precoSugerido == null && result.data.lojaId) {
        try {
          const loja = result.data.loja;
          let reqUrl = '';
          let parseFn = null;

          if (loja === 'mercadolivre') {
            reqUrl = `https://api.mercadolibre.com/items/${result.data.lojaId}`;
            parseFn = (d) => d.price != null ? { preco: d.price, moeda: d.currency_id || 'BRL' } : null;
          } else if (loja === 'amazon') {
            // Amazon não tem API pública — tentar via scraping reverso é arriscado
            // Deixa o link manual
          } else if (loja === 'shopee') {
            // Shopee API pública de busca de preço
            const [shopId, itemId] = result.data.lojaId.split('_');
            if (shopId && itemId) {
              reqUrl = `https://shopee.com.br/api/v4/item/get?item_id=${itemId}&shop_id=${shopId}`;
              parseFn = (d) => d?.data?.price_min ? { preco: d.data.price_min / 100000, moeda: 'BRL' } : null;
            }
          }

          if (reqUrl && parseFn) {
            const mlRes = await fetch(reqUrl, {
              headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
            });
            if (mlRes.ok) {
              const data = await mlRes.json();
              const parsed = parseFn(data);
              if (parsed) {
                modalData.precoSugerido = parsed.preco;
                modalData.moeda = parsed.moeda;
                modalData.mensagem = null;
              }
            }
          }
        } catch {
          // Falhou no frontend também — mantém o resultado original
        }
      }

      setPrecoModal(modalData);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao verificar preço');
    } finally {
      setVerificandoPreco(null);
    }
  };

  const handleAtualizarPreco = async (id, novoPreco) => {
    try {
      const produto = produtos.find((p) => p.id === id);
      if (!produto) return;
      await updateProduto(id, {
        nome: produto.nome,
        descricao: produto.descricao || '',
        preco: novoPreco,
        midias: produto.midias || [],
        categoria: produto.categoria || '',
        linkCompra: produto.linkCompra,
      });
      setProdutos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, preco: novoPreco } : p))
      );
      setPrecoModal(null);
      setSuccessMsg('Preço atualizado com sucesso!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError('Erro ao atualizar preço');
    }
  };

  if (loading) return <Loading text="Carregando produtos..." />;

  const filteredProdutos = produtos.filter((p) =>
    p.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>
          <p className="text-sm text-gray-500 mt-1">
            {produtos.length} produto(s) cadastrado(s)
          </p>
        </div>
        <Link
          to="/admin/novo"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium text-center"
        >
          + Novo Produto
        </Link>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar produtos..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow text-sm bg-white"
          />
        </div>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg border border-green-200 mb-4">
          {successMsg}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg border border-red-200 mb-4 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Empty state */}
      {produtos.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="text-gray-300 text-5xl mb-4">📦</div>
          <h2 className="text-lg font-semibold text-gray-600 mb-2">
            Nenhum produto cadastrado
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            Clique no botão acima para adicionar o primeiro produto
          </p>
          <Link
            to="/admin/novo"
            className="inline-block px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
          >
            Adicionar Produto
          </Link>
        </div>
      ) : (
        /* Product table */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {search && filteredProdutos.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">
              Nenhum produto encontrado para "<strong className="text-gray-600">{search}</strong>"
            </div>
          )}
          {filteredProdutos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">
                      Produto
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 hidden sm:table-cell">
                      Preço
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 hidden md:table-cell">
                      Categoria
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 hidden md:table-cell">
                      Link
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProdutos.map((produto) => (
                    <tr key={produto.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {(produto.midias?.[0] || produto.imagens?.[0]) && (
                            <img
                              src={produto.midias?.[0] || produto.imagens?.[0]}
                              alt=""
                              className="w-10 h-10 rounded-lg object-cover bg-gray-100 flex-shrink-0"
                            />
                          )}
                          <span className="font-medium text-gray-900 line-clamp-1">
                            {produto.nome}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-700 hidden sm:table-cell">
                        {formatPreco(produto.preco)}
                      </td>
                      <td className="py-3 px-4 text-gray-500 hidden md:table-cell">
                        {produto.categoria || <span className="text-gray-300">&mdash;</span>}
                      </td>
                      <td className="py-3 px-4 text-gray-400 hidden md:table-cell max-w-[200px] truncate">
                        {produto.linkCompra}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleVerificarPreco(produto.id)}
                            disabled={verificandoPreco === produto.id}
                            className="px-3 py-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors text-xs font-medium disabled:opacity-50"
                          >
                            {verificandoPreco === produto.id ? 'Verificando...' : 'Verificar Preço'}
                          </button>
                          <Link
                            to={`/admin/editar/${produto.id}`}
                            className="px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors text-xs font-medium"
                          >
                            Editar
                          </Link>
                          <button
                            onClick={() => setDeleteConfirm(produto.id)}
                            className="px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors text-xs font-medium"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Preço verification modal */}
      {precoModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            {precoModal.suportada ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Comparação de Preço
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-500">Preço atual (cadastrado):</span>
                    <span className="font-semibold text-gray-900">{formatPreco(precoModal.precoAtual)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-t border-gray-100">
                    <span className="text-gray-500">Preço no link:</span>
                    <span className={`font-semibold ${precoModal.precoSugerido != null ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {precoModal.precoSugerido != null ? formatPreco(precoModal.precoSugerido) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-t border-gray-100">
                    <span className="text-gray-500">Loja:</span>
                    <span className="font-medium capitalize text-gray-700">
                      {precoModal.loja === 'mercadolivre' ? 'Mercado Livre' : precoModal.loja === 'amazon' ? 'Amazon' : precoModal.loja === 'shopee' ? 'Shopee' : precoModal.loja || '—'}
                    </span>
                  </div>
                </div>

                {precoModal.precoSugerido == null && precoModal.linkCompra ? (
                  <p className="mt-3 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                    Não foi possível buscar o preço automaticamente.{' '}
                    <a
                      href={precoModal.linkCompra}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline hover:text-amber-800"
                    >
                      Ver preço no site
                    </a>
                  </p>
                ) : precoModal.mensagem ? (
                  <p className="mt-3 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                    {precoModal.mensagem}
                  </p>
                ) : null}

                {precoModal.precoSugerido != null && precoModal.precoAtual !== precoModal.precoSugerido && (
                  <p className="mt-3 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                    O preço do produto difere do valor encontrado no link.
                  </p>
                )}

                {precoModal.precoSugerido != null && precoModal.precoAtual === precoModal.precoSugerido && (
                  <p className="mt-3 text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
                    O preço já está atualizado!
                  </p>
                )}

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setPrecoModal(null)}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Fechar
                  </button>
                  {precoModal.precoSugerido != null && precoModal.precoAtual !== precoModal.precoSugerido && (
                    <button
                      onClick={() => handleAtualizarPreco(precoModal.produtoId, precoModal.precoSugerido)}
                      className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      Atualizar Preço
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Loja não suportada
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  {precoModal.mensagem || 'Não foi possível verificar o preço para esta loja.'}
                </p>
                <p className="text-xs text-gray-400 mb-6">
                  Atualmente suportamos Mercado Livre, Amazon e Shopee.
                </p>
                <div className="flex justify-end">
                  <button
                    onClick={() => setPrecoModal(null)}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Excluir produto?
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Esta ação não pode ser desfeita. O produto e suas imagens serão
              removidos permanentemente.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {deleting && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
