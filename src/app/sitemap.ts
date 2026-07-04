import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 3600;

const staticRoutes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/about-us", priority: 0.6, changeFrequency: "monthly" },
  { path: "/online-courses", priority: 0.9, changeFrequency: "daily" },
  // /courses is excluded — it's a duplicate of /online-courses (same query, no real inbound links, canonicalized there).
  { path: "/faculty", priority: 0.7, changeFrequency: "weekly" },
  { path: "/materials", priority: 0.6, changeFrequency: "weekly" },
  { path: "/syllabus", priority: 0.6, changeFrequency: "weekly" },
  { path: "/credits", priority: 0.2, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  // /admissions, /enroll, /programs, /teachers are redirect-only aliases — excluded to avoid indexing a bounce.
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${siteUrl}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const supabase = await createClient();
  // Only online courses have a public detail page (course detail queries hardcode is_online_only=true).
  const { data: courses } = await supabase
    .from("courses")
    .select("id, updated_at")
    .eq("is_active", true)
    .eq("is_online_only", true);

  const courseEntries: MetadataRoute.Sitemap = ((courses as Array<{ id: string; updated_at: string }> | null) ?? []).map(
    (course) => ({
      url: `${siteUrl}/online-courses/${course.id}`,
      lastModified: new Date(course.updated_at),
      changeFrequency: "weekly",
      priority: 0.7,
    }),
  );

  return [...staticEntries, ...courseEntries];
}
