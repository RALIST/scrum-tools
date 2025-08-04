import { FC, memo, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';

interface PageHelmetProps {
  title: string;
  description: string;
  keywords: string;
  canonicalUrl?: string;
  imageUrl?: string;
  jsonLd?: Record<string, unknown>;
}

const PageHelmet: FC<PageHelmetProps> = memo(
  ({ title, description, keywords, canonicalUrl, imageUrl, jsonLd }) => {
    // Memoize the default JSON-LD to avoid recreation on every render
    const defaultJsonLd = useMemo(
      () => ({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Scrum Tools',
        applicationCategory: 'ProjectManagementApplication',
        operatingSystem: 'Any',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      }),
      []
    );

    // Memoize the final JSON-LD computation
    const finalJsonLd = useMemo(() => jsonLd || defaultJsonLd, [jsonLd, defaultJsonLd]);

    // Memoize the image URL computation
    const finalImageUrl = useMemo(() => imageUrl || '/og-image.svg', [imageUrl]);

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
        <meta property="og:image" content={finalImageUrl} />
        <meta property="og:site_name" content="Scrum Tools" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={finalImageUrl} />

        {/* JSON-LD Structured Data */}
        <script type="application/ld+json">{JSON.stringify(finalJsonLd)}</script>
      </Helmet>
    );
  }
);

PageHelmet.displayName = 'PageHelmet';

export default PageHelmet;
