import Cookies from "js-cookie";
import { api } from "@/app/services/Api";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
}

const TOKEN_COOKIE = "token";
const REFRESH_COOKIE = "refresh_token";

class AuthService {
  /**
   * POST acess/login/
   * body: { email, password }
   * retorno: { access, refresh }
   */
  async login(payload: LoginPayload): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>("acess/login/", payload);
    this.saveTokens(data);
    return data;
  }

  saveTokens(data: LoginResponse) {
    // "token" é o nome de cookie que o Api.ts já lê para montar o header Authorization
    Cookies.set(TOKEN_COOKIE, data.access, { expires: 1, sameSite: "strict" });
    Cookies.set(REFRESH_COOKIE, data.refresh, { expires: 7, sameSite: "strict" });
  }

  logout() {
    Cookies.remove(TOKEN_COOKIE);
    Cookies.remove(REFRESH_COOKIE);
  }

  getAccessToken(): string | undefined {
    return Cookies.get(TOKEN_COOKIE);
  }

  getRefreshToken(): string | undefined {
    return Cookies.get(REFRESH_COOKIE);
  }

  isAuthenticated(): boolean {
    return Boolean(this.getAccessToken());
  }
}

export const authService = new AuthService();