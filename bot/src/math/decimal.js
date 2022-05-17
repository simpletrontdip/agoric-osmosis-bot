import bigInteger from 'big-integer';
import { Int } from './int';

export class Dec {
  /**
   * Create a new Dec from integer with decimal place at prec
   *
   * @param int - Parse a number | bigInteger | string into a Dec.
   * If int is string and contains dot(.), prec is ignored and automatically calculated.
   * @param prec - Precision
   */
  constructor(int, prec = 0) {
    if (typeof int === 'string') {
      if (int.length === 0) {
        throw new Error('empty string');
      }
      if (!/^(-?\d+\.\d+)$|^(-?\d+)$/.test(int)) {
        throw new Error(`invalid decimal: ${int}`);
      }
      if (int.indexOf('.') >= 0) {
        prec = int.length - int.indexOf('.') - 1;
        int = int.replace('.', '');
      }
      this.int = bigInteger(int);
    } else if (typeof int === 'number') {
      this.int = bigInteger(int);
    } else if (int instanceof Int) {
      this.int = bigInteger(int.toString());
    } else if (typeof int === 'bigint') {
      this.int = bigInteger(int);
    } else {
      this.int = bigInteger(int);
    }
    this.int = this.int.multiply(Dec.calcPrecisionMultiplier(bigInteger(prec)));
  }

  static calcPrecisionMultiplier(prec) {
    if (prec.lt(bigInteger(0))) {
      throw new Error('Invalid prec');
    }
    if (prec.gt(Dec.precision)) {
      throw new Error('Too much precision');
    }
    if (Dec.precisionMultipliers[prec.toString()]) {
      return Dec.precisionMultipliers[prec.toString()];
    }
    const zerosToAdd = Dec.precision.minus(prec);
    const multiplier = bigInteger(10).pow(zerosToAdd);
    Dec.precisionMultipliers[prec.toString()] = multiplier;
    return multiplier;
  }

  isZero() {
    return this.int.eq(bigInteger(0));
  }

  isNegative() {
    return this.int.isNegative();
  }

  isPositive() {
    return this.int.isPositive();
  }

  equals(d2) {
    return this.int.eq(d2.int);
  }

  /**
   * Alias for the greater method.
   *
   * @param d2
   */
  gt(d2) {
    return this.int.gt(d2.int);
  }

  /**
   * Alias for the greaterOrEquals method.
   *
   * @param d2
   */
  gte(d2) {
    return this.int.geq(d2.int);
  }

  /**
   * Alias for the lesser method.
   *
   * @param d2
   */
  lt(d2) {
    return this.int.lt(d2.int);
  }

  /**
   * Alias for the lesserOrEquals method.
   *
   * @param d2
   */
  lte(d2) {
    return this.int.leq(d2.int);
  }

  /**
   * reverse the decimal sign.
   */
  neg() {
    return new Dec(this.int.negate(), Dec.precision.toJSNumber());
  }

  /**
   * Returns the absolute value of a decimals.
   */
  abs() {
    return new Dec(this.int.abs(), Dec.precision.toJSNumber());
  }

  add(d2) {
    return new Dec(this.int.add(d2.int), Dec.precision.toJSNumber());
  }

  sub(d2) {
    return new Dec(this.int.subtract(d2.int), Dec.precision.toJSNumber());
  }

  mul(d2) {
    return new Dec(
      this.mulRaw(d2).chopPrecisionAndRound(),
      Dec.precision.toJSNumber(),
    );
  }

  mulTruncate(d2) {
    return new Dec(
      this.mulRaw(d2).chopPrecisionAndTruncate(),
      Dec.precision.toJSNumber(),
    );
  }

  mulRaw(d2) {
    return new Dec(this.int.multiply(d2.int), Dec.precision.toJSNumber());
  }

  quo(d2) {
    return new Dec(
      this.quoRaw(d2).chopPrecisionAndRound(),
      Dec.precision.toJSNumber(),
    );
  }

  quoTruncate(d2) {
    return new Dec(
      this.quoRaw(d2).chopPrecisionAndTruncate(),
      Dec.precision.toJSNumber(),
    );
  }

  quoRoundUp(d2) {
    return new Dec(
      this.quoRaw(d2).chopPrecisionAndRoundUp(),
      Dec.precision.toJSNumber(),
    );
  }

  quoRaw(d2) {
    const precision = Dec.calcPrecisionMultiplier(bigInteger(0));
    // multiply precision twice
    const mul = this.int.multiply(precision).multiply(precision);
    return new Dec(mul.divide(d2.int), Dec.precision.toJSNumber());
  }

  isInteger() {
    const precision = Dec.calcPrecisionMultiplier(bigInteger(0));
    return this.int.remainder(precision).equals(bigInteger(0));
  }

  /**
   * Remove a Precision amount of rightmost digits and perform bankers rounding
   * on the remainder (gaussian rounding) on the digits which have been removed.
   */
  chopPrecisionAndRound() {
    // Remove the negative and add it back when returning
    if (this.isNegative()) {
      const absoulteDec = this.abs();
      const choped = absoulteDec.chopPrecisionAndRound();
      return choped.negate();
    }
    const precision = Dec.calcPrecisionMultiplier(bigInteger(0));
    const fivePrecision = precision.divide(bigInteger(2));
    // Get the truncated quotient and remainder
    const { quotient, remainder } = this.int.divmod(precision);
    // If remainder is zero
    if (remainder.equals(bigInteger(0))) {
      return quotient;
    }
    if (remainder.lt(fivePrecision)) {
      return quotient;
    } else if (remainder.gt(fivePrecision)) {
      return quotient.add(bigInteger(1));
    } else {
      // always round to an even number
      if (quotient.divide(bigInteger(2)).equals(bigInteger(0))) {
        return quotient;
      }
      return quotient.add(bigInteger(1));
    }
  }

  chopPrecisionAndRoundUp() {
    // Remove the negative and add it back when returning
    if (this.isNegative()) {
      const absoulteDec = this.abs();
      // truncate since d is negative...
      const choped = absoulteDec.chopPrecisionAndTruncate();
      return choped.negate();
    }
    const precision = Dec.calcPrecisionMultiplier(bigInteger(0));
    // Get the truncated quotient and remainder
    const { quotient, remainder } = this.int.divmod(precision);
    // If remainder is zero
    if (remainder.equals(bigInteger(0))) {
      return quotient;
    }
    return quotient.add(bigInteger(1));
  }

  /**
   * Similar to chopPrecisionAndRound, but always rounds down
   */
  chopPrecisionAndTruncate() {
    const precision = Dec.calcPrecisionMultiplier(bigInteger(0));
    return this.int.divide(precision);
  }

  toString(prec = Dec.precision.toJSNumber(), locale = false) {
    const precision = Dec.calcPrecisionMultiplier(bigInteger(0));
    const int = this.int.abs();
    const { quotient: integer, remainder: fraction } = int.divmod(precision);
    let fractionStr = fraction.toString(10);
    for (
      let i = 0, l = fractionStr.length;
      i < Dec.precision.toJSNumber() - l;
      // eslint-disable-next-line no-plusplus
      i++
    ) {
      fractionStr = `0${fractionStr}`;
    }
    fractionStr = fractionStr.substring(0, prec);
    const isNegative =
      this.isNegative() &&
      !(integer.eq(bigInteger(0)) && fractionStr.length === 0);
    const integerStr = locale
      ? // @ts-ignore
        BigInt(integer.toString()).toLocaleString('en-US')
      : integer.toString();
    return `${isNegative ? '-' : ''}${integerStr}${
      fractionStr.length > 0 ? `.${fractionStr}` : ''
    }`;
  }

  round() {
    return new Int(this.chopPrecisionAndRound());
  }

  roundUp() {
    return new Int(this.chopPrecisionAndRoundUp());
  }

  truncate() {
    return new Int(this.chopPrecisionAndTruncate());
  }
}
Dec.precision = bigInteger(18);
Dec.precisionMultipliers = {};
