import { describe, expect, it } from 'vitest';
import { openExport } from '../src/loader/open';
import { buildDemo, DEMO_TITLE } from './e2e/demo';

describe('demo export', () => {
  it('opens cleanly, with every attachment present', async () => {
    const demo = await buildDemo();
    const opened = await openExport([new File([new Uint8Array(demo.buffer)], demo.name)]);
    expect(opened.chat.title).toBe(DEMO_TITLE);
    expect(opened.chat.self).toBe('Ada Yılmaz');
    expect(opened.chat.warnings).toEqual([]);
    expect(opened.missing).toEqual([]);
    expect(demo.images.length).toBeGreaterThan(5);
    expect(opened.chat.messages.length).toBeGreaterThan(200);
    expect((await opened.read(demo.images[0] ?? ''))?.type).toBe('image/png');
  });
});
