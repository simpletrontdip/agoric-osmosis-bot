/* eslint-disable no-use-before-define */
import { Dec } from './decimal.js';
import { Int } from './int.js';

const isDebugging = false;
const powPrecision = new Dec('0.00000001');
const oneDec = new Dec(1);
const twoDec = new Dec(2);
const zeroInt = new Int(0);
const twoInt = new Int(2);

export function calcSlippageSlope(
  tokenBalanceIn,
  tokenWeightIn,
  tokenWeightOut,
  swapFee,
) {
  return oneDec
    .sub(swapFee)
    .mul(tokenWeightIn.add(tokenWeightOut))
    .sub(twoDec.mul(tokenBalanceIn).mul(tokenWeightOut));
}

export function calcSpotPrice(
  tokenBalanceIn,
  tokenWeightIn,
  tokenBalanceOut,
  tokenWeightOut,
  swapFee,
) {
  const number = tokenBalanceIn.quo(tokenWeightIn);
  const denom = tokenBalanceOut.quo(tokenWeightOut);
  const scale = oneDec.quo(oneDec.sub(swapFee));
  return number.quo(denom).mul(scale);
}

export function calcOutGivenIn(
  tokenBalanceIn,
  tokenWeightIn,
  tokenBalanceOut,
  tokenWeightOut,
  tokenAmountIn,
  swapFee,
) {
  const weightRatio = tokenWeightIn.quo(tokenWeightOut);
  let adjustedIn = oneDec.sub(swapFee);
  adjustedIn = tokenAmountIn.mul(adjustedIn);
  const y = tokenBalanceIn.quo(tokenBalanceIn.add(adjustedIn));
  const foo = pow(y, weightRatio);
  const bar = oneDec.sub(foo);
  return tokenBalanceOut.mul(bar);
}

export function calcInGivenOut(
  tokenBalanceIn,
  tokenWeightIn,
  tokenBalanceOut,
  tokenWeightOut,
  tokenAmountOut,
  swapFee,
) {
  const weightRatio = tokenWeightOut.quo(tokenWeightIn);
  const diff = tokenBalanceOut.sub(tokenAmountOut);
  const y = tokenBalanceOut.quo(diff);
  let foo = pow(y, weightRatio);
  foo = foo.sub(oneDec);
  const tokenAmountIn = oneDec.sub(swapFee);
  return tokenBalanceIn.mul(foo).quo(tokenAmountIn);
}

export function calcPoolOutGivenSingleIn(
  tokenBalanceIn,
  tokenWeightIn,
  poolSupply,
  totalWeight,
  tokenAmountIn,
  swapFee,
) {
  const normalizedWeight = tokenWeightIn.quo(totalWeight);
  const zaz = oneDec.sub(normalizedWeight).mul(swapFee);
  const tokenAmountInAfterFee = tokenAmountIn.mul(oneDec.sub(zaz));
  const newTokenBalanceIn = tokenBalanceIn.add(tokenAmountInAfterFee);
  const tokenInRatio = newTokenBalanceIn.quo(tokenBalanceIn);
  // uint newPoolSupply = (ratioTi ^ weightTi) * poolSupply;
  const poolRatio = pow(tokenInRatio, normalizedWeight);
  const newPoolSupply = poolRatio.mul(poolSupply);
  return newPoolSupply.sub(poolSupply);
}

export function calcSingleInGivenPoolOut(
  tokenBalanceIn,
  tokenWeightIn,
  poolSupply,
  totalWeight,
  poolAmountOut,
  swapFee,
) {
  const normalizedWeight = tokenWeightIn.quo(totalWeight);
  const newPoolSupply = poolSupply.add(poolAmountOut);
  const poolRatio = newPoolSupply.quo(poolSupply);
  // uint newBalTi = poolRatio^(1/weightTi) * balTi;
  const boo = oneDec.quo(normalizedWeight);
  const tokenInRatio = pow(poolRatio, boo);
  const newTokenBalanceIn = tokenInRatio.mul(tokenBalanceIn);
  const tokenAmountInAfterFee = newTokenBalanceIn.sub(tokenBalanceIn);
  // Do reverse order of fees charged in joinswap_ExternAmountIn, this way
  //     ``` pAo == joinswap_ExternAmountIn(Ti, joinswap_PoolAmountOut(pAo, Ti)) ```
  // uint tAi = tAiAfterFee / (1 - (1-weightTi) * swapFee) ;
  const zar = oneDec.sub(normalizedWeight).mul(swapFee);
  return tokenAmountInAfterFee.quo(oneDec.sub(zar));
}

export function calcSingleOutGivenPoolIn(
  tokenBalanceOut,
  tokenWeightOut,
  poolSupply,
  totalWeight,
  poolAmountIn,
  swapFee,
) {
  const normalizedWeight = tokenWeightOut.quo(totalWeight);
  // charge exit fee on the pool token side
  // pAiAfterExitFee = pAi*(1-exitFee)
  const poolAmountInAfterExitFee = poolAmountIn.mul(oneDec);
  const newPoolSupply = poolSupply.sub(poolAmountInAfterExitFee);
  const poolRatio = newPoolSupply.quo(poolSupply);
  // newBalTo = poolRatio^(1/weightTo) * balTo;
  const tokenOutRatio = pow(poolRatio, oneDec.quo(normalizedWeight));
  const newTokenBalanceOut = tokenOutRatio.mul(tokenBalanceOut);
  const tokenAmountOutBeforeSwapFee = tokenBalanceOut.sub(newTokenBalanceOut);
  // charge swap fee on the output token side
  // uint tAo = tAoBeforeSwapFee * (1 - (1-weightTo) * swapFee)
  const zaz = oneDec.sub(normalizedWeight).mul(swapFee);
  return tokenAmountOutBeforeSwapFee.mul(oneDec.sub(zaz));
}

export function calcPoolInGivenSingleOut(
  tokenBalanceOut,
  tokenWeightOut,
  poolSupply,
  totalWeight,
  tokenAmountOut,
  swapFee,
) {
  // charge swap fee on the output token side
  const normalizedWeight = tokenWeightOut.quo(totalWeight);
  // uint tAoBeforeSwapFee = tAo / (1 - (1-weightTo) * swapFee) ;
  const zoo = oneDec.sub(normalizedWeight);
  const zar = zoo.mul(swapFee);
  const tokenAmountOutBeforeSwapFee = tokenAmountOut.quo(oneDec.sub(zar));
  const newTokenBalanceOut = tokenBalanceOut.sub(tokenAmountOutBeforeSwapFee);
  const tokenOutRatio = newTokenBalanceOut.quo(tokenBalanceOut);
  // uint newPoolSupply = (ratioTo ^ weightTo) * poolSupply;
  const poolRatio = pow(tokenOutRatio, normalizedWeight);
  const newPoolSupply = poolRatio.mul(poolSupply);
  const poolAmountInAfterExitFee = poolSupply.sub(newPoolSupply);
  // charge exit fee on the pool token side
  // pAi = pAiAfterExitFee/(1-exitFee)
  return poolAmountInAfterExitFee.quo(oneDec);
}
function powInt(base, power) {
  if (power.equals(zeroInt)) {
    return oneDec;
  }
  let tmp = oneDec;
  for (let i = power; i.gt(new Int(1)); ) {
    if (!i.mod(twoInt).equals(zeroInt)) {
      tmp = tmp.mul(base);
    }
    i = i.div(twoInt);
    base = base.mul(base);
  }
  return base.mul(tmp);
}

export function calcOptimalTradeAmount(cB, sB, fB, cS, sS, fS) {
  /**
   * buy side B
   * cIn = (c * sOut)  / (s - sOut)
   * (With fee fB)
   * cIn = (cB * sOut) / (sB - sOut) * (1 + fB)
   *
   * sell side S
   * cOut = (c * sIn) / (s + sIn)
   * (With fee fS)
   * cOut = (cS * sIn) / (sS + sIn) * (1 - fS)
   *
   * P = cOut - cIn with note that (sOut = sIn = x)
   * P(x) = (cS * x)(1 - fS)/(sS + x) - (cB * x)(1 + fB)/(sB - x)
   *
   * a = cS
   * b = 1 - fS
   * c = sS
   *
   * d = cB
   * e = 1 + fB
   * f = sB
   *
   * P(x) = (a b x)/(c + x) - (d e x)/(f - x)
   *
   * m = ab
   * k = de
   *
   * P(x) = mx/(c+x) - kx/(f-x)
   *
   * P'(x) = (cm)/(c+x)^2 - (fk)/(f-x)^2
   *
   * A = cm
   * B = fk
   *
   * P'(x) = A/(c+x)^2 - B/(f-x)^2 = 0
   *
   * x = (sqrt(AB) (c + f) + A f + B c)/(A - B)
   * x = (-sqrt(AB) (c + f) + A f + B c)/(A - B)
   *
   * solve with f > x > 0
   *
   * cOut = mx/(c+x)
   * cIn = kx/(f-x)
   *
   * */

  const a = cS;
  const b = oneDec.sub(fS);
  const c = sS;
  const d = cB;
  const e = oneDec.add(fB);
  const f = sB;

  const k = d.mul(e);
  const m = a.mul(b);

  const A = c.mul(m);
  const B = f.mul(k);

  const sAB = A.sub(B);
  const rAB = A.mul(B).sqrt();
  const cBfA = c.mul(B).add(f.mul(A));
  const cf = c.add(f);

  const x1 = rAB.mul(cf).add(cBfA).quo(sAB);
  const x2 = rAB.neg().mul(cf).add(cBfA).quo(sAB);

  console.log('Trying 2 values', x1.toString(4), x2.toString(4));

  let x = null;

  if (x1.isPositive() && x1.lt(f)) {
    x = x1;
  } else if (x2.isPositive() && x2.lt(f)) {
    x = x2;
  }

  if (!x) {
    console.log('Could not find a valid solution');
    return null;
  }

  const cOut = m.mul(x).quo(c.add(x));
  const cIn = k.mul(x).quo(f.sub(x));
  const profit = cOut.sub(cIn);

  console.log('Math result ===>', {
    x: x.toString(),
    profit: profit.toString(),
    cIn: cIn.toString(),
    cOut: cOut.toString(),
  });

  console.log('Optimal value in range found');

  if (isDebugging) {
    console.log('Checking relative value');
    const leftX = x.add(oneDec);
    const rightX = x.sub(oneDec);

    const leftProfit = m
      .mul(leftX)
      .quo(c.add(leftX))
      .sub(k.mul(leftX).quo(f.sub(leftX)));

    const rightProfit = m
      .mul(rightX)
      .quo(c.add(rightX))
      .sub(k.mul(rightX).quo(f.sub(rightX)));

    console.log(
      'Try left value ====>',
      leftX.toString(),
      'profit',
      leftProfit.toString(),
    );
    console.log(
      'Try right value ====>',
      rightX.toString(),
      'profit',
      rightProfit.toString(),
    );
    assert(
      profit.gt(leftProfit) && profit.gt(rightProfit),
      'Something wrong with optimal value',
    );
  }

  return {
    secondaryAmount: x,
    centralBuyMaxAmount: cIn,
    centralSellMinAmount: cOut,
    profit,
  };
}

export function pow(base, exp) {
  // Exponentiation of a negative base with an arbitrary real exponent is not closed within the reals.
  // You can see this by recalling that `i = (-1)^(.5)`. We have to go to complex numbers to define this.
  // (And would have to implement complex logarithms)
  // We don't have a need for negative bases, so we don't include any such logic.
  if (!base.isPositive()) {
    throw new Error('base must be greater than 0');
  }
  // TODO: Remove this if we want to generalize the function,
  // we can adjust the algorithm in this setting.
  if (base.gte(new Dec('2'))) {
    throw new Error('base must be lesser than two');
  }
  // We will use an approximation algorithm to compute the power.
  // Since computing an integer power is easy, we split up the exponent into
  // an integer component and a fractional component.
  const integer = exp.truncate();
  const fractional = exp.sub(new Dec(integer));
  const integerPow = powInt(base, integer);
  if (fractional.isZero()) {
    return integerPow;
  }
  const fractionalPow = powApprox(base, fractional, powPrecision);
  return integerPow.mul(fractionalPow);
}

export function absDifferenceWithSign(a, b) {
  if (a.gte(b)) {
    return [a.sub(b), false];
  } else {
    return [b.sub(a), true];
  }
}

export function powApprox(base, exp, precision) {
  if (exp.isZero()) {
    return new Dec(0);
  }
  const a = exp;
  const [x, xneg] = absDifferenceWithSign(base, oneDec);
  let term = oneDec;
  let sum = oneDec;
  let negative = false;
  // TODO: Document this computation via taylor expansion
  // eslint-disable-next-line no-plusplus
  for (let i = 1; term.gte(precision); i++) {
    const bigK = oneDec.mul(new Dec(i.toString()));
    const [c, cneg] = absDifferenceWithSign(a, bigK.sub(oneDec));
    term = term.mul(c.mul(x));
    term = term.quo(bigK);
    if (term.isZero()) {
      break;
    }
    if (xneg) {
      negative = !negative;
    }
    if (cneg) {
      negative = !negative;
    }
    if (negative) {
      sum = sum.sub(term);
    } else {
      sum = sum.add(term);
    }
  }
  return sum;
}
