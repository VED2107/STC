const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/** Renders a single JSON-LD <script> tag for the given schema.org object. */
function JsonLdScript({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Organization + WebSite schema — rendered once, site-wide, in the root layout. */
export function SiteJsonLd() {
  const organization = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "@id": `${SITE_URL}/#organization`,
    name: "STC Academy",
    alternateName: "STC Tuition Centre",
    url: SITE_URL,
    logo: `${SITE_URL}/android-chrome-512x512.png`,
    description:
      "STC Tuition Centre provides high-quality study materials and excellent education across every course and level, for Class 1 to HSC — GSEB & CBSE boards.",
    telephone: "+91-7016072398",
    email: "stcinstindia@gmail.com",
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: "STC Academy",
    publisher: { "@id": `${SITE_URL}/#organization` },
  };

  return (
    <>
      <JsonLdScript data={organization} />
      <JsonLdScript data={website} />
    </>
  );
}

export type BreadcrumbItem = { name: string; path: string };

/** Reusable BreadcrumbList schema for nested public pages. */
export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };

  return <JsonLdScript data={data} />;
}

type CourseSchemaProps = {
  name: string;
  description: string;
  url: string;
  providerName?: string;
};

/** Course schema for individual course detail pages. */
export function CourseJsonLd({ name, description, url, providerName }: CourseSchemaProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Course",
    name,
    description,
    url: `${SITE_URL}${url}`,
    provider: {
      "@type": "EducationalOrganization",
      name: "STC Academy",
      sameAs: SITE_URL,
    },
    ...(providerName ? { instructor: { "@type": "Person", name: providerName } } : {}),
  };

  return <JsonLdScript data={data} />;
}
