import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Function to attach interceptor
const attachAuthInterceptor = (auth) => {
  
  axiosInstance.interceptors.request.use(
    (config) => {
      if (auth.isAuthenticated) {
        config.headers['Authorization'] = `Bearer ${auth.token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );
};

export { axiosInstance, attachAuthInterceptor };