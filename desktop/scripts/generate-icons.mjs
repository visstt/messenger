import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import toIco from "to-ico";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const svgPath = path.join(root, "..", "frontend", "public", "pwa-512.svg");
const assetsDir = path.join(root, "assets");

await fs.mkdir(assetsDir, { recursive: true });
const svg = await fs.readFile(svgPath);

const appIcoSizes = [16, 24, 32, 48, 64, 128, 256];
const trayIcoSizes = [16, 32];

const appPngBuffers = await Promise.all(
  appIcoSizes.map((size) => sharp(svg).resize(size, size).png().toBuffer())
);
const trayPngBuffers = await Promise.all(
  trayIcoSizes.map((size) => sharp(svg).resize(size, size).png().toBuffer())
);

await sharp(svg).resize(512, 512).png().toFile(path.join(assetsDir, "icon.png"));
await sharp(svg).resize(32, 32).png().toFile(path.join(assetsDir, "tray-32.png"));
await sharp(svg).resize(16, 16).png().toFile(path.join(assetsDir, "tray-16.png"));

const iconIco = await toIco(appPngBuffers);
const trayIco = await toIco(trayPngBuffers);

const publicDir = path.join(root, "..", "frontend", "public");
await fs.mkdir(publicDir, { recursive: true });

await fs.writeFile(path.join(assetsDir, "icon.ico"), iconIco);
await fs.writeFile(path.join(assetsDir, "tray.ico"), trayIco);
await fs.writeFile(path.join(publicDir, "favicon.ico"), iconIco);

console.log(
  "Generated: icon.ico, tray.ico, icon.png, tray-16.png, tray-32.png, frontend/public/favicon.ico"
);
