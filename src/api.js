import axios from 'axios';

// Railway Backend Configuration
const API_BASE_URL = 'https://roxlier-backend.up.railway.app';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const API_ENDPOINTS = {
  // Auth endpoints
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  PROFILE: '/api/auth/profile',
  UPDATE_PROFILE: '/api/auth/profile',
  UPDATE_PASSWORD: '/api/auth/password',
  
  // Store endpoints
  STORES: '/api/stores',
  STORE_DETAILS: (id) => `/api/stores/${id}`,
  STORE_RATINGS: (id) => `/api/stores/${id}/ratings`,
  
  // Rating endpoints
  RATINGS: '/api/ratings',
  USER_RATING: (storeId) => `/api/ratings/user/${storeId}`,
  
  // Admin endpoints
  ADMIN_DASHBOARD: '/api/admin/dashboard',
  ADMIN_USERS: '/api/admin/users',
  ADMIN_STORES: '/api/admin/stores',
  
  // User dashboard
  USER_DASHBOARD: '/api/users/dashboard',
};

export default api;
