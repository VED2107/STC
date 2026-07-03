import type { Metadata } from "next";
import CoursesPage from "../courses/page";

export const metadata: Metadata = {
  title: "Online Courses - STC Academy | Learn from Anywhere",
  description: "Explore our comprehensive online course catalog with programs for Primary, Middle, SSC, HSC, JEE, and NEET. Faculty-guided learning across GSEB and CBSE pathways.",
  keywords: ["STC online courses", "online learning", "GSEB courses", "CBSE courses", "SSC", "HSC", "JEE", "NEET", "Gujarat education"],
  alternates: { canonical: "/online-courses" },
};

export const revalidate = 300;

export default CoursesPage;
