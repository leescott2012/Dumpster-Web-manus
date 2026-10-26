/**
 * How-to content for each daily TIP (ids match TIPS in shared/notifications.ts).
 * Screenshot = /tips/<id>.jpg in client/public/tips (hidden if the file is missing).
 * `tryIt` = what the "Try it" button opens (handled in Home.tsx); omit for none.
 */
export interface TipGuide { steps: string[]; tryIt?: "autogen" | "captions" | "igscrub" | "friends" }

export const TIP_GUIDES: Record<string, TipGuide> = {
  autogen: {
    steps: ["Add photos to your pool.", "Tap Auto Gen under your dumps.", "Pick a shape or leave it on Auto, then tap Generate. Not feeling it? Reject it and the credits come back."],
    tryIt: "autogen",
  },
  valet: {
    steps: ["Tap the ⋯ button on a dump.", "Choose Valet.", "Type what you want: “move the car shot first”, “swap the 3rd photo”, “make it moodier”."],
  },
  captions: {
    steps: ["Tap the ⋯ button on a dump.", "Choose Captions.", "Pick a tone and generate. Tap a caption to copy it, heart the ones you love and the AI learns your voice."],
    tryIt: "captions",
  },
  igscrub: {
    steps: ["Open the menu, then AI Tools.", "Choose Instagram Scrub and enter any public account.", "Pull its photos into your pool and save its look as a Dump Style."],
    tryIt: "igscrub",
  },
  recycle: {
    steps: ["Tap a photo in a dump.", "Tap its ⋯ button.", "Choose Recycle. It swaps in a fresh photo from your pool, same spot."],
  },
  export: {
    steps: ["Tap the ⋯ button on a dump.", "Choose Share / Export.", "Download the slides in order, ready to post."],
  },
  video: {
    steps: ["Open the Videos tab in your pool.", "Add videos from your phone. They stay on your device and never upload.", "Mix them into a dump, or let Auto Gen add some."],
  },
  friends: {
    steps: ["Open the menu, then Friends.", "Search a username and send a request.", "Once they accept you can see their public dumps, comment and message."],
    tryIt: "friends",
  },
};
