/**
 * Cloud sync — AI profile (captions, taste, rules) only.
 *
 * Photos and workspace (dumps + pool) are device-local by design for beta.
 * See aiProfileSync.ts for the active sync logic.
 */

// Re-export aiProfileSync surface so existing import paths still compile.
export { syncAIProfileOnSignIn, saveCloudAIProfile, scheduleAIProfileSave } from "./aiProfileSync";
