const API_BASE = "http://localhost:8000/api";

export interface ProfVerificationOut {
  id: string;
  professor_id: string;
  professor_name: string | null;
  region_id: string;
  region_name: string | null;
  birth_date: string;
  first_name: string;
  father_name: string;
  grandfather_name: string;
  status: 'pending' | 'approved' | 'rejected';
  note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ProfVerificationCreate {
  region_id: string;
  birth_date: string;
  first_name: string;
  father_name: string;
  grandfather_name: string;
  note?: string;
}

async function request<T>(url: string, token: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export function submitVerification(token: string, data: ProfVerificationCreate) {
  return request<ProfVerificationOut>("/prof-verification", token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listVerifications(token: string) {
  return request<ProfVerificationOut[]>("/prof-verification", token);
}

export function reviewVerification(token: string, requestId: string, action: 'approve' | 'reject') {
  return request<ProfVerificationOut>(
    `/prof-verification/${requestId}/review?action=${action}`,
    token,
    { method: "POST" }
  );
}

export function cancelVerification(token: string, requestId: string) {
  return request<{ detail: string }>(`/prof-verification/${requestId}`, token, {
    method: "DELETE",
  });
}
