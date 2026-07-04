"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SplitFlapDisplay from "react-split-flap-display";

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Let flaps animate for 2.4s, then fade out
    const timer = setTimeout(() => {
      setVisible(false);
    }, 2400);

    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <div className="scale-[2] sm:scale-[3] md:scale-[4]">
            <SplitFlapDisplay
              background="#000000"
              borderColor="#333333"
              borderWidth="2px"
              characterSet={[
                " ", "A", "B", "C", "D", "E", "F", "G", "H", "I",
                "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S",
                "T", "U", "V", "W", "X", "Y", "Z", "/"
              ]}
              characterWidth="1.1em"
              fontSize="1em"
              minLength={8}
              padDirection="right"
              step={60}
              textColor="#d97757"
              value="VIGIL// "
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
