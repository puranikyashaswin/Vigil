import { SeverityStyle } from "@/types";

export const getSeverityStyle = (severity: string): SeverityStyle => {
  switch (severity) {
    case "critical":
      return {
        bg: "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800",
        badge: "bg-red-600 text-white text-xs font-semibold px-2.5 py-0.5 rounded animate-pulse",
      };
    case "high":
      return {
        bg: "bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800",
        badge: "bg-orange-600 text-white text-xs font-semibold px-2.5 py-0.5 rounded",
      };
    case "medium":
      return {
        bg: "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800",
        badge: "bg-amber-500 text-black text-xs font-semibold px-2.5 py-0.5 rounded",
      };
    default:
      return {
        bg: "bg-[#e8e6dc]/30 dark:bg-zinc-900 border border-[#e8e6dc] dark:border-zinc-700",
        badge: "bg-[#b0aea5] text-[#faf9f5] text-xs font-semibold px-2.5 py-0.5 rounded",
      };
  }
};
