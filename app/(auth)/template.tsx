"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export default function AuthTemplate({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      {children}
    </motion.div>
  );
}
