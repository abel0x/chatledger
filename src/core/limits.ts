/**
 * Ceilings that keep a hostile or broken export from exhausting memory or
 * time. Real chats stay far below them: three hundred thousand messages make
 * about 25 MB of text.
 */
export const LIMITS = {
  /** Text of the chat itself, after unpacking. */
  chatTextBytes: 512 * 1024 * 1024,
  /** Files inside one archive. */
  archiveEntries: 250_000,
  /** The body of a Word document, after unpacking. */
  docxXmlBytes: 32 * 1024 * 1024,
  /** Pixels in one picture before it is decoded for a thumbnail. */
  imagePixels: 64_000_000,
  /** A file of starred messages to import. */
  starsFileBytes: 8 * 1024 * 1024,
  /** System lines are short; longer lines are not tried against event patterns. */
  eventLineChars: 2_000,
  /** Longer messages are shown without bold, italic and the like. */
  styledTextChars: 20_000,
  /** How far a style mark looks for its closing mark. */
  styleScanChars: 4_000,
};

export type Limits = typeof LIMITS;
