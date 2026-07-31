import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProduto, createProduto, updateProduto } from '../../api';
import ImageUpload from '../../components/ImageUpload';
import Loading from '../../components/Loading';
import { CATEGORIAS } from '../../constants/categorias';

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    preco: '',
    midias: [],
    categoria: '',
    linkCompra: '',
  });
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Carregar produto se for edição
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await getProduto(id);
        const p = data.data;
        setForm({
          nome: p.nome || '',
          descricao: p.descricao || '',
          preco: String(p.preco || ''),
          midias: p.midias || p.imagens || [],
          categoria: p.categoria || '',
          linkCompra: p.linkCompra || '',
        });
      } catch (err) {
        setError('Erro ao carregar produto');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const validate = () => {
    const errors = {};
    if (!form.nome.trim()) errors.nome = 'Nome é obrigatório';
    if (!form.preco || isNaN(parseFloat(form.preco)) || parseFloat(form.preco) <= 0) {
      errors.preco = 'Preço deve ser um número maior que zero';
    }
    if (!form.linkCompra.trim()) errors.linkCompra = 'Link de compra é obrigatório';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...form,
        preco: parseFloat(form.preco),
      };

      if (isEditing) {
        await updateProduto(id, payload);
      } else {
        await createProduto(payload);
      }

      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar produto');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading text="Carregando produto..." />;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {isEditing ? 'Editar Produto' : 'Novo Produto'}
        </h1>
        <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
          {isEditing
            ? 'Altere os campos desejados e salve'
            : 'Preencha os dados para cadastrar um novo produto'}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 dark:bg-gray-900 dark:border-gray-800"
      >
        {/* Error message */}
        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg border border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900">
            {error}
          </div>
        )}

        {/* Nome */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
            Nome do Produto <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <input
            type="text"
            name="nome"
            value={form.nome}
            onChange={handleChange}
            placeholder="Ex: Camiseta Premium"
            className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow text-sm dark:text-gray-100 ${
              fieldErrors.nome ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30' : 'border-gray-300 dark:border-gray-700 dark:bg-gray-900'
            }`}
          />
          {fieldErrors.nome && (
            <p className="text-red-500 text-xs mt-1 dark:text-red-400">{fieldErrors.nome}</p>
          )}
        </div>

        {/* Descrição */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
            Descrição
          </label>
          <textarea
            name="descricao"
            value={form.descricao}
            onChange={handleChange}
            rows={4}
            placeholder="Descrição detalhada do produto..."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow text-sm resize-vertical dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Categoria */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
            Categoria
          </label>
          <select
            name="categoria"
            value={form.categoria}
            onChange={handleChange}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow text-sm bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="">Sem categoria</option>
            {CATEGORIAS.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Preço */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
            Preço <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm dark:text-gray-500">
              R$
            </span>
            <input
              type="number"
              name="preco"
              value={form.preco}
              onChange={handleChange}
              step="0.01"
              min="0"
              placeholder="99,90"
              className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow text-sm dark:text-gray-100 ${
                fieldErrors.preco ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30' : 'border-gray-300 dark:border-gray-700 dark:bg-gray-900'
              }`}
            />
          </div>
          {fieldErrors.preco && (
            <p className="text-red-500 text-xs mt-1 dark:text-red-400">{fieldErrors.preco}</p>
          )}
        </div>

        {/* Link de compra */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
            Link de Compra <span className="text-red-500 dark:text-red-400">*</span>
          </label>
          <input
            type="url"
            name="linkCompra"
            value={form.linkCompra}
            onChange={handleChange}
            placeholder="https://wa.me/5511999999999"
            className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow text-sm dark:text-gray-100 ${
              fieldErrors.linkCompra
                ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                : 'border-gray-300 dark:border-gray-700 dark:bg-gray-900'
            }`}
          />
          {fieldErrors.linkCompra && (
            <p className="text-red-500 text-xs mt-1 dark:text-red-400">{fieldErrors.linkCompra}</p>
          )}
          <p className="text-gray-400 text-xs mt-1 dark:text-gray-500">
            Link para onde o cliente será redirecionado ao clicar em "Comprar"
            (WhatsApp, checkout, etc.)
          </p>
        </div>

        {/* Mídias */}
        <ImageUpload
          midias={form.midias}
          onChange={(midias) => setForm((prev) => ({ ...prev, midias }))}
        />

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
          >
            {saving && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {saving
              ? 'Salvando...'
              : isEditing
                ? 'Salvar Alterações'
                : 'Cadastrar Produto'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
