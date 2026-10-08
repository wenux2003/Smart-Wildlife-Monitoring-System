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

export async function downloadApiFile(
  path: string,
  body: object,
): Promise<{ blob: Blob; filename: string; sha256: string | null }> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "We couldn’t reach the server. Check your connection and try again.",
    );
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw Object.assign(
      new Error(
        response.status >= 400 && response.status < 500 && data.message
          ? data.message
          : "An unexpected error occurred. Please try again later.",
      ),
      { status: response.status },
    );
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename =
    /filename="([^"]+)"/i.exec(disposition)?.[1] ?? "report-download";
  return {
    blob: await response.blob(),
    filename,
    sha256: response.headers.get("X-Report-Sha256"),
  };
}
