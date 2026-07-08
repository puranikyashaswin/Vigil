import React from "react";
import { LayoutGrid, MessageSquare, ShieldAlert } from "lucide-react";

interface MobileNavBarProps {
  mobileTab: "graph" | "alerts";
  setMobileTab: (tab: "graph" | "alerts") => void;
  onShowHistory: () => void;
  messagesCount: number;
  alertsCount: number;
}

export default function MobileNavBar({
  mobileTab,
  setMobileTab,
  onShowHistory,
  messagesCount,
  alertsCount
}: MobileNavBarProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 h-16 bg-brand-light dark:bg-brand-dark border-t border-brand-mid-gray/20 dark:border-brand-mid-gray/10 flex items-center justify-around px-4 shadow-lg shrink-0">
      <button
        onClick={() => setMobileTab("graph")}
        className={`flex flex-col items-center justify-center gap-1 w-20 h-full transition cursor-pointer ${
          mobileTab === "graph" ? "text-brand-orange font-bold" : "text-brand-mid-gray/60 dark:text-brand-mid-gray/40 hover:text-brand-mid-gray"
        }`}
      >
        <LayoutGrid className="w-5 h-5" />
        <span className="text-[10px] tracking-wide uppercase">Graph</span>
      </button>
      
      <button
        onClick={onShowHistory}
        className="flex flex-col items-center justify-center gap-1 w-20 h-full transition cursor-pointer text-brand-mid-gray/60 dark:text-brand-mid-gray/40 hover:text-brand-mid-gray"
      >
        <div className="relative">
          <MessageSquare className="w-5 h-5" />
          {messagesCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-brand-orange text-brand-light text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {messagesCount}
            </span>
          )}
        </div>
        <span className="text-[10px] tracking-wide uppercase">Chat</span>
      </button>

      <button
        onClick={() => setMobileTab("alerts")}
        className={`flex flex-col items-center justify-center gap-1 w-20 h-full transition cursor-pointer ${
          mobileTab === "alerts" ? "text-brand-orange font-bold" : "text-brand-mid-gray/60 dark:text-brand-mid-gray/40 hover:text-brand-mid-gray"
        }`}
      >
        <div className="relative">
          <ShieldAlert className="w-5 h-5" />
          {alertsCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-brand-light text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {alertsCount}
            </span>
          )}
        </div>
        <span className="text-[10px] tracking-wide uppercase">Alerts</span>
      </button>
    </nav>
  );
}
