import type { Metadata } from "next";
import CoursesPage from "../courses/page";

const title = "Online Courses - STC Academy | Learn from Anywhere";
const description = "Explore our comprehensive online course catalog with programs for Primary, Middle, SSC, HSC, JEE, and NEET. Faculty-guided learning across GSEB and CBSE pathways.";

export const metadata: Metadata = {
  title,
  description,
  keywords: ["STC online courses", "online learning", "GSEB courses", "CBSE courses", "SSC", "HSC", "JEE", "NEET", "Gujarat education"],
  alternates: { canonical: "/online-courses" },
  openGraph: { type: "website", title, description, url: "/online-courses" },
  twitter: { card: "summary_large_image", title, description },
};

export const revalidate = 300;

export default CoursesPage;
