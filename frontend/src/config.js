// Environment-aware configuration
// REACT_APP_API_URL can be set at build time for production deployments
const API_URL = process.env.REACT_APP_API_URL
  || (process.env.NODE_ENV === 'production'
    ? 'https://sipsync-backend-vo57.onrender.com/api'
    : 'http://localhost:5000/api');

export { API_URL };
