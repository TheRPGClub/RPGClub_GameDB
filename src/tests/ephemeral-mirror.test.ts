import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";

import {
  formatMirrorMessage,
  isEphemeralPayload,
  serializeMirrorPayload,
  shouldMirrorFor,
} from "../functions/EphemeralMirror.js";
import type { AnyRepliable } from "../functions/InteractionUtils.js";

const EPHEMERAL = { flags: MessageFlags.Ephemeral, content: "secret" };
const PUBLIC = { flags: 0, content: "public" };

function fakeInteraction(): AnyRepliable {
  return {
    commandName: "admin",
    user: { id: "1" },
    channelId: "2",
  } as unknown as AnyRepliable;
}

test("isEphemeralPayload detects the ephemeral flag", () => {
  assert.equal(isEphemeralPayload(EPHEMERAL), true);
  assert.equal(isEphemeralPayload(PUBLIC), false);
  assert.equal(isEphemeralPayload({ content: "no flags" }), false);
  assert.equal(isEphemeralPayload("plain string"), false);
});

test("isEphemeralPayload sees the flag alongside the components v2 flag", () => {
  const flags = MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
  assert.equal(isEphemeralPayload({ flags }), true);
});

test("shouldMirrorFor fires for an ephemeral payload in test mode", () => {
  assert.equal(shouldMirrorFor(true, EPHEMERAL), true);
});

test("shouldMirrorFor never fires when test mode is off", () => {
  assert.equal(shouldMirrorFor(false, EPHEMERAL), false);
  assert.equal(shouldMirrorFor(false, PUBLIC), false);
});

test("shouldMirrorFor never fires for a public payload in test mode", () => {
  assert.equal(shouldMirrorFor(true, PUBLIC), false);
});

test("serializeMirrorPayload captures content, embed fields and component ids", () => {
  const button = { type: 2, custom_id: "btn:1", label: "Click" };
  const select = { type: 3, custom_id: "sel:1", options: [{ label: "One", value: "1" }] };
  const row = { type: 1, components: [button, select] };
  const payload = serializeMirrorPayload(fakeInteraction(), {
    flags: MessageFlags.Ephemeral,
    content: "body",
    embeds: [{ title: "T", fields: [{ name: "F", value: "V" }] }],
    components: [row],
  });

  assert.equal(payload.source, "/admin");
  assert.equal(payload.user, "1");
  assert.equal(payload.content, "body");
  assert.deepEqual(payload.embeds, [{ title: "T", fields: [{ name: "F", value: "V" }] }]);
  const serializedRow = payload.components?.[0];
  assert.equal(serializedRow?.components?.[0]?.customId, "btn:1");
  assert.equal(serializedRow?.components?.[0]?.label, "Click");
  assert.deepEqual(serializedRow?.components?.[1]?.options, [{ label: "One", value: "1" }]);
});

test("serializeMirrorPayload unwraps builders via toJSON", () => {
  const builder = { toJSON: () => ({ type: 2, custom_id: "built:1", label: "Built" }) };
  const payload = serializeMirrorPayload(fakeInteraction(), {
    flags: MessageFlags.Ephemeral,
    components: [builder],
  });
  assert.equal(payload.components?.[0]?.customId, "built:1");
});

test("formatMirrorMessage stays within Discord's message limit", () => {
  const payload = serializeMirrorPayload(fakeInteraction(), {
    flags: MessageFlags.Ephemeral,
    content: "x".repeat(5000),
  });
  const message = formatMirrorMessage(payload);
  assert.ok(message.length <= 2000, `message was ${message.length} chars`);
  assert.ok(message.startsWith("```json\n"));
  assert.ok(message.endsWith("\n```"));
});

test("mirrorEphemeralReply does not touch the client when test mode is off", async () => {
  const { mirrorEphemeralReply } = await import("../functions/EphemeralMirror.js");
  let fetched = false;
  const interaction = {
    commandName: "admin",
    user: { id: "1" },
    channelId: "2",
    client: {
      channels: {
        fetch: () => {
          fetched = true;
          return Promise.resolve(null);
        },
      },
    },
  } as unknown as AnyRepliable;

  await mirrorEphemeralReply(interaction, EPHEMERAL);
  assert.equal(fetched, false);
});
