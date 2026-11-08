import { describe, expect, it } from 'vitest';
import { parseVCards } from '../src/ui/vcard';

describe('parseVCards', () => {
  it('reads a vCard 3.0 card with folded lines and escapes', () => {
    const vcf = ['BEGIN:VCARD', 'VERSION:3.0', 'FN:Ada Yılmaz', 'ORG:Hiking Club\\, Istanbul;Trips', 'item1.TEL;type=CELL:+90 555 123 ', ' 45 67', 'EMAIL;type=INTERNET:ada@example.org', 'END:VCARD'].join('\r\n');
    expect(parseVCards(vcf)).toEqual([
      { name: 'Ada Yılmaz', phones: ['+90 555 123 45 67'], emails: ['ada@example.org'], org: 'Hiking Club, Istanbul, Trips' },
    ]);
  });

  it('decodes the quoted-printable names Android writes', () => {
    const vcf = [
      'BEGIN:VCARD',
      'VERSION:2.1',
      'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=C5=9Eahin;=C3=96zge;;;',
      'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=C3=96zge =C5=9Eah=',
      'in',
      'TEL;CELL:0555 000 00 00',
      'END:VCARD',
    ].join('\n');
    expect(parseVCards(vcf)).toEqual([{ name: 'Özge Şahin', phones: ['0555 000 00 00'], emails: [] }]);
  });

  it('reads several cards and falls back to the structured name', () => {
    const vcf = 'BEGIN:VCARD\nN:Kaya;Deniz;;;\nEND:VCARD\nBEGIN:VCARD\nTEL:112\nEND:VCARD\n';
    expect(parseVCards(vcf).map(c => c.name)).toEqual(['Deniz Kaya', '112']);
  });
});
