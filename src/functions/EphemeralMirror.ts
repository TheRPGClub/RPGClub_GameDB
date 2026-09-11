import { MessageFlags, MessageFlagsBitField } from "discord.js";
import { IS_TEST_MODE } from "../config/testMode.js";
import { TEST_LOG_CHANNEL_ID } from "../config/channels.js";
import { logError } from "../utilities/LogUtils.js";
import type { AnyRepliable } from "./InteractionUtils.js";

/** Discord's hard cap on a message's content length. */
const MIRROR_MESSAGE_LIMIT = 2000;

type MirrorComponent = {
  type?: number;
  customId?: string;
  label?: string;
  placeholder?: string;
  content?: string;
  options?: { label?: string; value?: string }[];
  components?: MirrorComponent[];
};

type MirrorPayload = {
  source: string;
  user: string | null;
  channelId: string | null;
  content?: string;
  embeds?: unknown[];
  components?: MirrorComponent[];
};

/** Unwraps discord.js builders so both builder and raw payloads serialize alike. */
function toPlain(value: unknown): any {
  if (value === null || value === undefined) return value;
  const candidate = value as { toJSON?: () => unknown };
  if (typeof candidate.toJSON === "function") {
    try {
      return candidate.toJSON();
    } catch {
      return value;
    }
  }
  return value;
}

/** True when the payload's flags carry the ephemeral bit. */
export function isEphemeralPayload(options: unknown): boolean {
  if (!options || typeof options !== "object") return false;
  const flags = (options as { flags?: unknown }).flags;
  if (flags === undefined || flags === null) return false;
  try {
    return new MessageFlagsBitField(flags as never).has(MessageFlags.Ephemeral);
  } catch {
    return false;
  }
}

/**
 * Pure gate, taking the mode explicitly so both branches can be exercised
 * without reloading the module graph.
 */
export function shouldMirrorFor(testMode: boolean, options: unknown): boolean {
  return testMode && isEphemeralPayload(options);
}

function serializeComponent(raw: unknown): MirrorComponent {
  const node = toPlain(raw) ?? {};
  const entry: MirrorComponent = {};
  if (typeof node.type === "number") entry.type = node.type;
  if (typeof node.custom_id === "string") entry.customId = node.custom_id;
  if (typeof node.label === "string") entry.label = node.label;
  if (typeof node.placeholder === "string") entry.placeholder = node.placeholder;
  if (typeof node.content === "string") entry.content = node.content;
  if (Array.isArray(node.options)) {
    entry.options = node.options.map((option: unknown) => {
      const plain = toPlain(option) ?? {};
      return { label: plain.label, value: plain.value };
    });
  }
  if (Array.isArray(node.components)) {
    entry.components = node.components.map(serializeComponent);
  }
  if (node.accessory) {
    entry.components = [
      ...(entry.components ?? []),
      serializeComponent(node.accessory),
    ];
  }
  return entry;
}

/** Names the interaction well enough to match a mirrored reply back to a command. */
export function describeInteraction(interaction: AnyRepliable): string {
  const withCommand = interaction as { commandName?: string; customId?: string };
  if (withCommand.commandName) return `/${withCommand.commandName}`;
  if (withCommand.customId) return `component:${withCommand.customId}`;
  return "interaction";
}

/** Flattens an outgoing reply into the fields a reader needs to verify it. */
export function serializeMirrorPayload(
  interaction: AnyRepliable,
  options: unknown,
): MirrorPayload {
  const payload: MirrorPayload = {
    source: describeInteraction(interaction),
    user: interaction.user?.id ?? null,
    channelId: interaction.channelId ?? null,
  };

  if (typeof options === "string") {
    payload.content = options;
    return payload;
  }
  if (!options || typeof options !== "object") return payload;

  const record = options as Record<string, unknown>;
  if (typeof record.content === "string") payload.content = record.content;
  if (Array.isArray(record.embeds)) payload.embeds = record.embeds.map(toPlain);
  if (Array.isArray(record.components)) {
    payload.components = record.components.map(serializeComponent);
  }
  return payload;
}

/** Renders the mirrored payload as a fenced JSON block within Discord's limit. */
export function formatMirrorMessage(payload: MirrorPayload): string {
  const body = JSON.stringify(payload, null, 2);
  const fenceOverhead = "```json\n\n```".length;
  const room = MIRROR_MESSAGE_LIMIT - fenceOverhead;
  const truncated = body.length > room ? `${body.slice(0, room - 3)}...` : body;
  return `\`\`\`json\n${truncated}\n\`\`\``;
}

/**
 * Best-effort copy of an ephemeral reply to the test-log channel. Runs only in
 * test mode, and swallows its own failures so the real reply is never affected.
 */
export async function mirrorEphemeralReply(
  interaction: AnyRepliable,
  options: unknown,
): Promise<void> {
  if (!shouldMirrorFor(IS_TEST_MODE, options)) return;

  try {
    const channel = await interaction.client.channels.fetch(TEST_LOG_CHANNEL_ID);
    if (!channel || !channel.isTextBased()) return;
    const sendable = channel as { send?: (content: string) => Promise<unknown> };
    if (typeof sendable.send !== "function") return;
    await sendable.send(formatMirrorMessage(serializeMirrorPayload(interaction, options)));
  } catch (err: unknown) {
    logError("EphemeralMirror.mirrorEphemeralReply", {
      message: (err as { message?: string })?.message,
    });
  }
}
