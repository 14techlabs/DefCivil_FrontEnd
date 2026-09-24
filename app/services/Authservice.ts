import Cookies from "js-cookie";
import { api } from "@/app/services/Api";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user_chat_id?: string | null;
}

const TOKEN_COOKIE = "token";
const REFRESH_COOKIE = "refresh_token";
const USER_CHAT_ID_KEY = "gardian:user_chat_id";

class AuthService {
  /**
   * POST acess/login/
   * body: { email, password }
   * retorno: { access, refresh, user_chat_id }
   */
  async login(payload: LoginPayload): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>("acess/login/", payload);
    this.saveTokens(data);
    return data;
  }

  saveTokens(data: LoginResponse) {
    // "token" é o nome de cookie que o Api.ts já lê para montar o header Authorization
    Cookies.set(TOKEN_COOKIE, data.access, { expires: 1, sameSite: "strict", path: "/" });
    Cookies.set(REFRESH_COOKIE, data.refresh, { expires: 7, sameSite: "strict", path: "/" });
    if (typeof window !== "undefined") {
      if (data.user_chat_id) {
        sessionStorage.setItem(USER_CHAT_ID_KEY, data.user_chat_id);
      } else {
        sessionStorage.removeItem(USER_CHAT_ID_KEY);
      }
    }
  }

  logout() {
    Cookies.remove(TOKEN_COOKIE, { path: "/" });
    Cookies.remove(REFRESH_COOKIE, { path: "/" });
    Cookies.remove(TOKEN_COOKIE);
    Cookies.remove(REFRESH_COOKIE);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(USER_CHAT_ID_KEY);
    }
  }

  getAccessToken(): string | undefined {
    return Cookies.get(TOKEN_COOKIE);
  }

  getRefreshToken(): string | undefined {
    return Cookies.get(REFRESH_COOKIE);
  }

  getUserChatId(): string | null {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(USER_CHAT_ID_KEY);
  }

  setUserChatId(id: string | null) {
    if (typeof window === "undefined") return;
    if (id) {
      sessionStorage.setItem(USER_CHAT_ID_KEY, id);
    } else {
      sessionStorage.removeItem(USER_CHAT_ID_KEY);
    }
  }

  isAuthenticated(): boolean {
    return Boolean(this.getAccessToken());
  }
}

export const authService = new AuthService();