import { toKobo } from './naira';
import { caretAfterFormat, formatNairaInput, nairaInWords, numberInWords } from './money-input';

describe('formatNairaInput', () => {
  it('adds commas as a fee is typed', () => {
    expect(formatNairaInput('100000')).toBe('100,000');
    expect(formatNairaInput('1250000')).toBe('1,250,000');
    expect(formatNairaInput('999')).toBe('999');
  });

  it('keeps one decimal point and at most two decimals', () => {
    expect(formatNairaInput('37500.5')).toBe('37,500.5');
    expect(formatNairaInput('37500.555')).toBe('37,500.55');
    expect(formatNairaInput('1.2.3')).toBe('1.23');
    expect(formatNairaInput('.5')).toBe('0.5');
  });

  it('drops anything that is not part of a number', () => {
    expect(formatNairaInput('₦ 1,000,000')).toBe('1,000,000');
    expect(formatNairaInput('abc')).toBe('');
    expect(formatNairaInput('007')).toBe('7');
  });

  it('still reads back to the same kobo', () => {
    expect(toKobo(formatNairaInput('1250000.50'))).toBe(125_000_050);
  });
});

describe('caretAfterFormat', () => {
  it('keeps the caret after the digit it followed', () => {
    // "1000|0" → "10,000|": four digits before the caret stay four digits.
    expect(caretAfterFormat('10000', 4, '10,000')).toBe(5);
    expect(caretAfterFormat('1000000', 7, '1,000,000')).toBe(9);
    expect(caretAfterFormat('1000', 0, '1,000')).toBe(0);
  });
});

describe('amounts in words', () => {
  it('reads whole numbers the way a cheque is written', () => {
    expect(numberInWords(100_000)).toBe('one hundred thousand');
    expect(numberInWords(1_250_000)).toBe('one million, two hundred and fifty thousand');
    expect(numberInWords(37_500)).toBe('thirty-seven thousand, five hundred');
    expect(numberInWords(1_050)).toBe('one thousand and fifty');
    expect(numberInWords(105)).toBe('one hundred and five');
  });

  it('says naira and kobo, capitalised', () => {
    expect(nairaInWords(10_000_000)).toBe('One hundred thousand naira');
    expect(nairaInWords(5_050)).toBe('Fifty naira and fifty kobo');
    expect(nairaInWords(25)).toBe('Twenty-five kobo');
  });

  it('says nothing for nothing typed', () => {
    expect(nairaInWords(0)).toBe('');
  });
});
