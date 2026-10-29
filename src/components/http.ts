/** fetch wrapper that always returns JSON or throws a friendly Error. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    throw new Error("Network error – check your internet connection and try again.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error ?? `Request failed (${res.status}).`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}
