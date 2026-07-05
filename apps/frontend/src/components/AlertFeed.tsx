"use client";

import { ShieldAlert, AlertTriangle, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { Alert } from "@/types";
import { getSeverityStyle } from "@/utils/severityStyles";

interface AlertFeedProps {
  alerts: Alert[];
  onSelectAlert: (alert: Alert) => void;
}

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
          return (
            <div 
              key={alert.id}
              onClick={() => onSelectAlert(alert)}
              className={`p-5 cursor-pointer hover:opacity-90 transition flex flex-col gap-3 relative overflow-hidden rounded-lg ${style.bg}`}
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
                  <AlertTriangle className="w-4 h-4 text-clay" />
                  {alert.title}
                </h3>
                <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed truncate">
                  {alert.description}
                </p>
              </div>
            </div>
          );
        })
      )}
    </motion.div>
  );
}
