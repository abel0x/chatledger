# Security

chatledger opens files that may come from other people, so it treats every export as untrusted.

## Reporting a problem

Please report security problems privately, through **Report a vulnerability** on the repository's Security tab, not in a public issue. Describe what an attacker could do and how to reproduce it. Never attach a real chat: build a small made-up export that shows the problem.

You can expect a first answer within a week. Fixes go into the next release, and the report is credited unless you ask otherwise.

Only the latest release is supported.

## How chatledger protects you

- **Nothing leaves the computer.** The app makes no network requests. Its content security policy allows scripts, styles and connections only from the app itself, so even a bug could not send a chat anywhere.
- **The local server only answers this computer.** It listens on `127.0.0.1`, serves the app's own files, and turns away requests made under any other host name, which blocks DNS rebinding.
- **Hostile exports are cut short.** The chat text, the number of files in an archive and the body of a Word document have size limits that are checked while unpacking, not taken from the archive's own claims. Pictures that claim more pixels than is safe are never decoded.
- **Crafted messages cannot stall the app.** Group-event patterns and text formatting only look at bounded stretches of text.
- **Telegram's HTML pages are read, never shown.** A small reader of chatledger's own turns them into plain text and styles; nothing in them is run or loaded, and only web and mail links are kept.
- **Attachments are never run.** They are shown as pictures, video or audio, previewed as text, or saved. Web pages and SVG files are only ever saved, never opened inside the app.
- **Saved chats can be locked.** With a password set, saved chats are encrypted with AES-GCM under a key derived by PBKDF2 (SHA-256, 600,000 rounds). File names and the chat summary are encrypted too, and each chunk of a file is bound to its place so it cannot be swapped. The key lives only in memory while the page is open. Starred messages and the reading position are kept as message ids, which do not reveal content.
- **Disguised files are unmasked.** Names lose hidden direction marks, so a program named to look like `invoice.pdf` shows its real name, `invoicefdp.exe`, and saving any file that can run code asks first.
