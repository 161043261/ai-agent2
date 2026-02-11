import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatRoom from "@/components/chat-room";
import AppFooter from "@/components/app-footer";
import { useCodeAppChat } from "@/hooks/use-code-app-chat";

export function CodeApp() {
  const navigate = useNavigate();
  const { messages, chatId, connectionStatus, sendMessage, disconnect } =
    useCodeAppChat();

  // 清理 SSE 连接
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return (
    <div className="flex min-h-screen flex-col bg-linear-to-b from-emerald-50/50 to-white">
      <header className="sticky top-0 z-20 border-b border-emerald-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="text-gray-600 hover:text-emerald-600"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回
          </Button>

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-emerald-400 to-teal-500">
              <Code className="h-4 w-4 text-white" />
            </div>
            <h1 className="font-semibold text-gray-800">AI 编程大师</h1>
          </div>

          <div className="hidden text-xs text-gray-400 sm:block">
            会话: {chatId}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <ChatRoom
          messages={messages}
          connectionStatus={connectionStatus}
          aiType="code"
          onSendMessage={sendMessage}
        />
      </main>

      <AppFooter />
    </div>
  );
}
