import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";

// Set before the module graph loads: test mode is read once at module load.
process.env.TEST_GUILD_ID = "1547802424301854770";

const { mirrorEphemeralReply } = await import("../functions/EphemeralMirror.js");
const { TEST_LOG_CHANNEL_ID } = await import("../config/channels.js");

import type { AnyRepliable } from "../functions/InteractionUtils.js";

const EPHEMERAL = { flags: MessageFlags.Ephemeral, content: "secret" };

function interactionWithChannel(channel: unknown, seen: string[]): AnyRepliable {
  return {
    commandName: "admin",
    user: { id: "1" },
    channelId: "2",
    client: {
      channels: {
        fetch: (id: string) => {
          seen.push(id);
          return Promise.resolve(channel);
        },
      },
    },
  } as unknown as AnyRepliable;
}

test("mirrorEphemeralReply posts an ephemeral reply to the test-log channel", async () => {
  const sent: string[] = [];
  const seen: string[] = [];
  const channel = { isTextBased: () => true, send: (c: string) => { sent.push(c); } };

  await mirrorEphemeralReply(interactionWithChannel(channel, seen), EPHEMERAL);

  assert.deepEqual(seen, [TEST_LOG_CHANNEL_ID]);
  assert.equal(sent.length, 1);
  assert.ok(sent[0]?.includes("secret"));
  assert.ok(sent[0]?.includes("/admin"));
});

test("mirrorEphemeralReply skips a public reply in test mode", async () => {
  const sent: string[] = [];
  const seen: string[] = [];
  const channel = { isTextBased: () => true, send: (c: string) => { sent.push(c); } };

  await mirrorEphemeralReply(interactionWithChannel(channel, seen), { flags: 0 });

  assert.deepEqual(seen, []);
  assert.equal(sent.length, 0);
});

test("a thrown mirror error never surfaces to the caller", async () => {
  const seen: string[] = [];
  const channel = {
    isTextBased: () => true,
    send: () => {
      throw new Error("mirror exploded");
    },
  };

  await mirrorEphemeralReply(interactionWithChannel(channel, seen), EPHEMERAL);
  assert.deepEqual(seen, [TEST_LOG_CHANNEL_ID]);
});
