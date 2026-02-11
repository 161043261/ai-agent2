export const API_BASE_URL = import.meta.env.PROD
  ? "/api"
  : "http://localhost:8123/api";

/**
 * @deprecated
 */
export const connectSse = (
  url: string,
  params: Record<string, string>,
  onMessage?: (data: string) => void,
  onError?: (error: Event) => void,
): EventSource => {
  const queryString = Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
  const fullUrl = `${API_BASE_URL}${url}?${queryString}`;
  const eventSource = new EventSource(fullUrl);
  eventSource.onmessage = (event) => {
    const data = event.data;
    if (data === "[DONE]") {
      onMessage?.("[DONE]");
    } else {
      onMessage?.(data);
    }
  };
  eventSource.onerror = (error) => {
    onError?.(error);
    eventSource.close();
  };
  return eventSource;
};

/**
 * @deprecated Use @/hooks/use-code-app-chat
 */
export const chatWithCodeApp = (
  message: string,
  chatId: string,
): EventSource => {
  return connectSse("/ai/code-app/chat/sse", { message, chatId });
};

/**
 * @deprecated Use @/hooks/use-manus-agent-chat
 */
export const chatWithManus = (message: string): EventSource => {
  return connectSse("/ai/manus/chat", { message });
};

export default {
  chatWithCodeApp,
  chatWithManus,
};
