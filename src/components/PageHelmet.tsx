import { type FC, memo, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';

interface PageHelmetProps {
  title: string;
  description: string;
  keywords: string;
  canonicalUrl?: string;
  imageUrl?: string;
  robots?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const PageHelmet: FC<PageHelmetProps> = memo(
  ({ title, description, keywords, canonicalUrl, imageUrl, robots, jsonLd }) => {
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
    const finalJsonLd = useMemo(() => jsonLd ?? defaultJsonLd, [jsonLd, defaultJsonLd]);

    // Normalize to array for rendering
    const jsonLdItems = useMemo(
      () => (Array.isArray(finalJsonLd) ? finalJsonLd : [finalJsonLd]),
      [finalJsonLd]
    );

    // Memoize the image URL computation
    const finalImageUrl = useMemo(() => imageUrl ?? 'https://scrumtools.app/og-image.png', [imageUrl]);

    return (
      <Helmet>
        {/* Standard SEO */}
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="keywords" content={keywords} />
        {canonicalUrl ? <link rel="canonical" href={canonicalUrl} /> : null}
        {robots ? <meta name="robots" content={robots} /> : null}

        {/* Open Graph */}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        {canonicalUrl ? <meta property="og:url" content={canonicalUrl} /> : null}
        <meta property="og:image" content={finalImageUrl} />
        <meta property="og:site_name" content="Scrum Tools" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={finalImageUrl} />

        {/* JSON-LD Structured Data */}
        {jsonLdItems.map((item) => (
          <script key={(item as Record<string, string>)['@type'] ?? 'jsonld'} type="application/ld+json">
            {JSON.stringify(item)}
          </script>
        ))}
      </Helmet>
    );
  }
);

PageHelmet.displayName = 'PageHelmet';

export default PageHelmet;
