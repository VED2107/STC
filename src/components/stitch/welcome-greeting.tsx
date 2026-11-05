"use client";

import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/feedback";

const LOGIN_FLAG = "stc:just-logged-in";

export function markJustLoggedIn(isNew?: boolean) {
  try {
    sessionStorage.setItem(LOGIN_FLAG, isNew ? "new" : "1");
  } catch {}
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

interface WelcomeGreetingProps {
  name: string;
  isNewUser?: boolean;
}

/** Greets once after sign-in with a toast, so the workspace is usable straight away. */
export function WelcomeGreeting({ name, isNewUser }: WelcomeGreetingProps) {
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    let flag: string | null = null;
    try {
      flag = sessionStorage.getItem(LOGIN_FLAG);
      if (flag) sessionStorage.removeItem(LOGIN_FLAG);
    } catch {}

    // Also trigger on ?login=1 from the OAuth callback.
    if (!flag) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("login") === "1") {
        flag = "1";
        params.delete("login");
        const clean = params.toString();
        window.history.replaceState({}, "", window.location.pathname + (clean ? `?${clean}` : ""));
      }
    }

    if (!flag) return;

    const firstName = name.split(" ")[0];
    if (isNewUser || flag === "new") {
      toast.success("Welcome to STC Academy. Your account is ready.");
    } else {
      toast.success(firstName ? `${getTimeGreeting()}, ${firstName}.` : `${getTimeGreeting()}.`);
    }
  }, [isNewUser, name]);

  return null;
}
