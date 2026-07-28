"use client";

import {
  motion,
  useIsPresent,
  type HTMLMotionProps,
} from "framer-motion";

function PresencePanel({ children, ...props }: HTMLMotionProps<"div">) {
  const isPresent = useIsPresent();

  return (
    <motion.div {...props} inert={!isPresent} aria-hidden={!isPresent}>
      {children}
    </motion.div>
  );
}

export { PresencePanel };
