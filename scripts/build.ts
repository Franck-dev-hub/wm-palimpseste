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

const roots = {
  content: 'src/content/index.ts',
  background: 'src/background/index.ts',
  options: 'src/options/options.ts',
};

const options: esbuild.BuildOptions = {
  entryPoints: ['firefox', 'chromium'].flatMap((browser) =>
    Object.entries(roots).map(([out, path]) => ({ in: path, out: `${browser}/${out}` })),
  ),
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
