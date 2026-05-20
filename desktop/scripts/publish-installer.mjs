import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const releaseDir = path.join(__dirname, "..", "release");
const targetDir = path.join(__dirname, "..", "..", "frontend", "public", "downloads");
const targetFile = path.join(targetDir, "Signal-Desktop-Setup.exe");

const entries = await fs.readdir(releaseDir);
const installer = entries.find(
  (name) => name.endsWith(".exe") && name.toLowerCase().includes("setup")
);

if (!installer) {
  console.error("Installer not found. Run: npm run dist");
  process.exit(1);
}

await fs.mkdir(targetDir, { recursive: true });
await fs.copyFile(path.join(releaseDir, installer), targetFile);
console.log(`Copied to ${targetFile}`);
