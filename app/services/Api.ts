import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { toast } from "react-toastify";
import Cookies from "js-cookie";

const LOGOUT_KEY = "sigac:isLoggingOut";

const isLoggingOut = () =>
  typeof window !== "undefined" && window.sessionStorage.getItem(LOGOUT_KEY) === "true";

export class Api {
  private axiosInstance: AxiosInstance;

  constructor(baseURL: string) {
    this.axiosInstance = axios.create({
      baseURL,
      headers: {
        "ngrok-skip-browser-warning": "69420", // tirar quando estiver em producao
      },
    });

    // Interceptador de requisição
    this.axiosInstance.interceptors.request.use(
      (config) => {

        // Exemplo: adicionar token de autenticação se existir
        const token = Cookies.get("token"); // nome do cookie
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Interceptador de resposta
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error.response?.status;

        // Tratar erro 401 (não autorizado)
        if (status === 401) {
          const hasToken = Boolean(Cookies.get("token"));
          if (!isLoggingOut() && hasToken) {
            toast.error("Não autorizado, redirecionando para login...");
          }
        }
        // Tratar erro 403 (sem permissão)
        else if (status === 403) {
          // toast.error("Você não tem permissão para executar esta ação.");
        }
        // Tratar erro 400 (validação) - não mostrar toast automático
        else if (status === 400) {
          // Erros de validação são tratados individualmente pelos componentes
          // Não fazer log automático aqui para evitar spam no console
        }
        // Outros erros
        else {
          console.error('Erro na API:', error.response?.data || error.message);
        }

        return Promise.reject(error);
      }
    );
  }

  // Método para obter token dos cookies
  private getTokenFromCookie(): string | null {
    const tokenKey = "token";
    const match = document.cookie.match(new RegExp("(^| )" + tokenKey + "=([^;]+)"));
    return match ? match[2] : null;
  }

  // Métodos genéricos
  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.get<T>(url, config);
  }

  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.post<T>(url, data, config);
  }

  public async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.put<T>(url, data, config);
  }

  public async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.patch<T>(url, data, config);
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.delete<T>(url, config);
  }
}

// Instância global para usar em qualquer lugar
export const api = new Api(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");
