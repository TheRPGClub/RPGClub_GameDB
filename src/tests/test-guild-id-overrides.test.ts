import test from "node:test";
import assert from "node:assert/strict";

import { ADMIN_CHANNEL_ID, GIVEAWAY_LOG_CHANNEL_ID } from "../config/channels.js";
import { ADMIN_ROLE_ID } from "../config/roles.js";
import { GOTM_FORUM_TAG_ID } from "../config/tags.js";
import { BOT_DEV_PING_USER_ID } from "../config/users.js";
import {
  OVERRIDABLE_ID_NAMES,
  type TestGuildIdMap,
} from "../config/testGuild.js";
import { findMissingOverrides, resolveIdFor } from "../config/testMode.js";

const PRODUCTION_ADMIN_SNOWFLAKE = "428142514222923776";
const TEST_GUILD_ADMIN_SNOWFLAKE = "111111111111111111";

const FULL_MAP: TestGuildIdMap = Object.fromEntries(
  OVERRIDABLE_ID_NAMES.map((name, index) => [name, `2000000000000000${index}`]),
);

test("resolveIdFor returns the production ID when test mode is off", () => {
  const overrides: TestGuildIdMap = { ADMIN_CHANNEL_ID: TEST_GUILD_ADMIN_SNOWFLAKE };
  assert.equal(
    resolveIdFor(false, overrides, "ADMIN_CHANNEL_ID", PRODUCTION_ADMIN_SNOWFLAKE),
    PRODUCTION_ADMIN_SNOWFLAKE,
  );
});

test("resolveIdFor returns the test guild ID when test mode is on", () => {
  const overrides: TestGuildIdMap = { ADMIN_CHANNEL_ID: TEST_GUILD_ADMIN_SNOWFLAKE };
  assert.equal(
    resolveIdFor(true, overrides, "ADMIN_CHANNEL_ID", PRODUCTION_ADMIN_SNOWFLAKE),
    TEST_GUILD_ADMIN_SNOWFLAKE,
  );
});

test("resolveIdFor resolves to nothing when test mode lacks an override", () => {
  assert.equal(resolveIdFor(true, {}, "ADMIN_CHANNEL_ID", PRODUCTION_ADMIN_SNOWFLAKE), "");
});

test("findMissingOverrides names every unmapped ID", () => {
  assert.deepEqual(findMissingOverrides({}), [...OVERRIDABLE_ID_NAMES]);
  assert.deepEqual(findMissingOverrides(FULL_MAP), []);
  assert.deepEqual(findMissingOverrides({ ADMIN_CHANNEL_ID: " " }), [
    ...OVERRIDABLE_ID_NAMES,
  ]);
});

test("config modules expose production IDs when TEST_GUILD_ID is unset", () => {
  assert.equal(process.env.TEST_GUILD_ID ?? "", "");
  assert.equal(ADMIN_CHANNEL_ID, PRODUCTION_ADMIN_SNOWFLAKE);
  assert.equal(ADMIN_ROLE_ID, "461891227613265940");
  assert.equal(GOTM_FORUM_TAG_ID, "1059913568545415330");
  assert.equal(BOT_DEV_PING_USER_ID, "191938640413327360");
});

test("aliased channel constants still track the ID they alias", () => {
  assert.equal(GIVEAWAY_LOG_CHANNEL_ID, "1439333324547035428");
});
