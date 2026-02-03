// Environment-aware configuration
const API_URL = process.env.NODE_ENV === 'production'
  ? 'https://sipsync-b400e.firebaseapp.com/api'
  : 'http://localhost:5000/api';

export { API_URL };
