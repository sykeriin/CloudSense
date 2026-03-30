/**
 * Centralized API configuration for backend communication.
 * 
 * In production (Vercel), set VITE_API_BASE_URL to your deployed backend URL.
 * In development, set VITE_API_BASE_URL=http://localhost:8000 in your .env file.
 * 
 * IMPORTANT: No hardcoded fallback to ensure production safety.
 */

export const API_BASE_URL = 
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') 
  || '';
