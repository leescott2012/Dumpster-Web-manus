/**
 * Session Replay, split into its own chunk.
 *
 * Kept out of instrument.ts on purpose: referencing `replayIntegration` from
 * the entry module pins @sentry-internal/replay into the entry bundle, so the
 * integration is registered from here via addIntegration() instead. Same
 * behaviour, just a tick later and off the critical path.
 */
import { addIntegration, replayIntegration } from "@sentry/react";

export function addReplay(): void {
  addIntegration(replayIntegration({ maskAllText: false, blockAllMedia: false }));
}
