# Contributing

**English** | [Français](CONTRIBUTING.fr.md)

## Requirements

- [Node.js](https://nodejs.org) 24 (`.nvmrc`).
- [pnpm](https://pnpm.io) 12: `corepack enable` is enough, the `packageManager` field of `package.json` pins the exact version. Otherwise, install pnpm 12.

## Commands

```sh
git clone https://github.com/Franck-dev-hub/wm-palimpseste.git
cd wm-palimpseste
pnpm install     # also enables the Git hooks
pnpm build       # dist/firefox and dist/chromium, no source maps
pnpm watch       # rebuilds both browsers on every save, with source maps
pnpm typecheck   # tsc on src and scripts
pnpm lint:quick  # typecheck, ESLint, Prettier
pnpm lint        # lint:quick, build, web-ext lint on dist/firefox
pnpm format      # fixes the files with Prettier and ESLint
```

**Git hooks**: `pre-commit` runs `pnpm lint:quick`, `pre-push` runs `pnpm lint`. `--no-verify` skips them.

Tests come later.

## Load the extension

### Firefox (Gecko)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and pick `dist/firefox/manifest.json`.
3. Open [wiki-masters.com](https://www.wiki-masters.com).

### Chrome, Brave (Chromium)

1. Open `brave://extensions` (Chrome: `chrome://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and pick the `dist/chromium/` folder.
3. Open [wiki-masters.com](https://www.wiki-masters.com).

## Reload

After a rebuild, click **Reload** (`about:debugging`) or the reload arrow (`brave://extensions`), then reload the site tab.\
No auto-reload: Turnstile blocks automated browsers on the site (`web-ext run`, Playwright).\
Firefox forgets a temporary add-on when it closes.

## Logs

- Content script: console of the [wiki-masters.com](https://www.wiki-masters.com) page.
- Background, Firefox: **Inspect** on the extension in `about:debugging`, then **Reload**, with the **Info** filter on.
- Background, Chromium: **service worker** link on the extension in `brave://extensions`, once marked inactive.
- The background stops when idle and only logs on startup.

## How `pnpm watch` behaves

- A syntax error is printed and the watch keeps going, but the `.js` files vanish from `dist/` until it is fixed: a reload fails in the meantime.
- Editing `src/manifest.json` or `scripts/build.ts` restarts the build: `dist/` is briefly empty.

## Firefox Android

Declared (142+), untested.
