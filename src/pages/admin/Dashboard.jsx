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

      // Se o backend não conseguiu, tenta consultar via proxy do backend (contorna CORS)
      if (result.data.suportada && result.data.precoSugerido == null && result.data.lojaId) {
        let reqUrl = '';
        let parseFn = null;

        const loja = result.data.loja;

        if (loja === 'mercadolivre') {
          reqUrl = `/api/preco/mercadolivre/${result.data.lojaId}`;
          parseFn = (d) => d.preco != null ? { preco: d.preco, moeda: d.moeda } : null;
        } else if (loja === 'shopee') {
          const [shopId, itemId] = result.data.lojaId.split('_');
          if (shopId && itemId) {
            reqUrl = `/api/preco/shopee?shop_id=${shopId}&item_id=${itemId}`;
            parseFn = (d) => d?.preco != null ? { preco: d.preco, moeda: d.moeda } : null;
          }
        }

        if (reqUrl && parseFn) {
          try {
            console.log('[DEBUG] Tentando proxy do backend:', reqUrl);
            const proxyRes = await fetch(reqUrl, {
              headers: { Accept: 'application/json' },
            });
            console.log('[DEBUG] Proxy response status:', proxyRes.status);
            if (reqUrl && parseFn) {
          try {
            console.log('[DEBUG] Tentando proxy do backend:', reqUrl);
            const proxyRes = await fetch(reqUrl, {
              headers: { Accept: 'application/json' },
            });
            console.log('[DEBUG] Proxy response status:', proxyRes.status);
            if (proxyRes.ok) {
              const data = await proxyRes.json();
              const parsed = parseFn(data);
              if (parsed) {
                modalData.precoSugerido = parsed.preco;
                modalData.moeda = parsed.moeda;
                modalData.mensagem = null;
              } else {
                console.warn('[DEBUG] ParseFn retornou null');
              }
            } else {
              const errText = await proxyRes.text().catch(() => '');
              console.warn('[DEBUG] Proxy falhou:', proxyRes.status, errText.slice(0, 200));
            }
          } catch (err) {
            console.error('[DEBUG] Erro no fetch do proxy:', err);
          }
        } else {
          console.warn('[DEBUG] reqUrl ou parseFn não definidos');
        }
      } catch (err) {
        console.error('[DEBUG] Erro no bloco de verificação de preço:', err);
      }

      setPrecoModal(modalData);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao verificar preço');
    } finally {
      setVerificandoPreco(null);
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Produtos</h1>
          <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
            {produtos.length} produto(s) cadastrado(s)
          </p>
        </div>
        <div className="flex gap-2">
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
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar produtos..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow text-sm bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg border border-green-200 mb-4 dark:bg-green-950/50 dark:text-green-300 dark:border-green-900">
          {successMsg}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg border border-red-200 mb-4 flex items-center justify-between dark:bg-red-950/50 dark:text-red-300 dark:border-red-900">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 ml-4 dark:hover:text-red-300"
          >
            ✕
          </button>
        </div>
      )}

      {/* Empty state */}
      {produtos.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200 dark:bg-gray-900 dark:border-gray-800">
          <div className="text-gray-300 text-5xl mb-4 dark:text-gray-600">📦</div>
          <h2 className="text-lg font-semibold text-gray-600 mb-2 dark:text-gray-300">
            Nenhum produto cadastrado
          </h2>
          <p className="text-gray-400 text-sm mb-4 dark:text-gray-500">
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
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden dark:bg-gray-900 dark:border-gray-800">
          {search && filteredProdutos.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm dark:text-gray-500">
              Nenhum produto encontrado para "<strong className="text-gray-600 dark:text-gray-300">{search}</strong>"
            </div>
          )}
          {filteredProdutos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                      Produto
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 hidden sm:table-cell dark:text-gray-400">
                      Preço
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 hidden md:table-cell dark:text-gray-400">
                      Categoria
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 hidden md:table-cell dark:text-gray-400">
                      Link
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredProdutos.map((produto) => (
                    <tr key={produto.id} className="hover:bg-gray-50 transition-colors dark:hover:bg-gray-800/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {(produto.midias?.[0] || produto.imagens?.[0]) && (
                            <img
                              src={produto.midias?.[0] || produto.imagens?.[0]}
                              alt=""
                              className="w-10 h-10 rounded-lg object-cover bg-gray-100 flex-shrink-0 dark:bg-gray-800"
                            />
                          )}
                          <span className="font-medium text-gray-900 line-clamp-1 dark:text-gray-100">
                            {produto.nome}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-700 hidden sm:table-cell dark:text-gray-300">
                        {formatPreco(produto.preco)}
                      </td>
                      <td className="py-3 px-4 text-gray-500 hidden md:table-cell dark:text-gray-400">
                        {produto.categoria || <span className="text-gray-300 dark:text-gray-600">&mdash;</span>}
                      </td>
                      <td className="py-3 px-4 text-gray-400 hidden md:table-cell max-w-[200px] truncate dark:text-gray-500">
                        {produto.linkCompra}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleVerificarPreco(produto.id)}
                            disabled={verificandoPreco === produto.id}
                            className="px-3 py-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors text-xs font-medium disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                          >
                            {verificandoPreco === produto.id ? 'Verificando...' : 'Verificar Preço'}
                          </button>
                          <Link
                            to={`/admin/editar/${produto.id}`}
                            className="px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors text-xs font-medium dark:text-indigo-400 dark:hover:bg-indigo-950/50"
                          >
                            Editar
                          </Link>
                          <button
                            onClick={() => setDeleteConfirm(produto.id)}
                            className="px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors text-xs font-medium dark:hover:bg-red-950/50"
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
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full dark:bg-gray-900">
            {precoModal.suportada ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 dark:text-gray-100">
                  Comparação de Preço
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-500 dark:text-gray-400">Preço atual (cadastrado):</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{formatPreco(precoModal.precoAtual)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-gray-500 dark:text-gray-400">Preço no link:</span>
                    <span className={`font-semibold ${precoModal.precoSugerido != null ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
                      {precoModal.precoSugerido != null ? formatPreco(precoModal.precoSugerido) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-gray-500 dark:text-gray-400">Loja:</span>
                    <span className="font-medium capitalize text-gray-700 dark:text-gray-300">
                      {precoModal.loja === 'mercadolivre' ? 'Mercado Livre' : precoModal.loja === 'amazon' ? 'Amazon' : precoModal.loja === 'shopee' ? 'Shopee' : precoModal.loja || '—'}
                    </span>
                  </div>
                </div>

                {precoModal.precoSugerido == null && precoModal.linkCompra ? (
                  <p className="mt-3 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg dark:text-amber-300 dark:bg-amber-950/50">
                    Não foi possível buscar o preço automaticamente.{' '}
                    <a
                      href={precoModal.linkCompra}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline hover:text-amber-800 dark:hover:text-amber-300"
                    >
                      Ver preço no site
                    </a>
                  </p>
                ) : precoModal.mensagem ? (
                  <p className="mt-3 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg dark:text-gray-400 dark:bg-gray-800">
                    {precoModal.mensagem}
                  </p>
                ) : null}

                {precoModal.precoSugerido != null && precoModal.precoAtual !== precoModal.precoSugerido && (
                  <p className="mt-3 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg dark:text-amber-300 dark:bg-amber-950/50">
                    O preço do produto difere do valor encontrado no link.
                  </p>
                )}

                {precoModal.precoSugerido != null && precoModal.precoAtual === precoModal.precoSugerido && (
                  <p className="mt-3 text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg dark:text-emerald-300 dark:bg-emerald-950/50">
                    O preço já está atualizado!
                  </p>
                )}

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setPrecoModal(null)}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-300 dark:hover:bg-gray-800"
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
                <h3 className="text-lg font-semibold text-gray-900 mb-2 dark:text-gray-100">
                  Loja não suportada
                </h3>
                <p className="text-sm text-gray-500 mb-6 dark:text-gray-400">
                  {precoModal.mensagem || 'Não foi possível verificar o preço para esta loja.'}
                </p>
                <p className="text-xs text-gray-400 mb-6 dark:text-gray-500">
                  Atualmente suportamos Mercado Livre, Amazon e Shopee.
                </p>
                <div className="flex justify-end">
                  <button
                    onClick={() => setPrecoModal(null)}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-300 dark:hover:bg-gray-800"
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
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 dark:text-gray-100">
              Excluir produto?
            </h3>
            <p className="text-sm text-gray-500 mb-6 dark:text-gray-400">
              Esta ação não pode ser desfeita. O produto e suas imagens serão
              removidos permanentemente.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-300 dark:hover:bg-gray-800"
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

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 dark:text-gray-100">
              Importar Preços via CSV
            </h3>
            <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">
              Formato do CSV: <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">id,preco</code> ou <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs">linkCompra,preco</code>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                  Arquivo CSV
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setImportFile(e.target.files[0])}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              {importResult && (
                <div className={`p-3 rounded-lg text-sm ${importResult.success ? 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300'}`}>
                  <p className="font-medium">{importResult.message}</p>
                  {importResult.atualizados !== undefined && (
                    <p className="mt-1">Produtos atualizados: {importResult.atualizados}</p>
                  )}
                  {importResult.erros && importResult.erros.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto text-xs">
                      <p className="font-medium mb-1">Erros:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {importResult.erros.map((erro, i) => (
                          <li key={i}>{erro}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => { setShowImportModal(false); setImportResult(null); }}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Fechar
                </button>
                <button
                  onClick={handleImportPrecos}
                  disabled={importando || !importFile}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {importando && (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  )}
                  {importando ? 'Importando...' : 'Importar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
