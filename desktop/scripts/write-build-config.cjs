const fs = require("fs");
const path = require("path");

const serverUrl = (
  process.env.MESSENGER_URL || "https://chat.5-35-88-205.sslip.io"
).replace(/\/$/, "");

const outPath = path.join(__dirname, "..", "electron", "build-config.json");
fs.writeFileSync(outPath, JSON.stringify({ serverUrl }, null, 2) + "\n");
console.log(`build-config.json → ${serverUrl}`);
