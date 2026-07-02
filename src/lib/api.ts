// Thin HTTP client for the self-hosted API.
// Base URL is baked in at build time via VITE_API_URL.

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

const TOKEN_KEY = "lider_core_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

type Options = Omit<RequestInit, "body"> & { body?: unknown; auth?: boolean };

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const { body, auth = true, headers, ...rest } = opts;
  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string> | undefined),
  };
  if (auth) {
    const token = getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  if (!API_URL) {
    throw new ApiError(
      "VITE_API_URL não configurada. Suba o backend (docker compose up) e defina VITE_API_URL no build.",
      0,
      null,
    );
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const msg =
      (isJson && typeof data === "object" && data && "error" in data
        ? typeof (data as { error: unknown }).error === "string"
          ? (data as { error: string }).error
          : JSON.stringify((data as { error: unknown }).error)
        : typeof data === "string"
          ? data
          : "Request failed") || "Request failed";
    throw new ApiError(msg, res.status, data);
  }
  return data as T;
}

export type Me = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  roles: string[];
  memberships: Array<{
    role: string;
    organization: { id: string; name: string; slug: string; plan: string };
  }>;
};

export const authApi = {
  login: (email: string, password: string) =>
    api<{ token: string; user: { id: string; email: string; fullName: string | null } }>(
      "/auth/login",
      { method: "POST", body: { email, password }, auth: false },
    ),
  register: (email: string, password: string, fullName: string) =>
    api<{ token: string; user: { id: string; email: string; fullName: string } }>(
      "/auth/register",
      { method: "POST", body: { email, password, fullName }, auth: false },
    ),
  me: () => api<Me>("/auth/me", { method: "GET" }),
};