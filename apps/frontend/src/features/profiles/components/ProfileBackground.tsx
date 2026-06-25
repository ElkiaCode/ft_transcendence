"use client";

import { useMemo } from "react";

export function HelloWorldBackground() {
  const items = useMemo(
    () =>
      Array.from({ length: 50 }).map((_, i) => ({
        left: `${(i % 8) * 13}%`,
        top: `${Math.floor(i / 8) * 16}%`,
      })),
    [],
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {items.map((item, i) => (
        <div
          key={i}
          className="absolute text-xs font-mono whitespace-nowrap TextColorS"
          style={{ opacity: 0.5, left: item.left, top: item.top }}
        >
          Hello, World!
        </div>
      ))}
      <div
        className="absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(ellipse 30% 50% at 50% 30%, black 40%, transparent 100%)",
        }}
      />
    </div>
  );
}