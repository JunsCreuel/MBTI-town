// lunar-javascript(MIT)에는 타입 선언이 없어서 쓰는 부분만 적는다.
declare module 'lunar-javascript' {
  export class EightChar {
    setSect(sect: 1 | 2): void;
    getYear(): string;
    getMonth(): string;
    getDay(): string;
    getTime(): string;
  }
  export class Lunar {
    getEightChar(): EightChar;
  }
  export class Solar {
    static fromYmdHms(year: number, month: number, day: number, hour: number, minute: number, second: number): Solar;
    getLunar(): Lunar;
  }
}
