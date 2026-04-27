// Post-build for GitHub Pages:
// 1) Touch .nojekyll so Pages doesn't try to ignore _next/.
// 2) Copy index.html → 404.html so deep refreshes still hit the SPA shell.
//    (HashRouter doesn't strictly need this, but it costs us nothing.)
import { copyFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";

const out = join(process.cwd(), "out");

async function main() {
  await writeFile(join(out, ".nojekyll"), "");
  try {
    await access(join(out, "index.html"));
    await copyFile(join(out, "index.html"), join(out, "404.html"));
  } catch {
    console.warn("No out/index.html to copy — skipping 404.html.");
  }
  console.log("postbuild: .nojekyll + 404.html ready");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
