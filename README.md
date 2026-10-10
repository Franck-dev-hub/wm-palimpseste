<div id="welcome" align="center">

# WikiMasters palimpseste

**English** | [Français](README.fr.md)

An extension that rewrites [WikiMasters](https://www.wiki-masters.com) on top of itself, like a palimpsest.\
More info on cards, pulls and the market.

![Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FFranck-dev-hub%2Fwm-palimpseste%2Fmain%2Fsrc%2Fmanifest.json&query=%24.version&label=Version&color=blue)
![Manifest](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FFranck-dev-hub%2Fwm-palimpseste%2Fmain%2Fsrc%2Fmanifest.json&query=%24.manifest_version&label=Manifest&prefix=V&color=blue)
![License](https://img.shields.io/github/license/Franck-dev-hub/wm-palimpseste?label=License)

![Firefox](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FFranck-dev-hub%2Fwm-palimpseste%2Fmain%2Fsrc%2Fmanifest.json&query=%24.browser_specific_settings.gecko.strict_min_version&label=Firefox&suffix=%2B&color=FF7139&logo=firefoxbrowser&logoColor=white)
![Chrome](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FFranck-dev-hub%2Fwm-palimpseste%2Fmain%2Fsrc%2Fmanifest.json&query=%24.minimum_chrome_version&label=Chrome&suffix=%2B&color=4285F4&logo=googlechrome&logoColor=white)

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
</div>

---

## Principles

- **Fair play**: the extension reads and displays; it automates none of the core features.
- **Local**: data stays in the browser, private and confidential.
- **Unofficial**: not affiliated with WikiMasters.

---

## Features

Status: in development.

---

## Installation

<details><summary>Firefox (Gecko)</summary>

1. Search for "palimpseste" on [addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/search/?q=palimpseste).
2. Click **Add to Firefox**.

</details>

<details><summary>Chrome, Brave (Chromium)</summary>

1. Search for "palimpseste" on the [Chrome Web Store](https://chromewebstore.google.com/search/palimpseste).
2. Click **Add to Chrome** (same button in Brave).

</details>

Then open [wiki-masters.com](https://www.wiki-masters.com): the extension turns on by itself.\
Settings live in the extension's options page. Updates are automatic.

<details><summary>Development</summary>

Requirements:

- [Node.js](https://nodejs.org) 24 (`.nvmrc`).
- [pnpm](https://pnpm.io) 12: `corepack enable` is enough, the `packageManager` field of `package.json` pins the exact version. Otherwise, install pnpm 12.

```sh
git clone https://github.com/Franck-dev-hub/wm-palimpseste.git
cd wm-palimpseste
pnpm install
pnpm build       # dist/firefox and dist/chromium, no source maps
pnpm watch       # rebuilds both browsers on every save, with source maps
pnpm typecheck   # tsc on src and scripts
```

Lint and tests come later.

**Firefox (Gecko)**

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and pick `dist/firefox/manifest.json`.
3. Open [wiki-masters.com](https://www.wiki-masters.com).

**Chrome, Brave (Chromium)**

1. Open `brave://extensions` (Chrome: `chrome://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and pick the `dist/chromium/` folder.
3. Open [wiki-masters.com](https://www.wiki-masters.com).

**Reload**

After a rebuild, click **Reload** (`about:debugging`) or the reload arrow (`brave://extensions`), then reload the site tab.\
No auto-reload: Turnstile blocks automated browsers on the site (`web-ext run`, Playwright).\
Firefox forgets a temporary add-on when it closes.

**Logs**

- Content script: console of the [wiki-masters.com](https://www.wiki-masters.com) page.
- Background, Firefox: **Inspect** on the extension in `about:debugging`, then **Reload**, with the **Info** filter on.
- Background, Chromium: **service worker** link on the extension in `brave://extensions`, once marked inactive.
- The background stops when idle and only logs on startup.

**How `pnpm watch` behaves**

- A syntax error is printed and the watch keeps going, but the `.js` files vanish from `dist/` until it is fixed: a reload fails in the meantime.
- Editing `src/manifest.json` or `scripts/build.ts` restarts the build: `dist/` is briefly empty.

**Firefox Android**

Declared (142+), untested.

</details>

---

## License

The code is under [AGPL-3.0](LICENSE).\
WikiMasters, Wikipedia, Letterboxd, Babelio and Goodreads are trademarks of their respective owners.
