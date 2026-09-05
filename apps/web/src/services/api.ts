import axios from 'axios';

/**
 * Base da API, tolerante ao que vier na variavel de ambiente.
 *
 * A API vive toda sob o prefixo `/api` (global prefix do Nest). Preencher
 * `VITE_API_URL` sem esse sufixo -- que e o erro natural, ja que o campo pede
 * "a URL da API" -- fazia todas as chamadas cairem um nivel acima e o app
 * inteiro morrer com "Cannot POST /auth/register", sem nenhuma pista do
 * motivo. Normalizar aqui custa tres linhas e elimina a classe de erro.
 *
 * Aceita: https://host/api, https://host/, https://host, /api
 */
function resolveBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_URL ?? 'http://localhost:3333/api').trim();
  const withoutTrailingSlash = raw.replace(/\/+$/, '');
  return withoutTrailingSlash.endsWith('/api')
    ? withoutTrailingSlash
    : `${withoutTrailingSlash}/api`;
}

export const api = axios.create({
  baseURL: resolveBaseUrl(),
});

const TOKEN_KEY = '4l.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Token expirado ou invalido: derruba a sessao e volta para o login.
    if (error.response?.status === 401 && getToken()) {
      setToken(null);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

/** Extrai a mensagem util de um erro do backend. */
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (Array.isArray(data?.message)) return data.message.join(' ');
    if (data?.message) return data.message;
    return error.message;
  }
  return 'Erro inesperado.';
}
