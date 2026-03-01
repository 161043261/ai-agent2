import { useEffect, useRef, type KeyboardEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Send, User } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import AiAvatar from "@/components/ai-avatar";
import { cn } from "@/utils";
import type { ConnectionStatus } from "@/hooks/use-sse";

export interface Message {
  content: string;
  isUser: boolean;
  type?: string;
  time: number;
}

interface Props {
  messages: Message[];
  connectionStatus: ConnectionStatus;
  aiType?: "code" | "manus" | "default";
  onSendMessage: (message: string) => void;
}

const chatSchema = z.object({
  message: z.string().trim().min(1, "请输入消息"),
});

type ChatFormValues = z.infer<typeof chatSchema>;

function ChatRoom({
  messages,
  connectionStatus,
  aiType = "default",
  onSendMessage,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { register, handleSubmit, reset, control } = useForm<ChatFormValues>({
    resolver: zodResolver(chatSchema),
    defaultValues: { message: "" },
  });

  const messageValue = useWatch({ control, name: "message" });
  const { ref: formRef, ...registerRest } = register("message");

  const virtualizer = useVirtualizer({
    count: messages.length,
    overscan: 5,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 80,
  });

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    }
  }, [messages.length, virtualizer]);

  // During streaming, the last message content grows continuously.
  // measureElement's built-in ResizeObserver handles height re-measurement,
  // but we need to keep scroll pinned to bottom as content grows.
  const lastMessageContent = messages[messages.length - 1]?.content;
  useEffect(() => {
    if (messages.length === 0) return;
    // Use requestAnimationFrame to wait for DOM update after content change
    const raf = requestAnimationFrame(() => {
      virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
    });
    return () => cancelAnimationFrame(raf);
  }, [lastMessageContent, messages.length, virtualizer]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const onSubmit = (data: ChatFormValues) => {
    if (connectionStatus === "connecting") return;
    onSendMessage(data.message);
    reset();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(onSubmit)();
    }
  };

  const getBubbleClass = (type?: string) => {
    switch (type) {
      case "ai-thinking":
        return "bg-amber-50 border-l-4 border-amber-400 italic";
      case "ai-tool-call":
        return "bg-gray-100 border-l-4 border-gray-400 text-sm";
      case "ai-tool-result":
        return "bg-sky-50 border-l-4 border-sky-400 text-sm max-h-36 overflow-y-auto";
      case "ai-final":
        return "bg-emerald-50 border-l-4 border-emerald-400";
      case "ai-error":
        return "bg-red-50 border-l-4 border-red-400";
      default:
        return "bg-gray-100";
    }
  };

  const isConnecting = connectionStatus === "connecting";

  return (
    <div className="flex h-[70vh] min-h-125 flex-col overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-sm">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const msg = messages[virtualItem.index];
            return (
              <div
                key={virtualItem.index}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                className="absolute top-0 left-0 w-full"
                style={{
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div
                  className={cn(
                    "flex items-start gap-3 pb-4",
                    msg.isUser ? "flex-row-reverse" : "flex-row",
                  )}
                >
                  {msg.isUser ? (
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-emerald-500 text-white">
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <AiAvatar type={aiType} />
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-3",
                      msg.isUser
                        ? "rounded-br-md bg-emerald-500 text-white"
                        : cn("rounded-bl-md", getBubbleClass(msg.type)),
                    )}
                  >
                    {msg.isUser ? (
                      <p className="text-sm leading-relaxed wrap-break-word whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    ) : (
                      <div className="prose prose-sm prose-neutral max-w-none wrap-break-word [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <Markdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </Markdown>
                        {isConnecting &&
                          virtualItem.index === messages.length - 1 && (
                            <span className="ml-1 inline-block animate-pulse">
                              ...
                            </span>
                          )}
                      </div>
                    )}
                    <p
                      className={cn(
                        "mt-1.5 text-xs",
                        msg.isUser ? "text-emerald-100" : "text-gray-400",
                      )}
                    >
                      {formatTime(msg.time)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="border-t border-emerald-50 bg-gray-50/50 p-4"
      >
        <div className="flex items-end gap-3">
          <textarea
            ref={(e) => {
              formRef(e);
              textareaRef.current = e;
            }}
            {...registerRest}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            disabled={isConnecting}
            className={cn(
              "flex-1 resize-none rounded-xl border border-emerald-200 px-4 py-3",
              "text-sm placeholder:text-gray-400",
              "focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "max-h-30 min-h-11",
            )}
            rows={1}
          />
          <Button
            type="submit"
            disabled={isConnecting || !messageValue?.trim()}
            className="h-10 w-10 rounded-xl bg-emerald-500 px-5 text-white shadow-sm hover:bg-emerald-600"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

export default ChatRoom;
