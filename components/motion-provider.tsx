"use client";

import { MotionConfig, type Transition } from "framer-motion";
import type { ReactNode } from "react";

const defaultTransition: Transition = {
  type: "tween",
  duration: 0.2,
  ease: [0.22, 1, 0.36, 1],
};

function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={defaultTransition}>
      {children}
    </MotionConfig>
  );
}

export { MotionProvider };
