import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - STC Academy | Data Protection & Student Information",
  description: "STC Academy's privacy policy for student and guardian information usage in admissions, academic operations, attendance communication, and course delivery.",
  keywords: ["privacy policy", "data protection", "student information", "STC Academy privacy"],
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16 md:px-10">
      <p className="stitch-kicker">Privacy</p>
      <h1 className="mt-4 text-5xl italic text-primary md:text-6xl">Privacy Policy</h1>
      <p className="mt-6 text-base leading-8 text-muted-foreground">
        STC Academy uses student and guardian information only for admissions,
        academic operations, attendance communication, and course delivery.
      </p>
      <p className="mt-4 text-base leading-8 text-muted-foreground">
        For account deletion or data correction requests, contact the academy
        admin desk using the email listed in the footer.
      </p>
    </div>
  );
}
