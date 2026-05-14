import axios from 'axios';

const normalizedBase =
  process.env.REACT_APP_API_URL ||
  'http://localhost:5000';

const ensureLeadingSlash = path =>
  path.startsWith('/') ? path : `/${path}`;

export const buildApiUrl = path =>
  `${normalizedBase}${ensureLeadingSlash(path)}`;

export const apiFetch = (path, options = {}) => {
  const url = buildApiUrl(path);
  return fetch(url, options);
};

export const apiAxios = axios.create({
  baseURL: normalizedBase,
  withCredentials: true,
});

// Add auth token
apiAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('clockdin_token');

    if (token) {
      config.headers['x-auth-token'] = token;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Handle errors
apiAxios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('Unauthorized (401)');
    }

    return Promise.reject(error);
  }
);