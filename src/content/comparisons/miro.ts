import type { ComparisonData } from './types';

export const miroComparison: ComparisonData = {
  slug: 'miro',
  competitorName: 'Miro',
  pageTitle: 'Scrum Tools vs Miro | Free Agile Ceremony Tools',
  metaDescription:
    'Compare Scrum Tools and Miro for agile ceremonies. See how our free, purpose-built Planning Poker, Retro Board, and Standup Timer compare to Miro\'s general-purpose whiteboard.',
  keywords:
    'scrum tools vs miro, miro alternative, free retro board, miro retrospective alternative, agile tools comparison',
  heroHeadline: 'Scrum Tools vs Miro for Agile Ceremonies',
  heroSubtext:
    'Miro is a powerful general-purpose whiteboard. Scrum Tools is purpose-built for agile ceremonies. Here\'s how they compare for sprint retrospectives, planning poker, and daily standups.',
  features: [
    { name: 'Planning Poker', scrumTools: 'Built-in with card decks', competitor: 'Requires templates or plugins' },
    { name: 'Retro Board', scrumTools: 'Dedicated with voting & anonymous cards', competitor: 'Template-based on whiteboard' },
    { name: 'Standup Timer', scrumTools: 'Built-in per-person timer', competitor: 'Not available' },
    { name: 'Velocity Tracking', scrumTools: 'Built-in charts & averages', competitor: 'Not available' },
    { name: 'Simultaneous Card Reveal', scrumTools: true, competitor: false },
    { name: 'Anonymous Retro Cards', scrumTools: true, competitor: false },
    { name: 'No Account Required', scrumTools: true, competitor: false },
    { name: 'Free for Teams', scrumTools: 'Completely free', competitor: 'Free for 3 boards, then paid' },
    { name: 'General Whiteboarding', scrumTools: false, competitor: true },
    { name: 'Diagramming & Flowcharts', scrumTools: false, competitor: true },
    { name: 'Real-time Collaboration', scrumTools: true, competitor: true },
    { name: 'Mobile Support', scrumTools: true, competitor: true },
  ],
  proseSections: [
    {
      heading: 'When to Choose Scrum Tools',
      content:
        'Choose Scrum Tools if your primary need is running agile ceremonies efficiently. Our tools are purpose-built for Planning Poker, retrospectives, daily standups, and velocity tracking. There\'s no setup, no templates to find, and no account required. Everything works out of the box with features like simultaneous card reveal, anonymous retro cards, and per-person standup timers that Miro doesn\'t offer natively.',
    },
    {
      heading: 'When to Choose Miro',
      content:
        'Choose Miro if you need a general-purpose visual collaboration platform. Miro excels at whiteboarding, diagramming, mind mapping, and design workshops. If your team uses visual collaboration for many purposes beyond Scrum ceremonies, Miro\'s flexibility is valuable. However, for agile-specific ceremonies, you\'ll need to find and configure templates rather than having purpose-built tools.',
    },
    {
      heading: 'Can You Use Both?',
      content:
        'Many teams use both. Miro for design workshops, brainstorming, and diagramming. Scrum Tools for sprint ceremonies. This gives you the best of both worlds: a powerful whiteboard for creative collaboration and focused, optimized tools for your recurring agile events.',
    },
  ],
  ctaSections: [
    {
      toolName: 'Retro Board',
      toolPath: '/retro',
      description: 'Run retrospectives with anonymous cards, voting, and action item tracking.',
    },
    {
      toolName: 'Planning Poker',
      toolPath: '/planning-poker',
      description: 'Estimate stories with simultaneous reveal and multiple card decks.',
    },
    {
      toolName: 'Daily Standup Timer',
      toolPath: '/daily-standup',
      description: 'Keep standups focused with per-person timers and randomized order.',
    },
  ],
};
