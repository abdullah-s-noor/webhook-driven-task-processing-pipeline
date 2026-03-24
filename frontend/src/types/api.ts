export interface ApiError {
  error?: string;
  message?: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResponse {
  token?: string;
  user?: AuthUser;
  message?: string;
  error?: string;
}
