import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const traceFile = join(process.cwd(), "node_modules", "nf3", "dist", "_chunks", "trace.mjs");

if (!existsSync(traceFile)) {
  console.warn("[patch-nf3] nf3 trace file not found; skipping patch.");
  process.exit(0);
}

const original = readFileSync(traceFile, "utf8");

if (original.includes('import nft from "@vercel/nft";')) {
  console.log("[patch-nf3] nf3 already patched.");
  process.exit(0);
}

const patched = original.replace(
  'import { nodeFileTrace } from "@vercel/nft";\nimport semver from "semver";',
  'import nft from "@vercel/nft";\nimport semver from "semver";\nconst { nodeFileTrace } = nft;',
);

if (patched === original) {
  console.warn("[patch-nf3] Expected nf3 import was not found; leaving file unchanged.");
  process.exit(0);
}

writeFileSync(traceFile, patched);
console.log("[patch-nf3] Patched nf3 CommonJS import compatibility.");