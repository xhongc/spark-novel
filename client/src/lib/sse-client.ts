export interface SSECallbacks {
  onChunk?: (text: string) => void;
  onDone?: (data: Record<string, unknown>) => void;
  onError?: (message: string) => void;
  onStart?: (data: Record<string, unknown>) => void;
}

export interface SSEOptions {
  signal?: AbortSignal;
}

export async function streamGenerate(
  url: string,
  body: unknown,
  callbacks: SSECallbacks,
  options?: SSEOptions,
): Promise<void> {
  const token = localStorage.getItem("accessToken");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    callbacks.onError?.(errData?.error?.message || "请求失败");
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;

    let eventType = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        const data = JSON.parse(line.slice(6));
        switch (eventType) {
          case "progress":
            callbacks.onStart?.(data);
            break;
          case "chunk":
            callbacks.onChunk?.(data.text);
            break;
          case "done":
            callbacks.onDone?.(data);
            break;
          case "error":
            callbacks.onError?.(data.message);
            break;
        }
      }
    }
  }
}
