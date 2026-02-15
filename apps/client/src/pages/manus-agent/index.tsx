import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatRoom from "@/components/chat-room";
import AppFooter from "@/components/app-footer";
import { useManusAgentChat } from "@/hooks/use-manus-agent-chat";

export function ManusAgent() {
  const navigate = useNavigate();
  const { messages, connectionStatus, sendMessage, disconnect } =
    useManusAgentChat();

  // 清理 SSE 连接
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return (
    <div className="flex min-h-screen flex-col bg-linear-to-b from-blue-50/50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-blue-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="text-gray-600 hover:text-blue-600"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回
          </Button>

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-blue-400 to-indigo-500">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <h1 className="font-semibold text-gray-800">Manus 智能体</h1>
          </div>

          <div className="w-16" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <ChatRoom
          messages={messages}
          connectionStatus={connectionStatus}
          aiType="manus"
          onSendMessage={sendMessage}
        />
      </main>

      <AppFooter />
    </div>
  );
}
