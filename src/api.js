import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor para adicionar token de autenticação
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Produtos
export const getProdutos = () => api.get('/produtos').then((r) => r.data);
export const getProduto = (id) => api.get(`/produtos/${id}`).then((r) => r.data);
export const createProduto = (data) => api.post('/produtos', data).then((r) => r.data);
export const updateProduto = (id, data) => api.put(`/produtos/${id}`, data).then((r) => r.data);
export const deleteProduto = (id) => api.delete(`/produtos/${id}`).then((r) => r.data);

// Upload
export const uploadImagens = (files) => {
  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append('midias', file));
  return api
    .post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};

export const deleteImagem = (filename) =>
  api.delete(`/midia/${filename}`).then((r) => r.data);

// Auth
export const login = (username, password) =>
  api.post('/login', { username, password }).then((r) => r.data);

export default api;
