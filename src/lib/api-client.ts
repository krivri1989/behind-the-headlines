export async function apiFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new Error((body as { error?: string }).error || `Request failed: ${response.status}`);
  return body as T;
}

export async function apiUpload(path: string, formData: FormData): Promise<unknown> {
  const response = await fetch(path, { method: "POST", body: formData });
  const body = await response.json();
  if (!response.ok) throw new Error((body as { error?: string }).error || `Upload failed: ${response.status}`);
  return body;
}
