# Dumpster — Project Brain Dump for AI Handover

## Core Identity
Dumpster is a premium, native-feel web application (and SwiftUI iOS app) designed for creating high-quality Instagram carousel "photo dumps." It focuses on aesthetic flow, smart clustering, and natural-sounding AI captions.

## Tech Stack
- **Frontend**: React + Vite + TypeScript + Tailwind CSS.
- **Backend**: Supabase (Auth, Database, Storage).
- **Deployment**: Vercel (Frontend + Serverless Functions).
- **Payments**: Stripe (Payment Links for Pro subscriptions).
- **AI**: Integration with LLMs for caption generation and photo clustering suggestions.

## Key Features & Logic

### 1. State Management & Persistence
- **Local Persistence**: Uses `localStorage` to save the state of dumps and the photo pool.
- **Persistence Logic**: Implemented in `useCarouselState.ts`. It ensures that even empty states (e.g., all photos deleted) are preserved across refreshes.
- **Owner vs. Guest**: 
  - **Owner Mode**: Activated via `?owner=1` URL parameter. Uses a dedicated storage key (`dumpster_state_dumps_owner`).
  - **Guest Mode**: Default mode. Uses `dumpster_state_dumps_guest`.
  - **Clean Slate for Logged-in Users**: New users who sign in (but are not the owner) start with a clean slate: one empty dump and an empty photo pool. Guests (not logged in) see stock demo photos.

### 2. Authentication & Credits
- **Supabase Auth**: Supports Email/Password and OAuth (Google, Apple, Facebook).
- **Credit System**: Users start with 15 free credits. AI actions (captions, suggestions) deduct credits.
- **Subscription**: "Pro" tier managed via Stripe, providing higher daily credit limits.

### 3. UI/UX Philosophy
- **Editorial Aesthetic**: Dark theme, minimalist chrome, high-quality typography (Inter).
- **Interaction**: Gesture-heavy (drag-and-drop, long-press, double-tap for lightbox).
- **Photos as Heroes**: UI elements are thin overlays to keep the focus on the content.

### 4. File Structure Highlights
- `client/src/hooks/useCarouselState.ts`: The "brain" of the app's state and persistence.
- `client/src/lib/photoData.ts`: Defines initial data, owner detection, and stock photo sets.
- `client/src/contexts/AuthContext.tsx`: Manages global auth state and credit logic.
- `client/src/components/MainMenu.tsx`: Contains the "Reset to Original State" feature.
- `api/`: Vercel serverless functions for AI and Stripe integrations.

## Deployment & URLs
- **Live App**: [https://dumpster-web-manus.vercel.app/](https://dumpster-web-manus.vercel.app/)
- **Owner Access**: Append `?owner=1` to the URL.
- **GitHub**: [leescott2012/Dumpster-Web-manus](https://github.com/leescott2012/Dumpster-Web-manus)

## Current Status
- Persistence is fixed and robust.
- Owner/Guest separation is fully implemented.
- Login flow is active with a "clean slate" default for new users.
- Stripe is connected and ready for Payment Link integration.
