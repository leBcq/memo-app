import type { Config } from "tailwindcss";

const config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  safelist: [
    "bg-blue-950/40",
    "bg-green-950/40",
    "bg-purple-950/40",
    "bg-amber-950/20",
    "text-xl",
    "text-base",
    "text-sm",
    "line-through",
    "text-zinc-600",
    "border-cyan-700",
    "text-cyan-400",
    "bg-cyan-950/30",
    "border-violet-700",
    "text-violet-400",
  ],
};

export default config as Config;
