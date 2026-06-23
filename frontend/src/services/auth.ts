import { api, clearAuthTokens, setAuthTokens } from "@/lib/api";
import type {
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  MessageResponse,
  RegisterRequest,
  ResetPasswordRequest,
  User,
} from "@/types/auth";

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/api/v1/auth/login", payload);
  setAuthTokens(data.tokens.access_token, data.tokens.refresh_token);
  return data;
}

export async function register(payload: RegisterRequest): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/api/v1/auth/register", payload);
  setAuthTokens(data.tokens.access_token, data.tokens.refresh_token);
  return data;
}

export async function forgotPassword(
  email: string
): Promise<ForgotPasswordResponse> {
  const { data } = await api.post<ForgotPasswordResponse>(
    "/api/v1/auth/forgot-password",
    { email }
  );
  return data;
}

export async function resetPassword(
  payload: ResetPasswordRequest
): Promise<MessageResponse> {
  const { data } = await api.post<MessageResponse>(
    "/api/v1/auth/reset-password",
    payload
  );
  return data;
}

export async function getCurrentUser(): Promise<User> {
  const { data } = await api.get<User>("/api/v1/users/me");
  return data;
}

export function logout() {
  clearAuthTokens();
}
