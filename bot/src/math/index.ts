/* eslint-disable no-use-before-define */
import { Dec } from './decimal';
import { Int } from './int';

const powPrecision = new Dec('0.00000001');
const oneDec = new Dec(1);
const twoDec = new Dec(2);
const zeroInt = new Int(0);
const twoInt = new Int(2);

export function calcSlippageSlope(
  tokenBalanceIn: Dec,
  tokenWeightIn: Dec,
  tokenWeightOut: Dec,
  swapFee: Dec,
): Dec {
  return oneDec
    .sub(swapFee)
    .mul(tokenWeightIn.add(tokenWeightOut))
    .sub(twoDec.mul(tokenBalanceIn).mul(tokenWeightOut));
}

export function calcSpotPrice(
  tokenBalanceIn: Dec,
  tokenWeightIn: Dec,
  tokenBalanceOut: Dec,
  tokenWeightOut: Dec,
  swapFee: Dec,
): Dec {
  const number = tokenBalanceIn.quo(tokenWeightIn);
  const denom = tokenBalanceOut.quo(tokenWeightOut);
  const scale = oneDec.quo(oneDec.sub(swapFee));

  return number.quo(denom).mul(scale);
}

export function calcOutGivenIn(
  tokenBalanceIn: Dec,
  tokenWeightIn: Dec,
  tokenBalanceOut: Dec,
  tokenWeightOut: Dec,
  tokenAmountIn: Dec,
  swapFee: Dec,
): Dec {
  const weightRatio = tokenWeightIn.quo(tokenWeightOut);
  let adjustedIn = oneDec.sub(swapFee);
  adjustedIn = tokenAmountIn.mul(adjustedIn);
  const y = tokenBalanceIn.quo(tokenBalanceIn.add(adjustedIn));
  const foo = pow(y, weightRatio);
  const bar = oneDec.sub(foo);
  return tokenBalanceOut.mul(bar);
}

export function calcInGivenOut(
  tokenBalanceIn: Dec,
  tokenWeightIn: Dec,
  tokenBalanceOut: Dec,
  tokenWeightOut: Dec,
  tokenAmountOut: Dec,
  swapFee: Dec,
): Dec {
  const weightRatio = tokenWeightOut.quo(tokenWeightIn);
  const diff = tokenBalanceOut.sub(tokenAmountOut);
  const y = tokenBalanceOut.quo(diff);
  let foo = pow(y, weightRatio);
  foo = foo.sub(oneDec);
  const tokenAmountIn = oneDec.sub(swapFee);
  return tokenBalanceIn.mul(foo).quo(tokenAmountIn);
}

export function calcPoolOutGivenSingleIn(
  tokenBalanceIn: Dec,
  tokenWeightIn: Dec,
  poolSupply: Dec,
  totalWeight: Dec,
  tokenAmountIn: Dec,
  swapFee: Dec,
): Dec {
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
  tokenBalanceIn: Dec,
  tokenWeightIn: Dec,
  poolSupply: Dec,
  totalWeight: Dec,
  poolAmountOut: Dec,
  swapFee: Dec,
): Dec {
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
  tokenBalanceOut: Dec,
  tokenWeightOut: Dec,
  poolSupply: Dec,
  totalWeight: Dec,
  poolAmountIn: Dec,
  swapFee: Dec,
): Dec {
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
  tokenBalanceOut: Dec,
  tokenWeightOut: Dec,
  poolSupply: Dec,
  totalWeight: Dec,
  tokenAmountOut: Dec,
  swapFee: Dec,
): Dec {
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

export function calcOptimalTradeAmount(
  cB: Dec,
  sB: Dec,
  fB: Dec,
  cS: Dec,
  sS: Dec,
  fS: Dec,
): {
  secondaryAmount: Dec;
  centralBuyMaxAmount: Dec;
  centralSellMinAmount: Dec;
  profit: Dec;
} | null {
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
   * Optimal solution (ask Wolfram Alpha)
   * x = (+sqrt((-2 cS fS sS sB + 2 cS sS sB + 2 sS cB sB + 2 fB sS cB sB)^2 - 4 (cS fS sS - cS sS + cB sB + fB cB sB) (cS fS sS sB^2 - cS sS sB^2 + sS^2 cB sB + fB sS^2 cB sB)) + 2 cS fS sS sB - 2 cS sS sB - 2 sS cB sB - 2 fB sS cB sB)/(2 (cS fS sS - cS sS + cB sB + fB cB sB))
   */
  console.log('Input params', {
    cB: cB.toString(4),
    sB: sB.toString(4),
    fB: fB.toString(4),
    cS: cS.toString(4),
    sS: sS.toString(4),
    fS: fS.toString(4),
  });
  // a = (cS fS sS - cS sS + cB sB + fB cB sB)
  const a = cS
    .mul(fS)
    .mul(sS)
    .sub(cS.mul(sS))
    .add(cB.mul(sB))
    .add(fB.mul(cB).mul(sB));
  // -2 cS fS sS sB + 2 cS sS sB + 2 sS cB sB + 2 fB sS cB sB
  const b = twoDec
    .neg()
    .mul(cS)
    .mul(fS)
    .mul(sS)
    .mul(sB)
    .add(twoDec.mul(cS).mul(sS).mul(sB))
    .add(twoDec.mul(sS).mul(cB).mul(sB))
    .add(twoDec.mul(fB).mul(sS).mul(cB).mul(sB));
  // c =  (cS fS sS sB^2 - cS sS sB^2 + sS^2 cB sB + fB sS^2 cB sB)
  const c = cS
    .mul(fS)
    .mul(sS)
    .mul(sB)
    .mul(sB)
    .sub(cS.mul(sS).mul(sB).mul(sB))
    .add(sS.mul(sS).mul(cB).mul(sB))
    .add(fB.mul(sS).mul(sS).mul(cB).mul(sB));

  const deltaRoot = b.mul(b).sub(new Dec(4n).mul(a).mul(c)).sqrt();
  // (-b + sqrt(delta))/2a
  const x = b.neg().add(deltaRoot).quo(twoDec.mul(a));

  const cOut = cS.mul(x).mul(oneDec.sub(fS)).quo(sS.add(x));
  const cIn = cB.mul(x).mul(oneDec.add(fB)).quo(sB.sub(x));

  // P(x)
  const profit = cOut.sub(cIn);

  console.log(
    'Math result ===>',
    'x',
    x.toString(),
    'profit',
    profit.toString(),
    'cIn',
    cIn.toString(),
    'cOut',
    cOut.toString(),
  );

  // check conditions
  const isValid = x.isPositive() && x.lt(sB) && x.lt(sS) && profit.isPositive();

  if (!isValid) {
    console.log('Could not find valid solution in range');
    return null;
  }

  return {
    secondaryAmount: x,
    centralBuyMaxAmount: cIn,
    centralSellMinAmount: cOut,
    profit,
  };
}

function powInt(base: Dec, power: Int): Dec {
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

export function pow(base: Dec, exp: Dec): Dec {
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

export function absDifferenceWithSign(a: Dec, b: Dec): [Dec, boolean] {
  if (a.gte(b)) {
    return [a.sub(b), false];
  } else {
    return [b.sub(a), true];
  }
}

export function powApprox(base: Dec, exp: Dec, precision: Dec): Dec {
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
