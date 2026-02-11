import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, Code, Sparkles } from "lucide-react";
import { cn } from "@/utils";

interface Props {
  type?: "code" | "manus" | "default";
  className?: string;
}

function AiAvatar({ type = "default", className }: Props) {
  const getAvatarConfig = () => {
    switch (type) {
      case "code":
        return {
          icon: Code,
          bgClass: "bg-gradient-to-br from-emerald-400 to-teal-500",
        };
      case "manus":
        return {
          icon: Bot,
          bgClass: "bg-gradient-to-br from-blue-400 to-indigo-500",
        };
      default:
        return {
          icon: Sparkles,
          bgClass: "bg-gradient-to-br from-emerald-400 to-emerald-600",
        };
    }
  };

  const { icon: Icon, bgClass } = getAvatarConfig();

  return (
    <Avatar className={cn("h-9 w-9", className)}>
      <AvatarFallback className={cn(bgClass, "text-white")}>
        <Icon className="h-5 w-5" />
      </AvatarFallback>
    </Avatar>
  );
}

export default AiAvatar;
