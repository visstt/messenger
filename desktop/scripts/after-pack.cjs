const path = require("path");
const rcedit = require("rcedit");

/**
 * electron-builder skips rcedit when signAndEditExecutable is false (needed on
 * Windows without admin symlinks). Embed our icon into Signal.exe here instead.
 */
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;

  const productName = context.packager.appInfo.productFilename;
  const exePath = path.join(context.appOutDir, `${productName}.exe`);
  const iconPath = path.join(context.packager.projectDir, "assets", "icon.ico");

  await rcedit(exePath, {
    icon: iconPath,
    "version-string": {
      FileDescription: productName,
      ProductName: productName,
      InternalName: productName,
      OriginalFilename: `${productName}.exe`,
    },
  });

  console.log(`Embedded icon into ${exePath}`);
};
