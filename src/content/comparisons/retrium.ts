import type { ComparisonData } from './types';

export const retriumComparison: ComparisonData = {
  slug: 'retrium',
  competitorName: 'Retrium',
  pageTitle: 'Scrum Tools vs Retrium | Free Retrospective Board',
  metaDescription:
    'Compare Scrum Tools and Retrium for sprint retrospectives. See how our free retro board with anonymous cards, voting, and action tracking compares to Retrium\'s paid platform.',
  keywords:
    'scrum tools vs retrium, retrium alternative, free retro board, free retrospective tool, retrium pricing, retrospective tool comparison',
  heroHeadline: 'Scrum Tools vs Retrium for Retrospectives',
  heroSubtext:
    'Retrium is a dedicated retrospective platform. Scrum Tools offers a free retro board plus Planning Poker, standup timer, and velocity tracking. Here\'s how they compare.',
  features: [
    { name: 'Retro Board', scrumTools: 'Built-in with multiple formats', competitor: 'Dedicated retro platform' },
    { name: 'Anonymous Cards', scrumTools: true, competitor: true },
    { name: 'Voting', scrumTools: true, competitor: true },
    { name: 'Action Item Tracking', scrumTools: true, competitor: 'Advanced with follow-up' },
    { name: 'Multiple Retro Formats', scrumTools: 'Customizable columns', competitor: '10+ built-in templates' },
    { name: 'Team Health Checks', scrumTools: false, competitor: true },
    { name: 'Retro Analytics', scrumTools: false, competitor: 'Trend analysis over time' },
    { name: 'Planning Poker', scrumTools: true, competitor: false },
    { name: 'Standup Timer', scrumTools: true, competitor: false },
    { name: 'Velocity Tracking', scrumTools: true, competitor: false },
    { name: 'Free for Teams', scrumTools: 'Completely free', competitor: 'Paid (free trial only)' },
    { name: 'No Account Required', scrumTools: true, competitor: false },
  ],
  proseSections: [
    {
      heading: 'When to Choose Scrum Tools',
      content:
        'Choose Scrum Tools if you want a free, no-signup retro board that covers the essentials: anonymous cards, voting, grouping, and action items. You also get Planning Poker, standup timer, and velocity tracking at no cost. For most teams, this covers everything needed for effective retrospectives without the overhead of a paid platform.',
    },
    {
      heading: 'When to Choose Retrium',
      content:
        'Choose Retrium if retrospectives are your primary focus and you want advanced features like built-in retro templates (Sailboat, 4Ls, Starfish, etc.), team health checks, longitudinal analytics, and detailed action item follow-up. Retrium is a specialized retrospective platform and goes deeper on retro-specific features than a general agile suite.',
    },
    {
      heading: 'The Cost Difference',
      content:
        'Scrum Tools is completely free for all features with no user limits. Retrium requires a paid subscription after a trial period, with pricing based on team size. For teams that run solid retrospectives without needing analytics dashboards, Scrum Tools provides everything you need at zero cost.',
    },
  ],
  ctaSections: [
    {
      toolName: 'Retro Board',
      toolPath: '/retro',
      description: 'Run free retrospectives with anonymous cards, voting, and action item tracking.',
    },
    {
      toolName: 'Planning Poker',
      toolPath: '/planning-poker',
      description: 'Estimate stories collaboratively — included free with Scrum Tools.',
    },
    {
      toolName: 'Daily Standup Timer',
      toolPath: '/daily-standup',
      description: 'Keep standups focused — another free tool Retrium doesn\'t offer.',
    },
  ],
};
