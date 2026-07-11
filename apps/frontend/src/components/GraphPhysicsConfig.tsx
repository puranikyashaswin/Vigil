"use client";

import React from "react";
import { Settings, X, RotateCcw } from "lucide-react";

interface GraphPhysicsConfigProps {
  chargeStrength: number;
  setChargeStrength: (v: number) => void;
  linkDistance: number;
  setLinkDistance: (v: number) => void;
  collisionRadius: number;
  setCollisionRadius: (v: number) => void;
  onClose: () => void;
}

export default function GraphPhysicsConfig({
  chargeStrength,
  setChargeStrength,
  linkDistance,
  setLinkDistance,
  collisionRadius,
  setCollisionRadius,
  onClose
}: GraphPhysicsConfigProps) {
  const handleReset = () => {
    setChargeStrength(-240);
    setLinkDistance(95);
    setCollisionRadius(36);
  };

  return (
    <div className="absolute top-16 left-4 z-10 w-64 p-4 rounded-xl bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 shadow-xl space-y-4 font-sans select-none">
      <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-900 pb-2">
        <span className="font-semibold text-xs text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
          <Settings className="w-3.5 h-3.5 text-zinc-500" /> Layout Physics
        </span>
        <div className="flex items-center gap-1">
          <button 
            onClick={handleReset}
            title="Reset defaults"
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <button 
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {/* Charge Strength Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            <span>Charge Strength</span>
            <span>{chargeStrength}</span>
          </div>
          <input 
            type="range" 
            min="-600" 
            max="0" 
            step="10" 
            value={chargeStrength}
            onChange={(e) => setChargeStrength(Number(e.target.value))}
            className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100"
          />
        </div>

        {/* Link Distance Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            <span>Link Distance</span>
            <span>{linkDistance}px</span>
          </div>
          <input 
            type="range" 
            min="30" 
            max="200" 
            step="5" 
            value={linkDistance}
            onChange={(e) => setLinkDistance(Number(e.target.value))}
            className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100"
          />
        </div>

        {/* Collision Radius Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            <span>Collision Radius</span>
            <span>{collisionRadius}px</span>
          </div>
          <input 
            type="range" 
            min="10" 
            max="80" 
            step="2" 
            value={collisionRadius}
            onChange={(e) => setCollisionRadius(Number(e.target.value))}
            className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100"
          />
        </div>
      </div>
    </div>
  );
}
