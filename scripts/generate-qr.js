#!/usr/bin/env node
/**
 * Generates the three static QR codes — one per passport grid page.
 *
 * They encode only the page, never a challenge or a team, so every passport
 * gets the identical three codes and they never need regenerating: the
 * challenge list can change right up to hunt morning without reprinting.
 *
 *   SITE_URL=https://lostonthebeltline.com npm run qr
 */
const fs = require('node:fs');
const path = require('node:path');
const QRCode = require('qrcode');

const PAGES = ['ab', 'cd', 'bonus'];
const siteUrl = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
const outDir = path.join(__dirname, '..', 'public', 'qr');

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  for (const page of PAGES) {
    const url = `${siteUrl}/submit?page=${page}`;

    // PNG for the web, SVG for the printer — the passport is printed at size
    // and a raster code at 4x5 inches looks like a raster code.
    await QRCode.toFile(path.join(outDir, `passport-${page}.png`), url, {
      width: 1200,
      margin: 2,
      errorCorrectionLevel: 'H',
    });
    await QRCode.toFile(path.join(outDir, `passport-${page}.svg`), url, {
      type: 'svg',
      margin: 2,
      errorCorrectionLevel: 'H',
    });

    console.log(`passport-${page}  ->  ${url}`);
  }

  console.log(`\nWrote 6 files to ${outDir}`);
  console.log('Scan each one with a real phone before sending the passport to print.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
