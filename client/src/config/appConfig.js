const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const AppConfig = {
  apiBase: API_BASE,
  apiBaseUri: `${API_BASE}/api`,
};

export default AppConfig;