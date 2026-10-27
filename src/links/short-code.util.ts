import { randomInt } from 'node:crypto';

// 혼동되는 문자(0/O, 1/l/I) 제외한 URL-safe 알파벳
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';

/** 단축 링크용 short code 생성 (기본 7자) */
export function generateShortCode(length = 7): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}
