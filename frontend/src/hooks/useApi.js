import { useState, useCallback } from "react";
import { apiFetch } from "../api/apiFetch";

export function useApi() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (url, options = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch(url, options);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      return await res.json();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { request, isLoading, error };
}