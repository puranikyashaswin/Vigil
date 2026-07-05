"use client";

import { ShieldAlert, AlertTriangle, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { Alert } from "@/types";
import { getSeverityStyle } from "@/utils/severityStyles";

interface AlertFeedProps {
  alerts: Alert[];
  onSelectAlert: (alert: Alert) => void;
}

const getMobileHighContrastStyle = (severity: string) => {
  switch (severity) {
    case "critical":
      return {
        card: "bg-red-600 dark:bg-red-700 text-white border-2 border-red-950 dark:border-red-900 p-6 rounded-xl shadow-lg",
        badge: "bg-white text-red-700 dark:bg-zinc-100 dark:text-red-800 text-xs font-extrabold px-3 py-1 rounded shadow-sm uppercase tracking-wider",
        text: "text-red-100 dark:text-red-100 font-medium text-base",
        titleText: "text-white text-xl font-bold tracking-tight flex items-center gap-2",
        icon: "text-white w-5 h-5",
        time: "text-red-200 dark:text-red-200"
      };
    case "high":
      return {
        card: "bg-orange-500 dark:bg-orange-600 text-white border-2 border-orange-950 dark:border-orange-900 p-6 rounded-xl shadow-lg",
        badge: "bg-white text-orange-700 dark:bg-zinc-100 dark:text-orange-850 text-xs font-extrabold px-3 py-1 rounded shadow-sm uppercase tracking-wider",
        text: "text-orange-100 dark:text-orange-100 font-medium text-base",
        titleText: "text-white text-xl font-bold tracking-tight flex items-center gap-2",
        icon: "text-white w-5 h-5",
        time: "text-orange-200 dark:text-orange-200"
      };
    case "medium":
      return {
        card: "bg-amber-400 dark:bg-amber-500 text-zinc-950 dark:text-zinc-50 border-2 border-amber-950 dark:border-amber-900 p-6 rounded-xl shadow-lg",
        badge: "bg-zinc-950 text-amber-400 dark:bg-zinc-900 dark:text-amber-300 text-xs font-extrabold px-3 py-1 rounded shadow-sm uppercase tracking-wider",
        text: "text-zinc-900 dark:text-zinc-100 font-medium text-base",
        titleText: "text-zinc-950 dark:text-zinc-50 text-xl font-bold tracking-tight flex items-center gap-2",
        icon: "text-zinc-950 dark:text-zinc-50 w-5 h-5",
        time: "text-zinc-800 dark:text-zinc-300"
      };
    default:
      return {
        card: "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-2 border-zinc-300 dark:border-zinc-700 p-6 rounded-xl shadow-md",
        badge: "bg-zinc-500 text-white text-xs font-extrabold px-3 py-1 rounded uppercase tracking-wider",
        text: "text-zinc-600 dark:text-zinc-400 font-medium text-base",
        titleText: "text-zinc-900 dark:text-zinc-100 text-xl font-bold tracking-tight flex items-center gap-2",
        icon: "text-zinc-700 dark:text-zinc-300 w-5 h-5",
        time: "text-zinc-500 dark:text-zinc-400"
      };
  }
};

export default function AlertFeed({ alerts, onSelectAlert }: AlertFeedProps) {
  return (
    <motion.div
      key="alerts"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.15 }}
      className="space-y-4"
    >
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
            <ShieldAlert className="w-8 h-8 text-zinc-400 dark:text-zinc-500" />
          </div>
          <h3 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200 mb-2">No Active Alerts</h3>
          <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-xs">
            All compliance checks have passed. Contradictions will appear here when detected during ingestion.
          </p>
        </div>
      ) : (
        alerts.map((alert) => {
          const style = getSeverityStyle(alert.severity);
          const mobileStyle = getMobileHighContrastStyle(alert.severity);
          return (
            <div key={alert.id} className="contents">
              {/* Desktop card view */}
              <div 
                onClick={() => onSelectAlert(alert)}
                className={`p-5 cursor-pointer hover:opacity-90 transition flex-col gap-3 relative overflow-hidden rounded-lg ${style.bg} hidden md:flex`}
              >
                <div className="flex items-center justify-between">
                  <span className={style.badge}>
                    {alert.severity}
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                    {alert.title}
                  </h3>
                  <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed truncate">
                    {alert.description}
                  </p>
                </div>
              </div>

              {/* Mobile sunlight-readable high-contrast view */}
              <div 
                onClick={() => onSelectAlert(alert)}
                className={`cursor-pointer hover:opacity-95 active:scale-[0.99] transition-all flex flex-col gap-4 relative overflow-hidden md:hidden ${mobileStyle.card}`}
              >
                <div className="flex items-center justify-between">
                  <span className={mobileStyle.badge}>
                    {alert.severity}
                  </span>
                  <span className={`text-sm flex items-center gap-1 font-mono ${mobileStyle.time}`}>
                    <Clock className="w-4 h-4" />
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div>
                  <h3 className={`${mobileStyle.titleText} mb-2`}>
                    <AlertTriangle className={mobileStyle.icon} />
                    {alert.title}
                  </h3>
                  <p className={`${mobileStyle.text} leading-relaxed`}>
                    {alert.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })
      )}
    </motion.div>
  );
}
