import { SITE_URL } from "@/lib/site-config";

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

/** Organization + LocalBusiness + WebSite schema — rendered once, site-wide, in the root layout. */
export function SiteJsonLd() {
  const organization = {
    "@context": "https://schema.org",
    "@type": ["EducationalOrganization", "LocalBusiness"],
    "@id": `${SITE_URL}/#organization`,
    name: "Saraswati Tuition Classes (STC)",
    alternateName: "STC Academy",
    url: SITE_URL,
    logo: `${SITE_URL}/android-chrome-512x512.png`,
    image: `${SITE_URL}/android-chrome-512x512.png`,
    description:
      "STC Tuition Centre provides high-quality study materials and excellent education across every course and level, for Class 1 to HSC — GSEB & CBSE boards.",
    telephone: "+91-7016072398",
    email: "stcinstindia@gmail.com",
    priceRange: "₹₹",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Yash Homes Complex, 20, Padmanabh Rd, Chokdi",
      addressLocality: "Patan",
      addressRegion: "Gujarat",
      postalCode: "384266",
      addressCountry: "IN",
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
      opens: "06:00",
      closes: "20:00",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.7",
      reviewCount: "13",
    },
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: "STC Academy",
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/online-courses?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
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

type PersonSchemaProps = {
  name: string;
  jobTitle: string;
  description?: string | null;
  image?: string | null;
};

/** Person schema for faculty profiles. */
export function PersonJsonLd({ name, jobTitle, description, image }: PersonSchemaProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    jobTitle,
    worksFor: { "@id": `${SITE_URL}/#organization` },
    ...(description ? { description } : {}),
    ...(image ? { image } : {}),
  };

  return <JsonLdScript data={data} />;
}

export type FaqItem = { question: string; answer: string };

/** FAQPage schema — pair with a visible FAQ section on the same page. */
export function FaqJsonLd({ items }: { items: FaqItem[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return <JsonLdScript data={data} />;
}
