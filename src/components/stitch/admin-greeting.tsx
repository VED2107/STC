"use client";

import { WelcomeGreeting } from "@/components/stitch/welcome-greeting";

export function AdminGreeting({ name }: { name: string }) {
  return <WelcomeGreeting name={name} />;
}
