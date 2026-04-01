const API_BASE = "http://localhost:8000/api";

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserOut {
  id: string;
  full_name: string;
  email: string;
  role: string;
  bio: string | null;
  profile_image: string | null;
}

export interface UpdateProfileData {
  full_name?: string;
  email?: string;
  bio?: string;
  current_password?: string;
  new_password?: string;
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }

  return res.json();
}

export function registerUser(data: {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}) {
  return request<TokenResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function loginUser(data: { email: string; password: string }) {
  return request<TokenResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getMe(token: string) {
  return request<UserOut>("/auth/me", {
    headers: { Authorization: `Bearer ${token}` } as Record<string, string>,
  });
}

export function updateProfile(token: string, data: UpdateProfileData) {
  return request<UserOut>("/auth/profile", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` } as Record<string, string>,
    body: JSON.stringify(data),
  });
}
