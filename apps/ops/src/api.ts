export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: object } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? (options.body ? "POST" : "GET"),
      credentials: "same-origin",
      signal: AbortSignal.timeout(20000),
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("We couldn’t reach the server. Check your connection and try again.");
  }
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    const isClientError = response.status >= 400 && response.status < 500;
    const safeMessage = isClientError && data.message 
      ? data.message 
      : "An unexpected error occurred. Please try again later.";
      
    throw Object.assign(
      new Error(safeMessage),
      { status: response.status },
    );
  }
  return data as T;
}
