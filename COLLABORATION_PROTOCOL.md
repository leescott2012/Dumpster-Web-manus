# Dumpster: Collaborative Intelligence Protocol

This document defines the operating framework for the "Jarvis-style" intelligence network powering the Dumpster ecosystem.

## 1. The Triad Architecture

| Persona | Role | Primary Tools |
| :--- | :--- | :--- |
| **The Visionary (User)** | Strategy, final approval, and brand voice. | iMessage, Slack, Dashboard |
| **Manus (The Hub/Doer)** | Execution, infrastructure management, and tool orchestration. | Vercel, Stripe, Supabase, Upstash, Sentry |
| **Claude (The Second Brain)** | Deep reasoning, architectural review, and creative brainstorming. | Anthropic API (Claude 3.5 Sonnet) |
| **AI Consultant Agent** | Proactive business insights, cost optimization, and growth strategy. | Analytics Data + Strategic Logic |

## 2. Interaction Flow

1.  **Task Initiation:** The Visionary provides a goal.
2.  **Strategic Consultation:** Manus consults Claude for the best architectural approach or complex logic.
3.  **Execution:** Manus performs the work (coding, config, deployment).
4.  **Analysis:** The AI Consultant reviews the outcome against business metrics.
5.  **Reporting:** Results are presented to the Visionary via the Admin Dashboard.

## 3. The "Consultant" Logic
The AI Consultant Agent is not just a chatbot; it is a **monitoring layer** that sits on top of your data. It will proactively flag:
*   **Burn Rate Alerts:** "Sir, AI costs are 20% higher today due to a spike in guest users."
*   **Growth Opportunities:** "We are seeing high engagement on 'Vintage' style captions. Suggest making this a Pro-only feature."
*   **Technical Health:** "Sentry reports 3 users hit a bug in the photo pool. I have prepared a fix for your review."

## 4. Claude Integration (The Bridge)
Manus will use the `ANTHROPIC_API_KEY` to call Claude for:
*   Refining the "Taste Profile" algorithm.
*   Auditing complex Swift/SwiftUI code.
*   Generating high-converting marketing copy based on real user behavior.

---
*Status: Active | Version: 1.0*
