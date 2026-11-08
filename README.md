# chatledger

Open a WhatsApp chat export on your own computer and read everything that happened in it.

chatledger runs on your machine and shows the chat in your browser. Your messages, photos and voice notes are never uploaded anywhere: the app makes no network requests at all, and its content security policy would block them if it tried.

[Türkçe](README.tr.md)

![A chat with search results highlighted](docs/screenshots/search.png)

## What it does

- Opens the `.zip` or `.txt` that WhatsApp exports, or a folder of loose files. Android exports are fully supported; iPhone exports are experimental for now (see *Known limits*).
- Shows the chat the way you remember it, with photos, videos, stickers, voice messages, documents, polls and group events, and stays smooth on chats with hundreds of thousands of messages.
- Finds messages fast. Capitals and accents do not matter, so `ogretmen` finds `Öğretmen`. Put an exact phrase in quotes, or filter by person, media or links.
- Jumps to any date, or straight to the first or last message.
- Collects every photo and video, file and link of the chat in one place, with a full-screen viewer.
- Counts who wrote the most and when the chat is busiest. Also shows messages per month, favourite emoji, the longest silence and more.
- Remembers chats you open, so they are still there after a restart. You can turn this off, and you can remove any saved chat.
- Has an English and a Turkish interface. It reads exports made by phones set to either language.

| Gallery | Statistics |
| --- | --- |
| ![Photos of a chat grouped by month](docs/screenshots/gallery.png) | ![Who wrote the most and when](docs/screenshots/stats.png) |

The pictures show a made-up chat that comes with the tests.

## Getting started

### 1. Export the chat

- **Android:** open the chat, tap ⋮ › More › Export chat, and choose **Include media**.
- **iPhone:** open the chat, tap its name at the top, then **Export Chat › Attach Media**.

Save the file to your computer.

### 2. Install Node.js

chatledger needs [Node.js](https://nodejs.org) 22 or newer. Pick the LTS version on the download page and install it with the default options.

### 3. Download and start chatledger

Download the latest `chatledger-x.y.z.zip` from the releases page and unzip it anywhere.

- **Windows:** double-click `chatledger.cmd`.
- **Linux:** run `./chatledger.sh` in a terminal, or double-click it and choose *Run*.

Your browser opens at `http://127.0.0.1:5170`. Keep the small window that appears open while you use chatledger. Closing it stops the app.

chatledger is tested in current versions of Firefox and of Chrome, Edge and other browsers built on Chromium.

## Known limits

- **iPhone exports are experimental.** chatledger follows the iPhone export format, but it has not yet been tried on many real iPhone exports. If one does not open or looks wrong, please report it (see below).
- Group events such as "added" or "left" from phones set to a language other than English or Turkish are shown as WhatsApp wrote them, without translation. Messages, dates and media work in every language.

## Where your chats are kept

When remembering is on, an opened export is copied into your browser's private storage for the chatledger address. It stays on this computer, in this browser. To remove a chat, use **Remove** in the saved list. Clearing the browser's site data for `127.0.0.1:5170` removes all of them.

Turn off **Remember chats I open on this computer** on the start screen if you share the computer with others.

## Running from source

```sh
git clone https://github.com/abel0x/chatledger.git
cd chatledger
npm install
npm start
```

| Command | What it does |
| --- | --- |
| `npm start` | Builds when needed and opens the app at `http://127.0.0.1:5170` |
| `npm run dev` | Development server with live reload |
| `npm test` | Runs the tests |
| `npm run test:e2e` | Runs the browser tests in Chromium and Firefox |
| `npm run screenshots` | Takes the README pictures from the demo chat |
| `npm run check` | Type-checks the code |
| `npm run release` | Builds a zip that runs without npm or the source |

The code is in three layers: `src/core` reads exports and knows nothing about the screen, `src/loader` opens archives in a worker, and `src/ui` is the Svelte interface. Tests use made-up chats only; `tests/e2e/demo.ts` builds the demo export the browser tests and screenshots use. If you keep real exports in a `coldstorage/` folder, a few extra tests run against them on your machine. That folder is ignored by git.

## Reporting a problem

If an export does not open or something looks wrong, please open an issue and describe it. Include your phone's language and whether it is Android or iPhone. Do not attach your chat. If a line is read wrongly, change the names and text in it before sharing.

## Not affiliated with WhatsApp

chatledger is an independent project. It is not made, endorsed or supported by WhatsApp or Meta. WhatsApp is a trademark of its owner.

## License

Copyright © 2026 abel0x

chatledger is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. See [LICENSE](LICENSE).
