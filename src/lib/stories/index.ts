// Public surface of the story feature. Importing this from a client
// component is intentionally NOT allowed — see `getCoinStory`'s "server-only"
// directive in the orchestrator.

export * from "./types";
export { getCoinStory, type GetStoryInput, type StoryResult } from "./orchestrator";