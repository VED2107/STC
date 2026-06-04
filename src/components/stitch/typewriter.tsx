"use client";

import { useEffect, useState } from "react";

interface TypewriterProps {
  text: string;
  delay?: number;
  speed?: number;
  className?: string;
}

export function Typewriter({ text, delay = 0, speed = 55, className }: TypewriterProps) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  useEffect(() => {
    if (!started) return;

    if (displayed.length >= text.length) return;

    const timeout = window.setTimeout(() => {
      setDisplayed(text.slice(0, displayed.length + 1));
    }, speed);

    return () => clearTimeout(timeout);
  }, [started, displayed, text, speed]);

  const showCursor = started && displayed.length < text.length;

  return (
    <span className={className}>
      {displayed}
      {showCursor && (
        <span className="inline-block w-[3px] animate-pulse bg-current align-baseline">&nbsp;</span>
      )}
      <span className="invisible" aria-hidden="true">
        {text.slice(displayed.length)}
      </span>
    </span>
  );
}
