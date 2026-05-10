import {tokenManager} from '../lib/TokenManager'

export async function apiFetch(url, options = {}, requireAuth = true) {
    if (requireAuth) {
      let token;
      try {
        token = await tokenManager.get_valid_token();
      } catch (error) {
        window.dispatchEvent(new Event("auth:logout"));
        throw new Error("Session Expired");
      }
      options.headers = {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      };
    }
  
    const response = await fetch(url, options);
  
    if (response.status === 401) {
      tokenManager.clear();
      window.dispatchEvent(new Event("auth:logout"));
      throw new Error("Unauthorized");
    }
  
    return response;
  }