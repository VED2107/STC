import type { Metadata } from "next";
import { CreditsPage } from "./client";

export const metadata: Metadata = {
  title: "Credits & Founders | Meet The Minds Behind STC",
  description:
    "A showcase of the vision, leadership, and engineering behind the Student Tracking & Campus Management Platform. Meet the founder and the developer who built STC Academy.",
  keywords: [
    "STC Academy",
    "credits",
    "founders",
    "Vishal Darji",
    "Ved Chauhan",
    "developer",
    "full stack engineer",
  ],
};

export default function Credits() {
  return <CreditsPage />;
}
