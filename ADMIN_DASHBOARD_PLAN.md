# Dumpster Admin Dashboard: Implementation Plan & Design Specification

This document details the implementation plan and design specification for the "Jarvis-style" Dumpster Admin Dashboard, integrating data from Supabase, Stripe, Upstash, and Sentry, along with proactive insights from the AI Consultant Agent.

## 1. Core Objectives

*   **Centralized Visibility:** Provide a single, comprehensive view of the Dumpster app's health, performance, and revenue.
*   **Actionable Intelligence:** Integrate proactive insights and strategic recommendations from the AI Consultant Agent.
*   **Efficient Monitoring:** Enable quick identification of trends, anomalies, and areas requiring attention.
*   **Strategic Decision Support:** Facilitate data-driven decisions for growth, retention, and cost optimization.

## 2. Key Components & Data Integration

The dashboard will consist of several key sections, each integrating data from specific sources:

| Dashboard Section | Data Source(s) | Key Metrics & Features |
| :--- | :--- | :--- |
| **Revenue & Growth Overview** | Stripe, Supabase | MRR (Monthly Recurring Revenue), total credit pack sales, total revenue, ARPU, new user sign-ups, active user trends (DAU/WAU/MAU). |
| **AI Operational Health** | Supabase, Upstash | Total AI spend, average cost per generated caption, daily budget consumption vs. limit, rate limit activity. |
| **User Activity & Engagement** | Supabase | Top-performing caption styles, most used AI tools, user retention cohorts, referral program performance. |
| **System Stability & Feedback** | Sentry, Supabase | Error rates, most frequent bugs, user-reported issues (from the "Bug" button). |
| **AI Consultant Insights** | AI Consultant Agent | Proactive alerts (e.g., burn rate spikes), growth opportunities (e.g., trending styles), strategic recommendations. |

## 3. UI/UX Design Principles

*   **Minimalist & Premium:** Adhere to the Dumpster app's aesthetic—clean, high-end, and professional.
*   **Information Density with Clarity:** Present complex data in an easy-to-digest format using well-designed charts, tables, and clear metrics.
*   **Action-Oriented:** Highlight critical alerts and recommendations prominently to facilitate immediate action.
*   **Intuitive Navigation:** Enable quick switching between different sections and drill-down into specific data points.

## 4. Implementation Phases

1.  **Backend Data Aggregation (Supabase Edge Functions):**
    *   Develop Edge Functions to aggregate data from Supabase tables (`profiles`, `credit_transactions`).
    *   Implement functions to fetch metrics from the Stripe API (revenue, subscriptions).
    *   Integrate with the Upstash Redis API to retrieve real-time budget and rate-limiting data.
    *   Develop a mechanism to fetch error and feedback data from the Sentry API.
2.  **AI Consultant Insight Generation Logic:**
    *   Implement the monitoring and analysis logic within a dedicated service or Edge Function.
    *   Integrate the `consult_claude` function (as defined in the `claude_second_brain.py` demonstration) for deep strategic analysis and recommendation generation.
    *   Develop a system to store and prioritize generated insights.
3.  **Frontend Dashboard Development (React/Next.js):**
    *   Design and build the dashboard UI using a modern React framework, adhering to the specified design principles.
    *   Implement data visualization components (charts, graphs) to represent aggregated metrics.
    *   Develop a dedicated "AI Insights" feed to display proactive recommendations and alerts.
    *   Implement secure authentication and authorization for the admin dashboard (e.g., using Supabase Auth with an `is_admin` check).
4.  **Testing & Refinement:**
    *   Thoroughly test data aggregation and visualization for accuracy.
    *   Validate the AI Consultant's insight generation and prioritization logic.
    *   Refine the UI/UX based on internal testing and feedback.
5.  **Deployment & Monitoring:**
    *   Deploy the admin dashboard and associated backend functions.
    *   Monitor the dashboard's performance and data accuracy in a production environment.

## 5. Future Enhancements

*   **Real-time Alerts:** Implement push notifications or Slack/iMessage alerts for critical AI Consultant recommendations.
*   **Interactive Drill-Down:** Enable more detailed exploration of specific data points (e.g., individual user activity, specific error logs).
*   **Customizable Reporting:** Allow admins to generate custom reports based on specific timeframes and metrics.
*   **A/B Testing Integration:** Integrate A/B testing results directly into the dashboard to track the impact of feature changes.

---
*Status: Planned | Version: 1.0*
