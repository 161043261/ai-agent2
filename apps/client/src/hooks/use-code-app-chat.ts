import { useMutation } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { API_BASE_URL } from "@/api";
import type { Message } from "@/components/chat-room";
import type { ConnectionStatus } from "@/hooks/use-sse";

export function useCodeAppChat() {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      content: "你好, 我是 AI 编程大师",
      isUser: false,
      time: Date.now(),
    },
  ]);
  // 依赖项数组为 undefined, 副作用函数只在组件挂载时执行 1 次
  // crypto.randomUUID 需要 crypto 作为 this 上下文
  // 直接传递 crypto.randomUUID 时, 丢失 this
  const [chatId] = useState(crypto.randomUUID.bind(crypto));
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const eventSourceRef = useRef<EventSource | null>(null);

  const addMessage = useCallback((content: string, isUser: boolean) => {
    setMessages((prev) => [...prev, { content, isUser, time: Date.now() }]);
  }, []);

  const updateLastAiMessage = useCallback((content: string) => {
    setMessages((prev) => {
      const newMessages = [...prev];
      const lastIndex = newMessages.length - 1;
      if (lastIndex >= 0 && !newMessages[lastIndex].isUser) {
        newMessages[lastIndex] = {
          ...newMessages[lastIndex],
          content: newMessages[lastIndex].content + content,
        };
      }
      return newMessages;
    });
  }, []);

  const mutation = useMutation({
    mutationFn: (message: string) => {
      return new Promise<void>((resolve, reject) => {
        // 关闭之前的连接
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        setConnectionStatus("connecting");

        const params = new URLSearchParams({ message, chatId });
        const eventSource = new EventSource(
          `${API_BASE_URL}/ai/code-app/chat/sse?${params}`,
        );
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
          const data = event.data;
          if (data && data !== "[DONE]") {
            updateLastAiMessage(data);
          }
          if (data === "[DONE]") {
            setConnectionStatus("disconnected");
            eventSource.close();
            resolve();
          }
        };

        eventSource.onerror = () => {
          setConnectionStatus("error");
          eventSource.close();
          reject(new Error("SSE connection error"));
        };
      });
    },
    onMutate: (message: string) => {
      addMessage(message, true);
      addMessage("", false);
    },
  });

  const sendMessage = useCallback(
    (message: string) => {
      mutation.mutate(message);
    },
    [mutation],
  );

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  return {
    messages,
    chatId,
    connectionStatus,
    sendMessage,
    disconnect,
    isPending: mutation.isPending,
  };
}
