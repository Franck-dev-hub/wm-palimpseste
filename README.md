<div id="welcome" align="center">

# WikiMasters palimpseste

**English** | [Français](README.fr.md)

An extension that rewrites [WikiMasters](https://www.wiki-masters.com) on top of itself, like a palimpsest.\
More info on cards, pulls and the market.

![Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FFranck-dev-hub%2Fwm-palimpseste%2Fmain%2Fsrc%2Fmanifest.json&query=%24.version&label=Version&color=blue)
![Manifest](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FFranck-dev-hub%2Fwm-palimpseste%2Fmain%2Fsrc%2Fmanifest.json&query=%24.manifest_version&label=Manifest&prefix=V&color=blue)
![License](https://img.shields.io/github/license/Franck-dev-hub/wm-palimpseste?label=License)
![CI](https://img.shields.io/github/actions/workflow/status/Franck-dev-hub/wm-palimpseste/ci.yml?label=CI)

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

- **Wikipedia button**: a W badge on every card opens its Wikipedia article in a new tab.
- **Tags in the description**: in the tag menu of a card, the tags named in its description stand out (blue bar).
- **Proposed tag**: the tag menu puts one of the player's tags first, marked with a ★. It is learned from the cards
  already tagged, opened or seen in the collection, and from their Wikidata category.

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

Development: see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

The code is under [AGPL-3.0](LICENSE).\
WikiMasters, Wikipedia, Letterboxd, Babelio and Goodreads are trademarks of their respective owners.
