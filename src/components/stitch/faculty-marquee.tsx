import Link from "next/link";

interface FacultyTeacher {
  id: string;
  name: string;
  subject: string;
  qualification: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/** Teachers in a row people scroll themselves. Nothing moves while someone is reading a name. */
export function FacultyMarquee({ teachers }: { teachers: FacultyTeacher[] }) {
  if (teachers.length === 0) {
    return <p className="text-muted-foreground">Teacher profiles will appear here as they are added.</p>;
  }

  return (
    <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3">
      {teachers.map((teacher) => (
        <li key={teacher.id} className="w-64 shrink-0 snap-start md:w-auto">
          <Link href="/faculty" className="stitch-panel stitch-hover-lift flex h-full items-start gap-3 p-4">
            <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent font-heading text-base font-bold text-primary">
              {getInitials(teacher.name)}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-foreground">{teacher.name}</span>
              <span className="block text-sm font-medium text-secondary">{teacher.subject}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{teacher.qualification}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
