import { FC } from "react";
import { Helmet } from "react-helmet-async";

interface PageHelmetProps {
  title: string;
  description: string;
  keywords: string;
  canonicalUrl?: string;
  imageUrl?: string;
  jsonLd?: Record<string, any>;
}

const PageHelmet: FC<PageHelmetProps> = ({
  title,
  description,
  keywords,
  canonicalUrl,
  imageUrl,
  jsonLd,
}) => {
  const defaultJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Scrum Tools",
    applicationCategory: "ProjectManagementApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  const finalJsonLd = jsonLd || defaultJsonLd;

  return (
    <Helmet>
      {/* Standard SEO */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:image" content={imageUrl || "/og-image.svg"} />
      <meta property="og:site_name" content="Scrum Tools" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl || "/og-image.svg"} />

      {/* JSON-LD Structured Data */}
      <script type="application/ld+json">{JSON.stringify(finalJsonLd)}</script>
    </Helmet>
  );
};

export default PageHelmet;
