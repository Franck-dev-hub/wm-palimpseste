import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import * as esbuild from 'esbuild';
import base from '../src/manifest.json' with { type: 'json' };

const watch = process.argv.includes('--watch');

const writeManifests: esbuild.Plugin = {
  name: 'write-manifests',
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length) return;

      const manifests = {
        firefox: {
          ...base,
          minimum_chrome_version: undefined,
          background: { scripts: ['background.js'] },
        },
        chromium: {
          ...base,
          browser_specific_settings: undefined,
          background: { service_worker: 'background.js' },
        },
      };

      for (const [browser, manifest] of Object.entries(manifests)) {
        await mkdir(`dist/${browser}`, { recursive: true });
        await writeFile(`dist/${browser}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
        await cp('src/_locales', `dist/${browser}/_locales`, { recursive: true });
        await cp('src/options/options.html', `dist/${browser}/options.html`);
      }
    });
  },
};

const options: esbuild.BuildOptions = {
  entryPoints: [
    { in: 'src/content/index.ts', out: 'firefox/content' },
    { in: 'src/background/index.ts', out: 'firefox/background' },
    { in: 'src/content/index.ts', out: 'chromium/content' },
    { in: 'src/background/index.ts', out: 'chromium/background' },
    { in: 'src/options/options.ts', out: 'firefox/options' },
    { in: 'src/options/options.ts', out: 'chromium/options' },
    { in: 'src/content/content.css', out: 'firefox/content' },
    { in: 'src/content/content.css', out: 'chromium/content' },
    { in: 'src/options/options.css', out: 'firefox/options' },
    { in: 'src/options/options.css', out: 'chromium/options' },
  ],
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: ['firefox140', 'chrome111'],
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
  plugins: [writeManifests],
};

await rm('dist', { recursive: true, force: true });

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  try {
    await esbuild.build(options);
  } catch {
    process.exit(1);
  }
}
