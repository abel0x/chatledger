# chatledger

Open a WhatsApp chat export on your own computer and read everything that happened in it.

chatledger runs on your machine and shows the chat in your browser. Your messages, photos and voice notes are never uploaded anywhere: the app makes no network requests at all, and its content security policy would block them if it tried.

[Türkçe](README.tr.md)

## What it does

- Opens the `.zip` or `.txt` that WhatsApp exports, or a folder of loose files, from Android and iPhone.
- Shows the chat the way you remember it, with photos, videos, stickers, voice messages, documents, polls and group events, and stays smooth on chats with hundreds of thousands of messages.
- Finds messages fast. Capitals and accents do not matter, so `ogretmen` finds `Öğretmen`. Put an exact phrase in quotes, or filter by person, media or links.
- Jumps to any date, or straight to the first or last message.
- Collects every photo and video, file and link of the chat in one place, with a full-screen viewer.
- Counts who wrote the most and when the chat is busiest. Also shows messages per month, favourite emoji, the longest silence and more.
- Remembers chats you open, so they are still there after a restart. You can turn this off, and you can remove any saved chat.
- Has an English and a Turkish interface. It reads exports made by phones set to either language.

## Getting started

### 1. Export the chat

- **Android:** open the chat, tap ⋮ › More › Export chat, and choose **Include media**.
- **iPhone:** open the chat, tap its name at the top, then **Export Chat › Attach Media**.

Save the file to your computer.

### 2. Install Node.js

chatledger needs [Node.js](https://nodejs.org) 20 or newer. Pick the LTS version on the download page and install it with the default options.

### 3. Download and start chatledger

Download the latest `chatledger-x.y.z.zip` from the releases page and unzip it anywhere.

- **Windows:** double-click `chatledger.cmd`.
- **Linux:** run `./chatledger.sh` in a terminal, or double-click it and choose *Run*.

Your browser opens at `http://127.0.0.1:5170`. Keep the small window that appears open while you use chatledger. Closing it stops the app.

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
| `npm run check` | Type-checks the code |
| `npm run release` | Builds a zip that runs without npm or the source |

The code is in three layers: `src/core` reads exports and knows nothing about the screen, `src/loader` opens archives in a worker, and `src/ui` is the Svelte interface. Tests use made-up chats only. If you keep real exports in a `coldstorage/` folder, a few extra tests run against them on your machine. That folder is ignored by git.

## Reporting a problem

If an export does not open or something looks wrong, please open an issue and describe it. Include your phone's language and whether it is Android or iPhone. Do not attach your chat. If a line is read wrongly, change the names and text in it before sharing.

## Not affiliated with WhatsApp

chatledger is an independent project. It is not made, endorsed or supported by WhatsApp or Meta. WhatsApp is a trademark of its owner.

## License

Copyright © 2026 abel0x

chatledger is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. See [LICENSE](LICENSE).
