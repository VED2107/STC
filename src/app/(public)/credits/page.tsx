import type { Metadata } from "next";
import { CreditsPage } from "./client";

const title = "Credits & Founders | Meet The Minds Behind STC";
const description =
  "A showcase of the vision, leadership, and engineering behind the Student Tracking & Campus Management Platform. Meet the founder and the developer who built STC Academy.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "STC Academy",
    "credits",
    "founders",
    "Vishal Darji",
    "Ved Chauhan",
    "developer",
    "full stack engineer",
  ],
  alternates: { canonical: "/credits" },
  openGraph: { type: "website", title, description, url: "/credits" },
  twitter: { card: "summary_large_image", title, description },
};

export default function Credits() {
  return <CreditsPage />;
}
