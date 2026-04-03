const BASE = import.meta.env.VITE_SERVER_URL || "";
export const apiUrl = (path) => `${BASE}${path}`;