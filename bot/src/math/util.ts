// https://stackoverflow.com/questions/53683995/javascript-big-integer-square-root/58863398#58863398
export function rootNth(value: bigint, k: bigint = 2n): bigint {
  if (value < 0n) {
    throw Error('negative number is not supported');
  }

  let o = 0n;
  let x = value;
  let limit = 100;

  // eslint-disable-next-line no-plusplus
  while (x ** k !== k && x !== o && --limit) {
    o = x;
    x = ((k - 1n) * x + value / x ** (k - 1n)) / k;
  }

  return x;
}

export function sqrt(value: bigint): bigint {
  return rootNth(value, 2n);
}
