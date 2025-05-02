export const API_URL = process.env.REACT_APP_BACKEND_URL || '';
export const SIMPLIFIER_URL = process.env.REACT_APP_SIMPLIFIER_SERVICE_URL || '';

export const getApiUrl = (endpoint) => {
    if (endpoint.startsWith('http') || !API_URL) {
        return endpoint;
    }
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${API_URL}${path}`;
}; 