/* eslint-disable max-classes-per-file */
import bigInteger from 'big-integer';

export class Int {
  /**
   * @param int - Parse a number | bigInteger | string into a bigInt.
   * Remaing parameters only will be used when type of int is string.
   * @param base - Default base is 10.
   * @param alphabet - Default alphabet is "0123456789abcdefghijklmnopqrstuvwxyz".
   * @param caseSensitive - Defaults to false.
   */
  constructor(int, base, alphabet, caseSensitive) {
    if (typeof int === 'string') {
      this.int = bigInteger(int, base, alphabet, caseSensitive);
    } else if (typeof int === 'number') {
      this.int = bigInteger(int);
    } else if (typeof int === 'bigint') {
      this.int = bigInteger(int);
    } else {
      this.int = bigInteger(int);
    }
  }

  toString() {
    return this.int.toString(10);
  }

  equals(i) {
    return this.int.equals(i.int);
  }

  gt(i) {
    return this.int.gt(i.int);
  }

  gte(i) {
    return this.int.greaterOrEquals(i.int);
  }

  lt(i) {
    return this.int.lt(i.int);
  }

  lte(i) {
    return this.int.lesserOrEquals(i.int);
  }

  add(i) {
    return new Int(this.int.add(i.int));
  }

  sub(i) {
    return new Int(this.int.subtract(i.int));
  }

  mul(i) {
    return new Int(this.int.multiply(i.int));
  }

  div(i) {
    return new Int(this.int.divide(i.int));
  }

  mod(i) {
    return new Int(this.int.mod(i.int));
  }

  neg() {
    return new Int(this.int.negate());
  }
}
export class Uint {
  /**
   * @param uint - Parse a number | bigInteger | string into a bigUint.
   * Remaing parameters only will be used when type of int is string.
   * @param base - Default base is 10.
   * @param alphabet - Default alphabet is "0123456789abcdefghijklmnopqrstuvwxyz".
   * @param caseSensitive - Defaults to false.
   */
  constructor(uint, base, alphabet, caseSensitive) {
    if (typeof uint === 'string') {
      this.uint = bigInteger(uint, base, alphabet, caseSensitive);
    } else if (typeof uint === 'number') {
      this.uint = bigInteger(uint);
    } else if (typeof uint === 'bigint') {
      this.uint = bigInteger(uint);
    } else {
      this.uint = bigInteger(uint);
    }
    if (this.uint.isNegative()) {
      throw new TypeError('Uint should not be negative');
    }
  }

  toString() {
    return this.uint.toString(10);
  }

  equals(i) {
    return this.uint.equals(i.uint);
  }

  gt(i) {
    return this.uint.gt(i.uint);
  }

  gte(i) {
    return this.uint.greaterOrEquals(i.uint);
  }

  lt(i) {
    return this.uint.lt(i.uint);
  }

  lte(i) {
    return this.uint.lesserOrEquals(i.uint);
  }

  add(i) {
    return new Uint(this.uint.add(i.uint));
  }

  sub(i) {
    return new Uint(this.uint.subtract(i.uint));
  }

  mul(i) {
    return new Uint(this.uint.multiply(i.uint));
  }

  div(i) {
    return new Uint(this.uint.divide(i.uint));
  }

  mod(i) {
    return new Uint(this.uint.mod(i.uint));
  }
}
