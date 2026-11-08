# Changelog

All notable changes to chatledger are listed here. Versions follow [semantic versioning](https://semver.org).

## [0.2.0] - 2026-11-08

Everything the first prototype of chatledger could do is back, and more.

### Added

- WhatsApp formatting in messages: *bold*, _italic_, ~strikethrough~, `code` and code blocks. Mentions are clickable and show that person's messages; messages made only of emoji are shown large.
- A menu on every message to star it, copy its text or copy a link to it. Starred messages have their own panel and can be exported to a file and imported again.
- Links to single messages, and the chat opens where you stopped reading last time.
- Search steps through results with Enter and Shift+Enter, newest first, and can be limited to a date range.
- A timeline beside the chat that shows how busy each day was and moves through months and years when dragged or used with the arrow keys.
- A voice message player with 1×, 1.5× and 2× speed. GIFs play by themselves.
- Previews of PDF and Word documents, and of plain-text files such as contact cards.
- A stickers tab in the gallery.
- Group info: who created the group, every name change, who is still in it and who left, what was said on this day in earlier years, and a random message.
- Light and dark themes besides following the system, three text sizes, and a list of keyboard shortcuts (`?`).
- More statistics: the longest message, who sends the most stickers and the average per day.

### Changed

- The header keeps search and the gallery in reach on small screens and moves everything else into one menu.
- Search results are listed newest first.

## [0.1.0] - 2026-11-08

The first release.

### Reading exports

- Opens the `.zip` or `.txt` that WhatsApp exports, or a folder of loose files.
- Reads Android exports, and iPhone exports as an experimental feature (see below).
- Understands phones set to English or Turkish, with day-first or month-first dates and 12- or 24-hour time.
- Shows photos, videos, stickers, voice messages, documents, polls, locations, edited and deleted messages, and group events. Group events are written in the language of the app, not the phone.

### Finding your way

- Search that ignores capitals and accents, finds exact phrases in quotes, and filters by person, media or links.
- Jump to any date, or to the first or last message.
- Gallery of photos and videos by month, with files and links on their own tabs, and a full-screen viewer.
- Statistics: who wrote the most, the busiest hours and weekdays, messages per month, favourite emoji and a few highlights. Every chart can also be shown as a table.

### Running it

- Double-click `chatledger.cmd` on Windows or `chatledger.sh` on Linux; it needs Node.js 22 or newer.
- Everything stays on the computer. The app makes no network requests, and chats you open can be remembered in the browser or forgotten again.
- English and Turkish interface.

### Known limits

- **iPhone support is experimental.** It follows the iPhone export format but has not yet been tried on many real iPhone exports. If one does not open or looks wrong, please open an issue.
- Group events from phones in other languages are shown as WhatsApp wrote them, without translation.

[0.2.0]: https://github.com/abel0x/chatledger/releases/tag/v0.2.0
[0.1.0]: https://github.com/abel0x/chatledger/releases/tag/v0.1.0
