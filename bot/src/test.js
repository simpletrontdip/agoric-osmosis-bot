import { Dec } from './math/decimal.js';

const testSqrt = (a) => {
  const r = new Dec(a);
  const y = r.sqrt();
  const b = y.mul(y);
  const d = r.sub(b);
  const ratio = r.isZero() ? '0' : d.quo(r).mul(new Dec(100n));

  console.log(
    'Testing',
    a,
    '====>',
    y.toString(),
    'diff',
    d.toString(),
    'diff(%)',
    ratio.toString(),
  );
};

[0n, 1n, 20n, 401n, 400n, 4000n, 1231321312313122313123131312313312n].forEach(
  testSqrt,
);
