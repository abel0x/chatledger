import { describe, expect, it } from 'vitest';
import { parseDocumentXml } from '../src/loader/docx';

const doc = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;

describe('parseDocumentXml', () => {
  it('reads headings, styled runs, tabs and breaks', () => {
    const blocks = parseDocumentXml(
      doc(
        '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Exam &amp; schedule</w:t></w:r></w:p>' +
          '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Bold</w:t></w:r><w:r><w:t xml:space="preserve"> and </w:t></w:r>' +
          '<w:r><w:rPr><w:i/><w:b w:val="0"/></w:rPr><w:t>italic</w:t></w:r><w:r><w:tab/><w:t>x</w:t><w:br/><w:t>y</w:t></w:r></w:p>',
      ),
    );
    expect(blocks).toEqual([
      { kind: 'h1', runs: [{ text: 'Exam & schedule' }] },
      {
        kind: 'p',
        runs: [{ text: 'Bold', b: true }, { text: ' and ' }, { text: 'italic', i: true }, { text: '\tx\ny' }],
      },
    ]);
  });

  it('reads list items and tables', () => {
    const blocks = parseDocumentXml(
      doc(
        '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>First</w:t></w:r></w:p>' +
          '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Day</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Room</w:t></w:r></w:p></w:tc></w:tr>' +
          '<w:tr><w:tc><w:p><w:r><w:t>Mon</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>B&#305;4</w:t></w:r></w:p></w:tc></w:tr></w:tbl>',
      ),
    );
    expect(blocks).toEqual([
      { kind: 'li', runs: [{ text: 'First' }] },
      { kind: 'table', rows: [['Day', 'Room'], ['Mon', 'Bı4']] },
    ]);
  });

  it('keeps one empty paragraph where Word stacks several', () => {
    const blocks = parseDocumentXml(doc('<w:p><w:r><w:t>a</w:t></w:r></w:p><w:p/><w:p></w:p><w:p></w:p><w:p><w:r><w:t>b</w:t></w:r></w:p>'));
    expect(blocks.map(b => (b.kind === 'table' ? '' : b.runs.map(r => r.text).join('')))).toEqual(['a', '', 'b']);
  });
});
