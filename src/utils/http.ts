export async function fetchJson<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `HTTP ${res.status} ${res.statusText} — ${url}\n${body}`.trim(),
    );
  }

  return res.json() as Promise<T>;
}

export async function fetchJsonPost<T>(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  return fetchJson<T>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

export async function downloadToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed: HTTP ${res.status} — ${url}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
