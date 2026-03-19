---
title: "Sprint Planning: A Step-by-Step Guide for Scrum Teams"
description: "Everything you need to run effective sprint planning meetings. Covers preparation, capacity planning, story selection, and common pitfalls to avoid."
date: "2026-03-08"
slug: "sprint-planning-guide"
keywords: "sprint planning, sprint planning meeting, scrum sprint planning, sprint capacity, backlog refinement, sprint goal"
relatedTool: "/planning-poker"
tags: ["sprint-planning", "scrum", "planning"]
---

# Sprint Planning: A Step-by-Step Guide for Scrum Teams

Sprint planning sets the direction for the entire sprint. Get it right, and your team has a clear goal, a realistic plan, and the confidence to execute. Get it wrong, and you're chasing a moving target for two weeks.

Here's how to run sprint planning that actually works.

## What Is Sprint Planning?

Sprint planning is a time-boxed Scrum event where the team decides what to build in the upcoming sprint and how to build it. It answers two questions:

1. **What can we deliver this sprint?** (Sprint Goal + selected backlog items)
2. **How will we deliver it?** (Task breakdown and approach)

The Scrum Guide time-boxes sprint planning at 8 hours for a one-month sprint, or proportionally less for shorter sprints. For a two-week sprint, aim for 2-4 hours maximum.

## Before the Meeting: Preparation Is Everything

The biggest sprint planning failures happen before the meeting starts.

### Backlog Refinement

The product backlog should be groomed *before* sprint planning, not during it. Stories entering the sprint should already have:

- **Clear acceptance criteria** — everyone agrees on what "done" means
- **Story point estimates** — use [Planning Poker](/planning-poker) in a separate refinement session
- **Dependencies identified** — no surprises mid-sprint
- **Reasonable size** — most stories should be 1-8 points, nothing over 13

If you're spending sprint planning time refining stories, you've already lost.

### Know Your Capacity

Before selecting work, understand how much the team can actually deliver:

- **Check your velocity** — your [team velocity](/velocity) over the last 3-5 sprints is the best predictor of what you can do next sprint
- **Account for absences** — planned time off, holidays, training
- **Factor in carry-over** — incomplete work from last sprint takes priority
- **Reserve capacity for unknowns** — most teams plan to 80-85% of their velocity to account for unexpected work

### Product Owner Preparation

The Product Owner should come with:

- A prioritized backlog (top items are sprint candidates)
- A draft sprint goal that connects to business objectives
- Answers ready for likely technical questions
- Flexibility on scope within the goal

## The Sprint Planning Meeting

### Part 1: The What (60-90 minutes)

#### Set the Sprint Goal

Start with *why*, not *what*. The Product Owner proposes a sprint goal — a concise statement of the business outcome the sprint should achieve.

**Good sprint goal:** "Users can invite team members to their workspace via email."

**Bad sprint goal:** "Complete stories PROJ-123, PROJ-124, PROJ-125, and PROJ-126."

The goal should be achievable, measurable, and meaningful to stakeholders. Individual stories are the means, not the end.

#### Select Backlog Items

With the sprint goal as a filter, the team pulls stories from the top of the backlog:

1. Product Owner presents the highest-priority story
2. Team confirms they understand it (quick Q&A, not design)
3. Team assesses whether it fits within remaining capacity
4. If yes, it's tentatively selected; move to the next story
5. Stop when capacity is reached

**Use velocity as your guide.** If your average velocity is 34 points, don't plan 40 because you're "feeling ambitious." Consistently under-committing and over-delivering builds trust and morale. Consistently over-committing and under-delivering destroys both.

#### The Commitment

At the end of Part 1, the team should be able to say: "We are confident we can deliver these stories and achieve this sprint goal." If that confidence isn't there, remove stories until it is.

### Part 2: The How (60-90 minutes)

#### Task Breakdown

For each selected story, the team identifies the technical tasks needed:

- Frontend changes
- Backend/API work
- Database migrations
- Tests (unit, integration, e2e)
- Documentation updates
- Deployment considerations

Keep tasks small — ideally completable in less than a day. This makes progress visible during the sprint and surfaces blockers early in [daily standups](/daily-standup).

#### Identify Risks and Dependencies

For each story, ask:
- Does this depend on another story being done first?
- Does this require input from someone outside the team?
- Is there a technical spike needed before we can build this?
- Are there any environment or infrastructure prerequisites?

Surface these now, not on day 3 of the sprint.

#### Define "Done" Explicitly

Each story should have clear acceptance criteria, but also confirm the team's shared Definition of Done:
- Code reviewed and approved
- Tests written and passing
- Deployed to staging
- Product Owner acceptance
- Documentation updated (if applicable)

## Sprint Planning Anti-Patterns

### Over-Committing

The team plans 50 points when their velocity is 35. Causes: pressure from stakeholders, optimism bias, desire to please. The fix is simple — trust your velocity data.

### Under-Preparing

Stories aren't refined, estimates are missing, acceptance criteria are vague. Sprint planning turns into a grooming session. The fix: schedule a separate backlog refinement session mid-sprint.

### No Sprint Goal

Without a goal, the sprint is just a random collection of stories. When trade-offs are needed mid-sprint (and they always are), there's no compass for decision-making.

### Too Detailed Planning

Spending 30 minutes designing the database schema for one story during sprint planning. Save implementation details for when you actually start the work. Sprint planning is about *what* and *roughly how*, not detailed design.

### Ignoring Yesterday's Weather

"Yesterday's weather" means your recent velocity is the best predictor of future performance. Teams that ignore this and plan based on wishful thinking consistently fail to meet their commitments.

### Sprint Planning Without the Whole Team

If the people doing the work aren't in the room, the plan won't reflect reality. Everyone on the development team should participate — not just the tech lead.

## Remote Sprint Planning Tips

Remote sprint planning works well with the right tools and structure:

- **Share the backlog on screen** — everyone should see the same view
- **Use [Planning Poker](/planning-poker) for estimation** — if any stories need re-estimation during planning
- **Time-box aggressively** — remote meetings fatigue faster, so keep it tight
- **Record the sprint goal and selected stories** — post them where the whole team can see (Slack, wiki, etc.)
- **Take a break** — for longer sessions, a 5-10 minute break between Part 1 and Part 2 keeps energy up

## After Sprint Planning

### Make the Plan Visible

Post the sprint goal, selected stories, and capacity somewhere visible to the whole team and stakeholders. Transparency prevents scope creep and misaligned expectations.

### Start the Sprint Board

Move selected stories to the sprint board. During [daily standups](/daily-standup), the board becomes the focal point for tracking progress.

### Track Progress Against Velocity

As the sprint progresses, compare completed points against your historical velocity trend. A [velocity tracker](/velocity) helps you spot patterns — are you consistently completing less than planned? More? The data drives better planning next sprint.

## A Sprint Planning Checklist

**Before:**
- [ ] Backlog is refined and prioritized
- [ ] Top stories have estimates (via [Planning Poker](/planning-poker))
- [ ] Team capacity is calculated
- [ ] Product Owner has a draft sprint goal

**During:**
- [ ] Sprint goal is agreed upon
- [ ] Stories are selected based on velocity, not ambition
- [ ] Tasks are broken down for each story
- [ ] Dependencies and risks are identified
- [ ] Team is confident in the commitment

**After:**
- [ ] Sprint goal is posted visibly
- [ ] Sprint board is set up
- [ ] Carry-over from last sprint is addressed
- [ ] Everyone knows their first task

Sprint planning is the foundation of a successful sprint. Invest the preparation time, trust your velocity data, and keep the focus on the sprint goal — not just the stories.
