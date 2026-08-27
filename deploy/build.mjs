/* Bootstrap for a file-upload deployment.
 *
 * Vercel is not linked to the repository yet, so a deployment carries only
 * this file, package.json and vercel.json. It fetches the real build from the
 * repository and runs it, which means the site never has to be re-uploaded to
 * pick up a change — a push plus a redeploy is enough.
 *
 * Once the Vercel project is connected to GitHub this file is unnecessary:
 * the checkout already contains the real build.mjs.
 */
import fs from 'fs';

const REPO = process.env.DATA_REPO || 'aaciyoni-bot/BYOUTOYOU';
const REF = process.env.DATA_REF || 'main';

for (const file of ['build.mjs', 'tools/build-map.mjs', 'scripts/build-hospitals.js']) {
    const res = await fetch(`https://raw.githubusercontent.com/${REPO}/${REF}/${file}`);
    if (!res.ok) {
        if (file === 'build.mjs') throw new Error(`Cannot fetch ${file}: HTTP ${res.status}`);
        continue; // the fallbacks are optional
    }
    const dest = file === 'build.mjs' ? 'build.real.mjs' : file;
    fs.mkdirSync(dest.split('/').slice(0, -1).join('/') || '.', { recursive: true });
    fs.writeFileSync(dest, await res.text());
}

console.log(`Bootstrapped the build from ${REPO}@${REF}.`);
await import('./build.real.mjs');
