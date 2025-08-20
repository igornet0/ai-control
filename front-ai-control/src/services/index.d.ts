// Type declarations for service modules

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  message?: string;
}

export interface AuthService {
  login: (credentials: any) => Promise<ApiResponse>;
  logout: () => Promise<void>;
  getCurrentUser: () => Promise<ApiResponse>;
}

export interface AgentService {
  getAgents: () => Promise<ApiResponse>;
  createAgent: (agent: any) => Promise<ApiResponse>;
  updateAgent: (id: string, agent: any) => Promise<ApiResponse>;
  deleteAgent: (id: string) => Promise<ApiResponse>;
}

export interface CodeExecutionService {
  executeCode: (code: string) => Promise<ApiResponse>;
  validateCode: (code: string) => Promise<ApiResponse>;
}

export interface StrategyService {
  getStrategies: () => Promise<ApiResponse>;
  createStrategy: (strategy: any) => Promise<ApiResponse>;
  updateStrategy: (id: string, strategy: any) => Promise<ApiResponse>;
  deleteStrategy: (id: string) => Promise<ApiResponse>;
}

export interface ApiClient {
  get: (url: string) => Promise<ApiResponse>;
  post: (url: string, data: any) => Promise<ApiResponse>;
  put: (url: string, data: any) => Promise<ApiResponse>;
  delete: (url: string) => Promise<ApiResponse>;
}

declare const authService: AuthService;
declare const agentService: AgentService;
declare const codeExecutionService: CodeExecutionService;
declare const strategyService: StrategyService;
declare const api: ApiClient;

export { authService, agentService, codeExecutionService, strategyService, api };
