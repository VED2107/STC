import type { Class, Course } from "@/lib/types/database";

export type CatalogLevelKey = "all" | "primary" | "middle" | "ssc" | "hsc";
export type CatalogTrackKey = "" | "jee" | "neet";

export type PublicCourseRow = Omit<Course, "class" | "teacher"> & {
  class: Pick<Class, "id" | "name" | "board" | "level" | "sort_order"> | null;
  teacher: { name: string } | null;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function getNumericLevel(level: string | null | undefined) {
  const value = Number.parseInt(level ?? "", 10);
  return Number.isNaN(value) ? null : value;
}

function getCourseText(course: PublicCourseRow) {
  return normalizeText(
    [
      course.title,
      course.subject,
      course.description,
      course.class?.name,
      course.class?.board,
      course.class?.level,
      course.teacher?.name,
    ].join(" "),
  );
}

export function getCourseLevelKey(course: PublicCourseRow): Exclude<CatalogLevelKey, "all"> {
  const classLevel = normalizeText(course.class?.level);
  const className = normalizeText(course.class?.name);
  const numericLevel = getNumericLevel(classLevel);

  if (numericLevel !== null && numericLevel >= 11) {
    return "hsc";
  }

  if (numericLevel !== null) {
    if (numericLevel <= 5) {
      return "primary";
    }

    if (numericLevel <= 8) {
      return "middle";
    }

    return "ssc";
  }

  if (
    classLevel === "hsc" ||
    className.includes("11") ||
    className.includes("12") ||
    className.includes("higher secondary")
  ) {
    return "hsc";
  }

  return "ssc";
}

export function matchesCatalogTrack(course: PublicCourseRow, track: CatalogTrackKey) {
  if (!track) {
    return true;
  }

  return getCourseText(course).includes(track);
}

export function matchesCatalogLevel(course: PublicCourseRow, level: CatalogLevelKey) {
  if (level === "all") {
    return true;
  }

  return getCourseLevelKey(course) === level;
}

export function matchesCatalogQuery(course: PublicCourseRow, query: string) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return true;
  }

  return getCourseText(course).includes(normalizedQuery);
}

export function normalizeCatalogLevel(
  value: string | string[] | undefined,
): CatalogLevelKey {
  const normalizedValue = normalizeText(Array.isArray(value) ? value[0] : value);

  switch (normalizedValue) {
    case "1-5":
    case "primary":
      return "primary";
    case "6-8":
    case "middle":
      return "middle";
    case "9":
    case "10":
    case "9-10":
    case "secondary":
    case "ssc":
      return "ssc";
    case "11":
    case "11th":
    case "12":
    case "12th":
    case "hsc":
      return "hsc";
    default:
      return "all";
  }
}

export function normalizeCatalogTrack(
  value: string | string[] | undefined,
): CatalogTrackKey {
  const normalizedValue = normalizeText(Array.isArray(value) ? value[0] : value);

  if (normalizedValue === "jee" || normalizedValue === "neet") {
    return normalizedValue;
  }

  return "";
}

export function getCatalogQuery(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}
