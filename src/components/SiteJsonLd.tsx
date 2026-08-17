import { getResolvedSiteBrand } from "@/lib/site-brand-server";
import { getSiteSeo, absoluteSeoUrl } from "@/lib/site-seo-store";
import { siteOrigin } from "@/lib/site-seo-server";
import { BRAND_NAME } from "@/lib/brand";
import { trainStationSearchPhrases } from "@/lib/search-third-words";

/** Public structured data so Google/Bing know this is The Train Station coaching site. */
export default async function SiteJsonLd() {
  const [seo, brand] = await Promise.all([getSiteSeo(), getResolvedSiteBrand()]);
  const origin = siteOrigin();
  const name = brand.brandName || BRAND_NAME;
  const logo = absoluteSeoUrl(brand.logoIconUrl || "/icon-512.png", origin);

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        name,
        alternateName: trainStationSearchPhrases(),
        url: origin,
        description: seo.metaDescription,
        inLanguage: "en-US",
      },
      {
        "@type": "Organization",
        "@id": `${origin}/#org`,
        name,
        url: origin,
        logo,
        description: seo.metaDescription,
        founder: { "@id": `${origin}/#jeremy` },
        employee: { "@id": `${origin}/#jeremy` },
        sameAs: [`${origin}/jeremy`, `${origin}/find`],
      },
      {
        "@type": "Person",
        "@id": `${origin}/#jeremy`,
        name: "Jeremy Byrd",
        jobTitle: "Strength and conditioning coach",
        url: `${origin}/jeremy`,
        image: `${origin}/images/programs/speaking.jpg`,
        worksFor: { "@id": `${origin}/#org` },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
