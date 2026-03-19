export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqCategory {
  name: string;
  items: FaqItem[];
}

export const faqCategories: FaqCategory[] = [
  {
    name: 'General',
    items: [
      {
        question: 'Is Scrum Tools free?',
        answer:
          'Yes, all core tools are completely free to use. You can access Planning Poker, Retro Board, Daily Standup Timer, and Team Velocity Tracker without paying anything. No credit card required.',
      },
      {
        question: 'Do I need to create an account?',
        answer:
          'No. All tools work without an account. You can create rooms, join sessions, and use every feature anonymously. Creating an optional account unlocks workspace features for organizing your team, but it is never required.',
      },
      {
        question: 'Is my data secure?',
        answer:
          'Yes. All communication is encrypted via HTTPS. Anonymous rooms are temporary and data is not stored permanently. Workspace data is stored in a PostgreSQL database with standard security practices. We do not sell or share your data.',
      },
      {
        question: 'Does Scrum Tools work on mobile devices?',
        answer:
          'Yes. The app is fully responsive and works on phones, tablets, and desktops. All features including real-time collaboration work across devices.',
      },
      {
        question: 'Can I use Scrum Tools with my remote team?',
        answer:
          'Absolutely. Scrum Tools is built for real-time collaboration and works great for remote and distributed teams. All tools support simultaneous usage with instant updates across all participants.',
      },
    ],
  },
  {
    name: 'Planning Poker',
    items: [
      {
        question: 'How many people can join a Planning Poker room?',
        answer:
          'There is no hard limit on participants. Planning Poker rooms support teams of any size. All participants can vote simultaneously and see results in real-time.',
      },
      {
        question: 'What card decks are available?',
        answer:
          'Planning Poker supports the Fibonacci sequence (1, 2, 3, 5, 8, 13, 21), T-shirt sizes (XS, S, M, L, XL), and custom card values. You can choose your preferred deck when creating a room.',
      },
      {
        question: 'Can I password-protect a Planning Poker room?',
        answer:
          'Yes. When creating a room, you can set an optional password. Only participants who enter the correct password can join the session.',
      },
      {
        question: 'How does simultaneous reveal work?',
        answer:
          'All participants select their cards privately. Cards remain hidden until the facilitator reveals them. This prevents anchoring bias, where the first estimate spoken influences everyone else.',
      },
    ],
  },
  {
    name: 'Retro Board',
    items: [
      {
        question: 'Can I use the retro board anonymously?',
        answer:
          'Yes. Team members can add cards anonymously, so feedback is honest and uninhibited. The board also supports optional author names if your team prefers transparency.',
      },
      {
        question: 'What retrospective formats are supported?',
        answer:
          'The retro board uses a flexible column system that supports popular formats including Start/Stop/Continue, What Went Well/What Didn\'t/Action Items, Mad/Sad/Glad, and more. You can customize column names to fit any format.',
      },
      {
        question: 'Can team members vote on retro cards?',
        answer:
          'Yes. The retro board includes a voting feature so the team can prioritize which topics to discuss. This ensures the most important issues get attention within the time-boxed ceremony.',
      },
      {
        question: 'Are retro boards saved permanently?',
        answer:
          'Anonymous boards are temporary and available as long as participants are connected. Workspace boards are saved permanently and can be revisited at any time.',
      },
    ],
  },
  {
    name: 'Daily Standup Timer',
    items: [
      {
        question: 'How does the standup timer work?',
        answer:
          'Add your team members, set a per-person time limit, and start the standup. The timer counts down for each speaker and can optionally randomize the speaking order. Visual and audio alerts notify the team when time is up.',
      },
      {
        question: 'Can I randomize the speaking order?',
        answer:
          'Yes. The standup timer supports randomized order to keep standups fresh and prevent people from tuning out until their turn. You can also use a fixed order if your team prefers consistency.',
      },
      {
        question: 'What happens when someone goes over time?',
        answer:
          'The timer shows a visual alert when time expires. The facilitator can choose to move on or allow extra time. The goal is to keep standups focused, not to cut people off mid-sentence.',
      },
    ],
  },
  {
    name: 'Team Velocity',
    items: [
      {
        question: 'What is team velocity?',
        answer:
          'Team velocity is the amount of work (measured in story points) that a team completes in a sprint. Tracking velocity over time helps teams plan future sprints more accurately by using historical data instead of guesswork.',
      },
      {
        question: 'Can I export velocity data?',
        answer:
          'Velocity data is stored in your browser for anonymous usage. Workspace velocity data is stored on the server and persists across sessions. Export functionality depends on your workspace setup.',
      },
      {
        question: 'How many sprints should I track before velocity is reliable?',
        answer:
          'Typically 5-6 sprints. After that, your rolling average becomes a reliable predictor for sprint planning. The velocity tracker calculates this automatically and shows the trend over time.',
      },
    ],
  },
  {
    name: 'Workspaces',
    items: [
      {
        question: 'What are workspaces?',
        answer:
          'Workspaces are optional team spaces that organize your boards, rooms, and velocity data in one place. They require a free account and let you invite team members, manage permissions, and keep a persistent history of your Scrum activities.',
      },
      {
        question: 'How do I invite team members to a workspace?',
        answer:
          'Workspace owners can generate invitation links or invite members by email. Invited members receive a link to join and get access to all workspace boards and rooms.',
      },
      {
        question: 'Can I have multiple workspaces?',
        answer:
          'Yes. You can create and join multiple workspaces. This is useful if you work with different teams or on different projects. You can switch between workspaces from the navigation bar.',
      },
    ],
  },
];
