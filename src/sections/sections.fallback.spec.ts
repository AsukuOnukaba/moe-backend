import { normalizeKeywordList } from './sections.service';

describe('normalizeKeywordList', () => {
  it('trims, lowercases, removes empties and duplicates', () => {
    expect(normalizeKeywordList([' Eid ', 'eid', '', 'Graduation', '  '])).toEqual([
      'eid',
      'graduation',
    ]);
  });
});
