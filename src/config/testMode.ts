import {
  OVERRIDABLE_ID_NAMES,
  TEST_GUILD_IDS,
  type OverridableIdName,
  type TestGuildIdMap,
} from "./testGuild.js";

/**
 * Presence of `TEST_GUILD_ID` means test mode; its value names the guild.
 *
 * Read once at module load so every consumer sees the same answer, and so a
 * single flag cannot disagree with a second one.
 */
export const TEST_GUILD_ID: string = (process.env.TEST_GUILD_ID ?? "").trim();

export const IS_TEST_MODE: boolean = TEST_GUILD_ID.length > 0;

/**
 * Pure form of the substitution, taking the mode and override map explicitly so
 * both branches can be exercised without reloading the module graph.
 */
export function resolveIdFor(
  testMode: boolean,
  overrides: TestGuildIdMap,
  name: OverridableIdName,
  productionId: string,
): string {
  if (!testMode) return productionId;
  return overrides[name] ?? "";
}

/** Substitutes the test guild's snowflake for a production ID in test mode. */
export function resolveId(name: OverridableIdName, productionId: string): string {
  return resolveIdFor(IS_TEST_MODE, TEST_GUILD_IDS, name, productionId);
}

/** Names that test mode cannot resolve because the map has no entry for them. */
export function findMissingOverrides(overrides: TestGuildIdMap): OverridableIdName[] {
  return OVERRIDABLE_ID_NAMES.filter((name) => !(overrides[name] ?? "").trim());
}

/**
 * Refuses to boot in test mode while any ID would still resolve to nothing,
 * rather than letting a partial map fail later at an opaque Discord call.
 */
export function assertTestGuildIdsComplete(): void {
  if (!IS_TEST_MODE) return;
  const missing = findMissingOverrides(TEST_GUILD_IDS);
  if (missing.length === 0) return;
  throw new Error(
    `TEST_GUILD_ID is set but src/config/testGuild.ts is missing ` +
      `${missing.length} override(s): ${missing.join(", ")}`,
  );
}
