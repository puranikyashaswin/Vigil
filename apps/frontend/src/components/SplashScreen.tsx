"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CHARS = [" ", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
const TARGET_CHARS = ["V", "I", "G", "I", "L"];
const TOTAL_DURATION = 5000;

function useCardSize() {
  const [size, setSize] = useState({ w: 64, h: 80, fontSize: "3rem" });
  useEffect(() => {
    function update() {
      const sw = window.innerWidth;
      if (sw < 480) setSize({ w: 32, h: 42, fontSize: "1.5rem" });
      else if (sw < 768) setSize({ w: 44, h: 56, fontSize: "2rem" });
      else if (sw < 1024) setSize({ w: 56, h: 72, fontSize: "2.5rem" });
      else setSize({ w: 64, h: 80, fontSize: "3rem" });
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

function FlapCard({ target, cardSize }: { target: string; cardSize: { w: number; h: number; fontSize: string } }) {
  const [char, setChar] = useState(() => CHARS[Math.floor(Math.random() * CHARS.length)]);
  const [prevChar, setPrevChar] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    const startChar = char;
    let index = CHARS.indexOf(startChar);
    const tIndex = target === " " ? 0 : CHARS.indexOf(target);
    if (tIndex === -1) {
      setIsAnimating(false);
      return;
    }

    const steps = (tIndex - index + CHARS.length) % CHARS.length;
    if (steps === 0) {
      setIsAnimating(false);
      return;
    }

    let step = 0;
    const timer = setInterval(() => {
      step++;
      const nextIdx = (index + step) % CHARS.length;
      const nextChar = CHARS[nextIdx];
      setPrevChar(char);
      setChar(nextChar);

      if (step >= steps) {
        clearInterval(timer);
        setTimeout(() => {
          setIsAnimating(false);
          setPrevChar(null);
        }, 50);
      }
    }, 80);

    return () => clearInterval(timer);
  }, []);

  const display = char === " " ? "\u00A0" : char;
  const prevDisplay = prevChar === " " ? "\u00A0" : (prevChar || "\u00A0");
  const hw = cardSize.h / 2;

  return (
    <div
      className="relative flex flex-col items-center justify-center shrink-0"
      style={{
        width: cardSize.w,
        height: cardSize.h,
        perspective: "400px",
      }}
    >
      {/* Center line */}
      <div className="absolute inset-0 flex items-center z-10 pointer-events-none">
        <div className="w-full border-t border-[#3a3a3a]" style={{ borderTopWidth: 2 }} />
      </div>

      {/* Top half (static, always shows current) */}
      <div
        className="w-full flex items-end justify-center overflow-hidden bg-[#111]"
        style={{ height: hw, borderTopLeftRadius: 4, borderTopRightRadius: 4 }}
      >
        <span
          className="text-[#d97757] font-bold leading-none select-none"
          style={{ fontSize: cardSize.fontSize, transform: "translateY(50%)" }}
        >
          {display}
        </span>
      </div>

      {/* Bottom half */}
      <div
        className="w-full relative bg-[#111]"
        style={{
          height: hw,
          borderBottomLeftRadius: 4,
          borderBottomRightRadius: 4,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Static bottom (shown when settled) */}
        <div
          className="absolute inset-0 flex items-start justify-center overflow-hidden"
          style={{ backfaceVisibility: "hidden" }}
        >
          <span
            className="text-[#d97757] font-bold leading-none select-none"
            style={{ fontSize: cardSize.fontSize, transform: "translateY(-50%)" }}
          >
            {display}
          </span>
        </div>

        {/* Animated flipping panel (only rendered while animating) */}
        {isAnimating && prevChar !== null && (
          <motion.div
            className="absolute inset-0 flex items-start justify-center overflow-hidden"
            style={{
              backgroundColor: "#111",
              borderBottomLeftRadius: 4,
              borderBottomRightRadius: 4,
              backfaceVisibility: "hidden",
              transformOrigin: "top",
            }}
            initial={{ rotateX: 90 }}
            animate={{ rotateX: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.6, 1] }}
          >
            <span
              className="text-[#d97757] font-bold leading-none select-none"
              style={{ fontSize: cardSize.fontSize, transform: "translateY(-50%)" }}
            >
              {prevDisplay}
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const cardSize = useCardSize();

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), TOTAL_DURATION + 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black overflow-hidden"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <div className="flex gap-1.5 sm:gap-2">
            {TARGET_CHARS.map((ch, i) => (
              <FlapCard key={i} target={ch} cardSize={cardSize} />
            ))}
          </div>
          <motion.p
            className="text-[#d97757]/60 text-sm sm:text-base font-medium tracking-[0.3em] mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.6 }}
          >
            INDUSTRIAL INTEL CONSOLE
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
