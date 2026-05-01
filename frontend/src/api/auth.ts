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
  is_verified: boolean;
  bio: string | null;
  speciality: string | null;
  profile_image: string | null;
  university_id: string | null;
  region_id: string | null;
  university_name: string | null;
  region_name: string | null;
}

export interface UpdateProfileData {
  full_name?: string;
  email?: string;
  bio?: string;
  speciality?: string;
  current_password?: string;
  new_password?: string;
  university_id?: string | null;  // "" or null to unlink
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
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
  role?: string;
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
