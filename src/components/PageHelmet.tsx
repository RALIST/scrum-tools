import { FC } from 'react'
import { Helmet } from 'react-helmet-async'

interface PageHelmetProps {
    title: string
    description: string
    keywords?: string
    canonicalUrl?: string
}

const PageHelmet: FC<PageHelmetProps> = ({ title, description, keywords, canonicalUrl }) => {
    const fullTitle = `${title} | Scrum Tools`
    const defaultKeywords = 'scrum, agile, planning poker, daily standup, scrum tools'
    const allKeywords = keywords ? `${defaultKeywords}, ${keywords}` : defaultKeywords

    return (
        <Helmet>
            <title>{fullTitle}</title>
            <meta name="description" content={description} />
            <meta name="keywords" content={allKeywords} />
            {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />
        </Helmet>
    )
}

export default PageHelmet
