export interface UseAuthReturn {
  user: any;
  isAuthenticated: boolean;
  login: (credentials: any) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

declare const useAuth: () => UseAuthReturn;
export default useAuth;
