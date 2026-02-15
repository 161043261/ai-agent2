import { Github, Heart } from "lucide-react";

function AppFooter() {
  return (
    <footer className="w-full border-t border-emerald-100 bg-white/80 px-4 py-6 backdrop-blur-sm">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3">
        <div className="flex items-center gap-2 text-emerald-600">
          <span className="text-sm">Made with</span>
          <Heart className="h-4 w-4 fill-emerald-500 text-emerald-500" />
          <span className="text-sm">by Tiancheng Hang</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/161043261/ai-agent"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-emerald-600"
          >
            <Github className="h-4 w-4" />
            <span>GitHub</span>
          </a>
        </div>
        <p className="text-xs text-gray-400">
          © {new Date().getFullYear()} Tiancheng Hang. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default AppFooter;
