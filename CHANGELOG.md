# Changelog

All notable changes to chatledger are listed here. Versions follow [semantic versioning](https://semver.org).

## [Unreleased]

## [0.7.1] - 2026-11-11

### Added

- Search every saved chat at once from the start page, WhatsApp and Telegram alike. Each chat lists its newest matches; pick one to open the chat right at that message, with the search already filled in. Saved chats protected with a password are searched once they are unlocked, and locking them again forgets everything that was read.
- README pictures of a made-up Telegram chat and of the new search.

## [0.7.0] - 2026-11-11

### Added

- Telegram chats, exported from Telegram Desktop as JSON or as HTML pages. Pick the folder Telegram makes, a zip of it, or its files. Replies show the message they answer and jump to it, forwarded messages say where they came from, reactions are listed under each message, and hidden spoiler text shows when selected. Telegram's bold, italic, underline, strikethrough, code, quotes and links are kept. Several exports of the same chat are joined by their message numbers, whichever format they use. Channels open too, with their name and photo changes and the price of messages to them.
- Calls, missed calls and other Telegram service messages are written in the language you read in. The events of HTML exports are read from Telegram's English wording; the ones it does not know are shown as written.
- **Telegram support is experimental.** It has been checked against real channel exports, but not yet against group or one-to-one chats. HTML pages do not say which messages were edited, or the exact time of service messages; JSON exports do. Exports of a whole account are turned away with a note to export one chat at a time.

## [0.6.0] - 2026-11-08

### Added

- Several exports of the same chat are joined into one timeline: pick them together, or add one to an open chat from Group info. Messages found in more than one keep their fullest form, such as the photo instead of "media omitted"; exports of different chats are refused.
- Print a whole chat, a date range or the starred messages, with or without pictures, or save them as a PDF. Ctrl+P opens it.
- An optional password for saved chats. They are encrypted on the computer, names included; without the password they can only be removed.
- Shared contact cards show their names, numbers and e-mail addresses.
- Voice messages show their waveform.
- Releases can be started by hand, for when GitHub skips tags pushed in a batch, and dependency updates are proposed weekly.

## [0.5.0] - 2026-11-08

### Security

- Limits on the unpacked chat text, the number of files in an archive and the body of Word documents, checked while unpacking rather than trusted from the archive.
- Pictures are measured from their headers before decoding; ones claiming too many pixels are shown as files and never decoded.
- File names lose hidden direction marks, so programs cannot pose as documents, and saving a file that can run code asks first.
- Group-event patterns and text formatting only look at bounded stretches of text, so crafted messages cannot stall the app.
- The local server turns away requests made under another host name, which blocks DNS rebinding.
- Imported star files have a size limit.
- A security policy describes how to report problems privately.

### Fixed

- Attachments whose names carry hidden direction marks are found even when the chat text writes the name without them.

## [0.4.0] - 2026-11-08

### Added

- A single program for Windows and for Linux that needs nothing installed, not even Node.js. It carries the app inside itself and stops by itself a few minutes after its last browser tab is closed.
- A progress bar while a large export is unpacked and read.

### Changed

- Statistics are worked out off the main thread, so the page stays responsive on very long chats.
- The zip for systems with Node.js now needs only Node.js; the launch code is shared with the single program.

## [0.3.0] - 2026-11-08

### Added

- Five new languages: German, Spanish, French, Italian and Portuguese, both for the interface and for reading exports from phones set to them. The browser's language is picked up on first start.
- French exports with dates written as "01/10/2025 à 20:30" and group names in « guillemets » or German „Anführungszeichen“ are read correctly.

### Known limits

- The wording WhatsApp uses in the five new languages has not yet been checked against many real exports. Messages, dates and media do not depend on it; unrecognised group events are shown as written.

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

[Unreleased]: https://github.com/abel0x/chatledger/compare/v0.7.1...HEAD
[0.7.1]: https://github.com/abel0x/chatledger/releases/tag/v0.7.1
[0.7.0]: https://github.com/abel0x/chatledger/releases/tag/v0.7.0
[0.6.0]: https://github.com/abel0x/chatledger/releases/tag/v0.6.0
[0.5.0]: https://github.com/abel0x/chatledger/releases/tag/v0.5.0
[0.4.0]: https://github.com/abel0x/chatledger/releases/tag/v0.4.0
[0.3.0]: https://github.com/abel0x/chatledger/releases/tag/v0.3.0
[0.2.0]: https://github.com/abel0x/chatledger/releases/tag/v0.2.0
[0.1.0]: https://github.com/abel0x/chatledger/releases/tag/v0.1.0
