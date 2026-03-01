import { useMutation } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/api";
import type { Message } from "@/components/chat-room";
import type { ConnectionStatus } from "@/hooks/use-sse";

interface StructuredMessage {
  type: string;
  content?: string;
  tool?: string;
  result?: string;
}

export function useManusAgentChat() {
  const chatId = useMemo(() => crypto.randomUUID(), []);
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      content: "你好, 我是 Manus 智能体!",
      isUser: false,
      time: Date.now(),
    },
  ]);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const eventSourceRef = useRef<EventSource | null>(null);

  const addMessage = useCallback(
    (content: string, isUser: boolean, type = "") => {
      setMessages((prev) => [
        ...prev,
        { content, isUser, type, time: Date.now() },
      ]);
    },
    [],
  );

  const handleStructuredMessage = useCallback(
    (msg: StructuredMessage) => {
      switch (msg.type) {
        case "thinking":
          if (msg.content?.trim()) {
            addMessage(`Thinking: ${msg.content}`, false, "ai-thinking");
          }
          break;
        case "tool_call":
          addMessage(`Tool call: ${msg.tool}`, false, "ai-tool-call");
          break;
        case "tool_result": {
          const result =
            msg.result && msg.result.length > 200
              ? msg.result.substring(0, 200) + "..."
              : msg.result;
          addMessage(
            `Tool result: ${msg.tool} 结果: ${result}`,
            false,
            "ai-tool-result",
          );
          break;
        }
        case "finished":
          addMessage(`Finished: ${msg.content}`, false, "ai-final");
          break;
        case "error":
          addMessage(`Error: ${msg.content}`, false, "ai-error");
          break;
        default:
          if (msg.content) {
            addMessage(msg.content, false);
          }
      }
    },
    [addMessage],
  );

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
          `${API_BASE_URL}/ai/manus/chat?${params}`,
        );
        eventSourceRef.current = eventSource;

        // 消息缓冲
        let messageBuffer: string[] = [];
        const endPunctuation = [",", ".", ";", "!", "?", "…"];

        const createBubble = (content: string, type = "ai-answer") => {
          if (content.trim()) {
            addMessage(content, false, type);
          }
          messageBuffer = [];
        };

        eventSource.onmessage = (event) => {
          const data = event.data;

          if (data && data !== "[DONE]") {
            try {
              const parsed = JSON.parse(data) as StructuredMessage;
              handleStructuredMessage(parsed);
            } catch {
              messageBuffer.push(data);
              const combinedText = messageBuffer.join("");
              const lastChar = data.charAt(data.length - 1);
              const hasCompleteSentence =
                endPunctuation.includes(lastChar) || data.includes("\n\n");
              const isLongEnough = combinedText.length > 40;

              if (hasCompleteSentence || isLongEnough) {
                createBubble(combinedText);
              }
            }
          }

          if (data === "[DONE]") {
            if (messageBuffer.length > 0) {
              createBubble(messageBuffer.join(""), "ai-final");
            }
            setConnectionStatus("disconnected");
            eventSource.close();
            resolve();
          }
        };

        eventSource.onerror = () => {
          if (messageBuffer.length > 0) {
            createBubble(messageBuffer.join(""), "ai-error");
          }
          setConnectionStatus("error");
          eventSource.close();
          reject(new Error("SSE connection error"));
        };
      });
    },
    onMutate: (message: string) => {
      addMessage(message, true, "user-question");
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
    connectionStatus,
    sendMessage,
    disconnect,
    isPending: mutation.isPending,
  };
}
