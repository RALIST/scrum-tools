import { jiraComparison } from './jira';
import { miroComparison } from './miro';
import { parabolComparison } from './parabol';
import { retriumComparison } from './retrium';
import type { ComparisonData } from './types';

export type { ComparisonData, ComparisonFeature, CtaSection, ProseSection } from './types';

export const comparisons: Record<string, ComparisonData> = {
  miro: miroComparison,
  jira: jiraComparison,
  retrium: retriumComparison,
  parabol: parabolComparison,
};

export const comparisonList: ComparisonData[] = Object.values(comparisons);
