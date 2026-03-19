import type { ComparisonData } from './types';

export const jiraComparison: ComparisonData = {
  slug: 'jira',
  competitorName: 'Jira',
  pageTitle: 'Scrum Tools vs Jira | Free Sprint Ceremony Tools',
  metaDescription:
    'Compare Scrum Tools and Jira for sprint planning and agile ceremonies. See how our free tools complement or replace Jira for estimation, retrospectives, and standups.',
  keywords:
    'scrum tools vs jira, jira alternative, free planning poker, jira retrospective, agile tools comparison, jira sprint planning',
  heroHeadline: 'Scrum Tools vs Jira for Sprint Ceremonies',
  heroSubtext:
    'Jira is a project management powerhouse. Scrum Tools provides the lightweight ceremony tools that Jira lacks. Here\'s how they compare — and why many teams use both.',
  features: [
    { name: 'Planning Poker', scrumTools: 'Built-in with real-time collaboration', competitor: 'Not built-in (requires add-ons)' },
    { name: 'Retro Board', scrumTools: 'Dedicated with voting & anonymous cards', competitor: 'Not built-in (requires add-ons)' },
    { name: 'Standup Timer', scrumTools: 'Built-in per-person timer', competitor: 'Not available' },
    { name: 'Velocity Tracking', scrumTools: 'Simple, focused charts', competitor: 'Built-in with sprint reports' },
    { name: 'Issue Tracking', scrumTools: false, competitor: 'Full-featured' },
    { name: 'Sprint Board / Kanban', scrumTools: false, competitor: 'Full-featured' },
    { name: 'Backlog Management', scrumTools: false, competitor: 'Full-featured' },
    { name: 'No Account Required', scrumTools: true, competitor: false },
    { name: 'Free for Teams', scrumTools: 'Completely free', competitor: 'Free up to 10 users' },
    { name: 'Setup Time', scrumTools: 'Instant — no configuration', competitor: 'Significant setup & admin' },
    { name: 'Real-time Collaboration', scrumTools: true, competitor: true },
    { name: 'Learning Curve', scrumTools: 'Minimal', competitor: 'Steep' },
  ],
  proseSections: [
    {
      heading: 'When to Choose Scrum Tools',
      content:
        'Choose Scrum Tools when you need lightweight, focused ceremony tools with zero setup. If your team wants to run a quick Planning Poker session, a retrospective, or a timed standup without navigating a complex project management tool, Scrum Tools gets you there instantly. No account, no configuration, no admin overhead.',
    },
    {
      heading: 'When to Choose Jira',
      content:
        'Choose Jira when you need full project management: issue tracking, sprint boards, backlog management, release planning, and reporting. Jira is the industry standard for managing work across sprints. However, Jira deliberately focuses on work management and doesn\'t include ceremony-specific tools like Planning Poker, retro boards, or standup timers.',
    },
    {
      heading: 'Using Scrum Tools with Jira',
      content:
        'Most teams that use Scrum Tools also use Jira (or a similar tool) for work management. The workflow is simple: use Jira for your backlog and sprint board, then use Scrum Tools for the ceremony itself — Planning Poker for estimation, Retro Board for retrospectives, Standup Timer for daily syncs. This gives you the best of both: Jira\'s powerful work management plus focused, distraction-free ceremony tools.',
    },
  ],
  ctaSections: [
    {
      toolName: 'Planning Poker',
      toolPath: '/planning-poker',
      description: 'Estimate stories collaboratively with real-time card reveal — no Jira add-on needed.',
    },
    {
      toolName: 'Retro Board',
      toolPath: '/retro',
      description: 'Run retrospectives with anonymous cards, voting, and action items.',
    },
    {
      toolName: 'Velocity Tracker',
      toolPath: '/velocity',
      description: 'Track sprint velocity with simple charts and rolling averages.',
    },
  ],
};
