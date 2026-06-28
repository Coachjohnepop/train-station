import fs from "fs";
import path from "path";
import { writePublicLogoVariants } from "../src/lib/optimize-brand-logo";

const source =
  process.argv[2] || path.join(process.cwd(), "public/images/logo-source.png");

if (!fs.existsSync(source)) {
  console.error(`Source not found: ${source}`);
  process.exit(1);
}

async function main() {
  const buffer = fs.readFileSync(source);
  await writePublicLogoVariants(buffer);
  console.log(`Regenerated public logos from ${source}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});