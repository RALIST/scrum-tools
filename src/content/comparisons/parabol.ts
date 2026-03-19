import type { ComparisonData } from './types';

export const parabolComparison: ComparisonData = {
  slug: 'parabol',
  competitorName: 'Parabol',
  pageTitle: 'Scrum Tools vs Parabol | Free Agile Meeting Tools',
  metaDescription:
    'Compare Scrum Tools and Parabol for agile meetings. See how our free Planning Poker, Retro Board, and Standup Timer compare to Parabol\'s meeting facilitation platform.',
  keywords:
    'scrum tools vs parabol, parabol alternative, free agile tools, parabol pricing, agile meeting tools comparison',
  heroHeadline: 'Scrum Tools vs Parabol for Agile Meetings',
  heroSubtext:
    'Parabol is an agile meeting facilitation tool. Scrum Tools provides free, focused ceremony tools with no account required. Here\'s how they compare.',
  features: [
    { name: 'Planning Poker', scrumTools: 'Built-in with card decks', competitor: 'Sprint Poker feature' },
    { name: 'Retro Board', scrumTools: 'Anonymous cards, voting, actions', competitor: 'Guided retro with AI summaries' },
    { name: 'Standup Timer', scrumTools: 'Per-person timer with randomization', competitor: 'Async standup check-ins' },
    { name: 'Velocity Tracking', scrumTools: 'Built-in charts & averages', competitor: false },
    { name: 'AI Meeting Summaries', scrumTools: false, competitor: true },
    { name: 'Jira/GitHub Integration', scrumTools: false, competitor: true },
    { name: 'Guided Facilitation', scrumTools: false, competitor: 'Step-by-step meeting flow' },
    { name: 'No Account Required', scrumTools: true, competitor: false },
    { name: 'Free for Teams', scrumTools: 'Completely free', competitor: 'Free up to 2 teams' },
    { name: 'Simultaneous Card Reveal', scrumTools: true, competitor: true },
    { name: 'Anonymous Retro Cards', scrumTools: true, competitor: true },
    { name: 'Real-time Collaboration', scrumTools: true, competitor: true },
  ],
  proseSections: [
    {
      heading: 'When to Choose Scrum Tools',
      content:
        'Choose Scrum Tools if you want instant, no-setup ceremony tools. There\'s no account creation, no onboarding flow, and no configuration. Share a link and your team is collaborating in seconds. All features are free with no team size limits. If your team knows how to run their ceremonies and just needs the right tools, Scrum Tools gets out of the way.',
    },
    {
      heading: 'When to Choose Parabol',
      content:
        'Choose Parabol if you want guided meeting facilitation. Parabol walks teams through each ceremony step-by-step, which is valuable for new Scrum teams or teams that want more structure. Parabol also offers AI-generated meeting summaries and integrations with Jira and GitHub, which can streamline your workflow if you use those tools.',
    },
    {
      heading: 'Simplicity vs. Structure',
      content:
        'The core difference is philosophy. Scrum Tools provides focused, flexible tools and trusts the team to run their own ceremonies. Parabol provides structured meeting flows with built-in facilitation. Experienced agile teams often prefer the flexibility of Scrum Tools, while newer teams may benefit from Parabol\'s guidance.',
    },
  ],
  ctaSections: [
    {
      toolName: 'Planning Poker',
      toolPath: '/planning-poker',
      description: 'Estimate stories with real-time collaboration and simultaneous reveal.',
    },
    {
      toolName: 'Retro Board',
      toolPath: '/retro',
      description: 'Run retrospectives with anonymous cards, voting, and flexible formats.',
    },
    {
      toolName: 'Velocity Tracker',
      toolPath: '/velocity',
      description: 'Track sprint velocity with charts — a feature Parabol doesn\'t offer.',
    },
  ],
};
