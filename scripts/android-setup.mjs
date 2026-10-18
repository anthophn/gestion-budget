// Prépare le projet Android généré par Capacitor : icône Kakeibo, écran de démarrage, numéro de version.
// Utilisé par le workflow GitHub « Publier les applications » après `npx cap add android`.
// Usage : node scripts/android-setup.mjs <version> <code>   (ex. 1.2.0 7)
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [version = '1.0.0', code = '1'] = process.argv.slice(2);
const res = join('android', 'app', 'src', 'main', 'res');
if (!existsSync(res)) throw new Error('Dossier android introuvable : lance d’abord « npx cap add android ».');

// 1. Icônes : nos PNG remplacent l'icône Capacitor, et on retire l'icône adaptative par défaut.
for (const dir of readdirSync('assets/android')) {
  cpSync(join('assets/android', dir), join(res, dir), { recursive: true });
}
rmSync(join(res, 'mipmap-anydpi-v26'), { recursive: true, force: true });
for (const dir of readdirSync(res)) {
  if (dir.startsWith('mipmap')) rmSync(join(res, dir, 'ic_launcher_foreground.png'), { force: true });
}

// 2. Écran de démarrage : fond papier + icône centrée (au lieu du logo Capacitor).
for (const dir of readdirSync(res)) {
  if (dir.startsWith('drawable')) rmSync(join(res, dir, 'splash.png'), { force: true });
}
mkdirSync(join(res, 'drawable'), { recursive: true });
writeFileSync(
  join(res, 'drawable', 'splash.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item><shape><solid android:color="#F6F3EC" /></shape></item>
    <item android:gravity="center" android:width="112dp" android:height="112dp" android:drawable="@mipmap/ic_launcher" />
</layer-list>
`,
);

// 3. Numéro de version affiché par Android.
const gradle = join('android', 'app', 'build.gradle');
writeFileSync(
  gradle,
  readFileSync(gradle, 'utf8')
    .replace(/versionCode \d+/, `versionCode ${Number(code) || 1}`)
    .replace(/versionName "[^"]*"/, `versionName "${version}"`),
);
console.log(`Projet Android prêt (version ${version}, code ${code}).`);
