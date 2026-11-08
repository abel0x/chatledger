# Changelog

All notable changes to chatledger are listed here. Versions follow [semantic versioning](https://semver.org).

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

[0.1.0]: https://github.com/abel0x/chatledger/releases/tag/v0.1.0
