/**
 * Downloads the Theographic Bible Metadata JSON files at a pinned commit
 * into vendor/theographic/ (gitignored). Run via `pnpm vendor`.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const THEOGRAPHIC_COMMIT = "cfb1c485d4da6fb63a69cb3b7f5b0752792f46bc";

const FILES = ["people.json", "verses.json", "peopleGroups.json", "books.json"] as const;

const here = dirname(fileURLToPath(import.meta.url));
export const VENDOR_DIR = join(here, "..", "vendor", "theographic");

async function main(): Promise<void> {
  mkdirSync(VENDOR_DIR, { recursive: true });
  for (const file of FILES) {
    const dest = join(VENDOR_DIR, file);
    if (existsSync(dest)) {
      console.log(`✓ ${file} already vendored`);
      continue;
    }
    const url = `https://raw.githubusercontent.com/robertrouse/theographic-bible-metadata/${THEOGRAPHIC_COMMIT}/json/${file}`;
    console.log(`↓ fetching ${file} …`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    const body = Buffer.from(await res.arrayBuffer());
    JSON.parse(body.toString("utf8")); // fail fast on truncated downloads
    writeFileSync(dest, body);
    const sha = createHash("sha256").update(body).digest("hex").slice(0, 16);
    console.log(`✓ ${file} (${(body.length / 1024 / 1024).toFixed(1)}MB, sha256:${sha}…)`);
  }
  console.log(`Vendored at commit ${THEOGRAPHIC_COMMIT}`);
}

export function readVendored(file: (typeof FILES)[number]): unknown {
  const path = join(VENDOR_DIR, file);
  if (!existsSync(path)) {
    throw new Error(`${file} not vendored — run \`pnpm vendor\` first`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
