export interface ComparisonFeature {
  name: string;
  scrumTools: string | boolean;
  competitor: string | boolean;
}

export interface ProseSection {
  heading: string;
  content: string;
}

export interface CtaSection {
  toolName: string;
  toolPath: string;
  description: string;
}

export interface ComparisonData {
  slug: string;
  competitorName: string;
  pageTitle: string;
  metaDescription: string;
  keywords: string;
  heroHeadline: string;
  heroSubtext: string;
  features: ComparisonFeature[];
  proseSections: ProseSection[];
  ctaSections: CtaSection[];
}
