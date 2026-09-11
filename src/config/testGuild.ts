/**
 * Snowflakes for the private test guild, keyed by the production constant name.
 *
 * Every name in {@link OVERRIDABLE_ID_NAMES} must have an entry here before the
 * bot will boot with `TEST_GUILD_ID` set. Leave this map empty for production
 * runs; it is never read unless test mode is active.
 */

/**
 * Every production ID that the override layer can substitute.
 *
 * Adding a snowflake constant to `channels.ts`, `roles.ts`, `users.ts`, or
 * `tags.ts` requires adding its name here, or `resolveId` will not type-check.
 */
export const OVERRIDABLE_ID_NAMES = [
  // channels.ts
  "BOT_DEV_CHANNEL_ID",
  "COMPLETION_REACTION_DEV_CHANNEL_ID",
  "GAMEDB_UPDATES_CHANNEL_ID",
  "GAME_NEWS_CHANNEL_ID",
  "GAME_DEALS_CHANNEL_ID",
  "DISCORD_LOG_CHANNEL_ID",
  "DISCORD_CONSOLE_LOG_CHANNEL_ID",
  "GIVEAWAY_HUB_CHANNEL_ID",
  "NOW_PLAYING_FORUM_ID",
  "LIVE_EVENT_FORUM_ID",
  "JOIN_LEAVE_LOG_CHANNEL_ID",
  "ADMIN_CHANNEL_ID",
  "QUOTABLES_CHANNEL_ID",
  "PRESENCE_PROMPT_CHANNEL_ID",
  "ANNOUNCEMENT_CHANNEL_ID",
  "WHATCHA_PLAYING_CHANNEL_ID",
  "GOTM_NOMINATION_CHANNEL_ID",
  "NR_GOTM_NOMINATION_CHANNEL_ID",
  "NEW_GAME_ANNOUNCEMENT_CHANNEL_ID",
  // roles.ts
  "REGULARS_ROLE_ID",
  "NEWCOMERS_ROLE_ID",
  "ADMIN_ROLE_ID",
  "MODERATOR_ROLE_ID",
  "MEMBER_ROLE_ID",
  "DEV_ROLE_ID",
  // users.ts
  "BOT_DEV_PING_USER_ID",
  "LINK_RELAY_BOT_USER_ID",
  // tags.ts
  "NOW_PLAYING_SIDEGAME_TAG_ID",
  "GOTM_FORUM_TAG_ID",
  "NR_GOTM_FORUM_TAG_ID",
] as const;

export type OverridableIdName = (typeof OVERRIDABLE_ID_NAMES)[number];

export type TestGuildIdMap = Partial<Record<OverridableIdName, string>>;

/** Fill this in with the snowflakes from your own test guild. */
export const TEST_GUILD_IDS: TestGuildIdMap = {
  // User IDs are global rather than guild-scoped, so the test guild reuses them.
  BOT_DEV_PING_USER_ID: "191938640413327360",
  LINK_RELAY_BOT_USER_ID: "1154429583031025705",
};
