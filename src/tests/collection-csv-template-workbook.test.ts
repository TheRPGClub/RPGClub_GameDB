import assert from "node:assert/strict";
import test from "node:test";
import { unzipSync, strFromU8 } from "fflate";
import {
  buildCollectionCsvTemplateAttachment,
} from "../commands/collection/collection-csv-import.service.js";

async function buildWorkbookEntries(): Promise<Record<string, string>> {
  const attachment = await buildCollectionCsvTemplateAttachment();
  const buffer = attachment.attachment as Buffer;
  assert.ok(Buffer.isBuffer(buffer), "attachment payload should be a Buffer");
  assert.ok(buffer.length > 0, "workbook should not be empty");
  assert.equal(buffer.subarray(0, 2).toString(), "PK", "workbook should be a zip archive");

  const files = unzipSync(new Uint8Array(buffer));
  const entries: Record<string, string> = {};
  for (const [path, bytes] of Object.entries(files)) {
    if (path.endsWith(".xml")) {
      entries[path] = strFromU8(bytes);
    }
  }
  return entries;
}

test("collection CSV template ships both Template and Guide sheets", async () => {
  const entries = await buildWorkbookEntries();
  const workbook = entries["xl/workbook.xml"];
  assert.ok(workbook, "workbook.xml should be present");
  assert.match(workbook, /name="Template"/);
  assert.match(workbook, /name="Guide"/);
});

test("collection CSV template keeps the expected column headers", async () => {
  const entries = await buildWorkbookEntries();
  const sharedStrings = entries["xl/sharedStrings.xml"];
  assert.ok(sharedStrings, "sharedStrings.xml should be present");
  for (const header of [
    "title",
    "platform",
    "ownership_type",
    "note",
    "gamedb_id",
    "igdb_id",
  ]) {
    assert.ok(sharedStrings.includes(`<t>${header}</t>`), `missing header ${header}`);
  }
});

test("collection CSV template bolds header rows and sets column widths", async () => {
  const entries = await buildWorkbookEntries();
  const styles = entries["xl/styles.xml"];
  assert.ok(styles, "styles.xml should be present");
  assert.match(styles, /<b\/>/, "header font should be bold");

  const templateSheet = entries["xl/worksheets/sheet1.xml"];
  assert.ok(templateSheet, "sheet1.xml should be present");
  assert.match(templateSheet, /<cols>/, "template sheet should declare column widths");
});
