import { FC } from 'react'
import { Helmet } from 'react-helmet-async'

interface PageHelmetProps {
    title: string
    description: string
    keywords: string
    canonicalUrl?: string
    jsonLd?: Record<string, any>
}

const PageHelmet: FC<PageHelmetProps> = ({ title, description, keywords, canonicalUrl, jsonLd }) => {
    const defaultJsonLd = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "Scrum Tools",
        "applicationCategory": "ProjectManagementApplication",
        "operatingSystem": "Any",
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
        }
    }

    const finalJsonLd = jsonLd || defaultJsonLd

    return (
        <Helmet>
            <title>{title}</title>
            <meta name="description" content={description} />
            <meta name="keywords" content={keywords} />
            {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
            <script type="application/ld+json">
                {JSON.stringify(finalJsonLd)}
            </script>
        </Helmet>
    )
}

export default PageHelmet
