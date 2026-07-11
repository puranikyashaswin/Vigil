"use client";

import React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface TimelineEvent {
  year: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  color: string;
}

interface InspectorTimelineProps {
  timelineEvents: TimelineEvent[];
}

export default function InspectorTimeline({ timelineEvents }: InspectorTimelineProps) {
  return (
    <motion.div
      key="timeline-panel"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.12 }}
      className="relative pl-6 space-y-6 border-l border-zinc-200 dark:border-zinc-800 ml-3 py-2 font-sans"
    >
      {timelineEvents.map((evt, idx) => {
        const EvtIcon = evt.icon;
        return (
          <div key={idx} className="relative">
            {/* Circle Node Icon */}
            <div className="absolute -left-[35px] top-0.5 bg-zinc-50 dark:bg-zinc-950 p-0.5 rounded-full border border-zinc-200 dark:border-zinc-800">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${evt.color} bg-zinc-100 dark:bg-zinc-900`}>
                <EvtIcon className="w-3.5 h-3.5" />
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold tracking-wide text-zinc-400 font-mono">
                {evt.year}
              </span>
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 font-serif">
                {evt.title}
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-normal">
                {evt.desc}
              </p>
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}
