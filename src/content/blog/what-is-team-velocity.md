---
title: "What Is Team Velocity in Agile? A Practical Guide"
description: "Understand team velocity in agile: what it measures, how to calculate it, and how to use it for better sprint planning without falling into common traps."
date: "2026-03-10"
slug: "what-is-team-velocity"
keywords: "team velocity, agile velocity, sprint velocity, story points, sprint planning, agile metrics, velocity chart"
relatedTool: "/velocity"
tags: ["velocity", "metrics", "sprint"]
---

# What Is Team Velocity in Agile? A Practical Guide

Team velocity is one of the most useful — and most misused — metrics in agile. When used correctly, it transforms sprint planning from guesswork into data-driven forecasting. When misused, it destroys trust and motivation.

Here's everything you need to know to use velocity well.

## What Velocity Measures

Velocity is the amount of work a team completes in a sprint, measured in story points (or whatever unit you use for estimation). If your team completed stories worth 3, 5, 8, and 5 points in the last sprint, your velocity was 21.

That's it. It's simple by design.

The power comes from tracking velocity over time. After 5-6 sprints, your average velocity becomes a reliable predictor of how much work you can take on in future sprints.

## How to Calculate Velocity

### The Basic Formula

**Velocity = sum of story points for all completed stories in the sprint**

Key rules:
- **Only count completed stories** — a story that's 90% done counts as zero. This incentivizes finishing work rather than starting it
- **Use the original estimate** — don't adjust points after the fact. If you estimated 5 but it turned out to be harder, it's still 5 points of velocity
- **Track per sprint** — velocity is a per-sprint metric, not per-day or per-person

### Rolling Average

Your sprint-to-sprint velocity will fluctuate. What matters is the trend. Use a rolling average of the last 3-5 sprints for planning:

- **3-sprint average**: More responsive to recent changes (team size, technology shifts)
- **5-sprint average**: More stable, better for longer-term forecasting

A [velocity tracker](/velocity) visualizes these trends automatically, making it easy to spot patterns and plan accordingly.

## Using Velocity for Sprint Planning

This is where velocity pays off. During sprint planning:

1. Look at your average velocity (say, 34 points over the last 4 sprints)
2. Pull stories from the top of the backlog until you reach that number
3. Adjust slightly based on known factors (holidays, team members out, technical debt)

**Don't overfill.** If your average velocity is 34, planning 40 points because "we'll push harder this sprint" doesn't work. Velocity already accounts for meetings, code reviews, bugs, and all the other things that fill a sprint.

## What Velocity Is NOT

Understanding what velocity doesn't measure is just as important.

### Not a Performance Metric

Velocity measures throughput, not productivity or quality. A team with a velocity of 40 is not "better" than a team with 20 — they might use different estimation scales, have different team sizes, or work on different types of problems.

**Never compare velocity between teams.** This is the cardinal sin of agile metrics. Story points are team-specific and relative. Comparing across teams is like comparing temperatures in Celsius and Fahrenheit.

### Not a Target

The moment velocity becomes a target, teams inflate estimates to hit the number. A 3-point story becomes a 5. Velocity goes "up" but actual output stays flat. This is Goodhart's Law in action: when a measure becomes a target, it ceases to be a good measure.

### Not a Measure of Individual Performance

Velocity is a team metric. Breaking it down by individual defeats its purpose and creates perverse incentives (hoarding easy stories, avoiding collaboration).

## Common Velocity Anti-Patterns

### The Velocity Roller Coaster

Sprint velocities of 40, 15, 45, 20 indicate a problem — likely too much work in progress, dependencies blocking work, or stories that aren't properly refined before entering the sprint.

**Fix**: Limit work in progress, improve backlog refinement, and break large stories into smaller ones.

### The Plateau

Velocity stays flat for months despite the team's desire to improve. This often means:

- Stories are getting harder but estimates haven't recalibrated
- Technical debt is slowing the team down
- Process improvements from [retrospectives](/retro) aren't being implemented

**Fix**: Recalibrate estimates, dedicate capacity to tech debt, and follow through on retro action items.

### Velocity Inflation

Velocity keeps rising, but stakeholders don't feel like more is getting delivered. Teams are either inflating estimates or breaking work into unnecessarily small pieces.

**Fix**: Anchor estimates to reference stories. If a login form was a 3 six months ago, a similar form should still be a 3.

### Counting Incomplete Work

Some teams count partially completed stories or adjust points for "how much is done." This defeats the purpose of velocity. Binary done/not-done forces teams to deliver shippable increments.

## Factors That Affect Velocity

Velocity naturally changes when:

- **Team composition changes** — adding or losing a member takes 2-3 sprints to stabilize
- **Technology shifts** — adopting a new framework means a temporary dip
- **Technical debt** — accumulated shortcuts slow future work
- **Season/holidays** — fewer working days = lower velocity (this is expected, not a problem)

Don't panic when velocity drops temporarily. Look at the 5-sprint trend line instead.

## Getting Started with Velocity Tracking

1. **Estimate consistently** — use [Planning Poker](/planning-poker) to align your team on what a "3" means
2. **Track completed work** — record story points delivered each sprint
3. **Visualize the trend** — a [velocity chart](/velocity) shows your average and helps you plan
4. **Use it for planning** — commit to your average velocity, not your best sprint
5. **Review in retrospectives** — discuss velocity trends in your [retros](/retro) to understand what's driving changes

Start tracking your team's velocity today with our free [Team Velocity Tracker](/velocity) — it calculates rolling averages, visualizes trends, and helps you plan sprints with confidence.
