import { useNavigate } from "react-router-dom";
import { Code, Bot, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AppFooter from "@/components/app-footer";

export function Home() {
  const navigate = useNavigate();

  const apps = [
    {
      id: "code-app",
      title: "AI 编程大师",
      description: "权威的编程专家",
      icon: Code,
      path: "/code-app",
      gradient: "from-emerald-400 to-teal-500",
      hoverGradient: "group-hover:from-emerald-500 group-hover:to-teal-600",
    },
    {
      id: "manus-agent",
      title: "Manus 智能体",
      description: "AI 中的全能选手",
      icon: Bot,
      path: "/manus-agent",
      gradient: "from-blue-400 to-indigo-500",
      hoverGradient: "group-hover:from-blue-500 group-hover:to-indigo-600",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-linear-to-b from-emerald-50/50 to-white">
      {/* 背景装饰 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-teal-200/30 blur-3xl" />
      </div>

      {/* 主内容 */}
      <main className="relative z-10 flex-1">
        {/* Header */}
        <header className="px-4 pt-16 pb-12 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-100/80 px-4 py-2 text-sm font-medium text-emerald-700">
            <Sparkles className="h-4 w-4" />
            <span>AI Agent</span>
          </div>
          <h1 className="mb-4 text-4xl font-bold text-gray-800 md:text-5xl">
            有什么可以帮忙的?
          </h1>
          <p className="mx-auto max-w-md text-lg text-gray-500">
            准备好了, 随时开始
          </p>
          <div className="mx-auto mt-6 h-1 w-24 rounded-full bg-linear-to-r from-emerald-400 to-teal-400" />
        </header>

        {/* 应用卡片 */}
        <section className="mx-auto max-w-4xl px-4 pb-20">
          <div className="grid gap-6 md:grid-cols-2">
            {apps.map((app) => {
              const Icon = app.icon;
              return (
                <Card
                  key={app.id}
                  className="group cursor-pointer overflow-hidden border-0 shadow-lg shadow-emerald-100/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-200/50"
                  onClick={() => navigate(app.path)}
                >
                  <CardContent className="p-0">
                    <div className="p-6">
                      {/* 图标 */}
                      <div
                        className={`h-16 w-16 rounded-2xl bg-linear-to-br ${app.gradient} ${app.hoverGradient} mb-5 flex items-center justify-center shadow-lg transition-all duration-300`}
                      >
                        <Icon className="h-8 w-8 text-white" />
                      </div>

                      {/* 标题和描述 */}
                      <h2 className="mb-2 text-xl font-semibold text-gray-800 transition-colors group-hover:text-emerald-600">
                        {app.title}
                      </h2>
                      <p className="mb-6 text-sm leading-relaxed text-gray-500">
                        {app.description}
                      </p>

                      {/* 按钮 */}
                      <Button
                        variant="ghost"
                        className="group/btn px-0 text-emerald-600 hover:bg-transparent hover:text-emerald-700"
                      >
                        <span>立即体验</span>
                        <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                      </Button>
                    </div>

                    {/* 底部装饰线 */}
                    <div
                      className={`h-1 w-full bg-linear-to-r ${app.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <AppFooter />
    </div>
  );
}
