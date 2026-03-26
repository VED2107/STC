import Link from "next/link";

export default function AboutUsPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-6 py-16 md:px-12">
      <p className="stitch-kicker">About Us</p>
      <h1 className="mt-4 text-5xl italic text-primary md:text-7xl">
        STC Tuition Centre
      </h1>
      <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
        STC is focused on excellent teaching, strong study materials, and practical guidance
        to help school students learn with confidence.
      </p>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <section className="stitch-panel p-8">
          <h2 className="text-3xl text-primary">Contact Details</h2>
          <div className="mt-5 space-y-3 text-sm leading-7 text-muted-foreground">
            <p>
              <span className="font-semibold text-primary">Founder:</span> Vishal Darji
            </p>
            <p>
              <span className="font-semibold text-primary">Email:</span>{" "}
              <a className="text-secondary underline-offset-2 hover:underline" href="mailto:stcinstindia@gmail.com">
                stcinstindia@gmail.com
              </a>
            </p>
            <p>
              <span className="font-semibold text-primary">Phone:</span> To be added later
            </p>
            <p>
              <span className="font-semibold text-primary">Address:</span> To be updated
            </p>
          </div>
        </section>

        <section className="stitch-panel p-8">
          <h2 className="text-3xl text-primary">About The Site</h2>
          <p className="mt-5 text-sm leading-7 text-muted-foreground">
            Our mission is to provide the best study materials and deliver the best education quality across all courses.
          </p>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            We focus on clear concepts, strong academic foundations, and result-oriented guidance so every student can learn with confidence.
          </p>
        </section>
      </div>

      <div className="mt-10">
        <Link href="/courses" className="rounded-xl bg-primary px-8 py-4 text-sm font-semibold text-white transition hover:brightness-105">
          View Curriculum
        </Link>
      </div>
    </div>
  );
}
