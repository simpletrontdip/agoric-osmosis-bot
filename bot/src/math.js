"use strict";
exports.__esModule = true;
var unit_1 = require("@keplr-wallet/unit");
var powPrecision = new unit_1.Dec('0.00000001');
var oneDec = new unit_1.Dec(1);
var twoDec = new unit_1.Dec(2);
var zeroInt = new unit_1.Int(0);
var twoInt = new unit_1.Int(2);
function calcSlippageSlope(tokenBalanceIn, tokenWeightIn, tokenWeightOut, swapFee) {
    return oneDec
        .sub(swapFee)
        .mul(tokenWeightIn.add(tokenWeightOut))
        .sub(twoDec.mul(tokenBalanceIn).mul(tokenWeightOut));
}
exports.calcSlippageSlope = calcSlippageSlope;
function calcSpotPrice(tokenBalanceIn, tokenWeightIn, tokenBalanceOut, tokenWeightOut, swapFee) {
    var number = tokenBalanceIn.quo(tokenWeightIn);
    var denom = tokenBalanceOut.quo(tokenWeightOut);
    var scale = oneDec.quo(oneDec.sub(swapFee));
    return number.quo(denom).mul(scale);
}
exports.calcSpotPrice = calcSpotPrice;
function calcOutGivenIn(tokenBalanceIn, tokenWeightIn, tokenBalanceOut, tokenWeightOut, tokenAmountIn, swapFee) {
    var weightRatio = tokenWeightIn.quo(tokenWeightOut);
    var adjustedIn = oneDec.sub(swapFee);
    adjustedIn = tokenAmountIn.mul(adjustedIn);
    var y = tokenBalanceIn.quo(tokenBalanceIn.add(adjustedIn));
    var foo = pow(y, weightRatio);
    var bar = oneDec.sub(foo);
    return tokenBalanceOut.mul(bar);
}
exports.calcOutGivenIn = calcOutGivenIn;
function calcInGivenOut(tokenBalanceIn, tokenWeightIn, tokenBalanceOut, tokenWeightOut, tokenAmountOut, swapFee) {
    var weightRatio = tokenWeightOut.quo(tokenWeightIn);
    var diff = tokenBalanceOut.sub(tokenAmountOut);
    var y = tokenBalanceOut.quo(diff);
    var foo = pow(y, weightRatio);
    foo = foo.sub(oneDec);
    var tokenAmountIn = oneDec.sub(swapFee);
    return tokenBalanceIn.mul(foo).quo(tokenAmountIn);
}
exports.calcInGivenOut = calcInGivenOut;
function calcPoolOutGivenSingleIn(tokenBalanceIn, tokenWeightIn, poolSupply, totalWeight, tokenAmountIn, swapFee) {
    var normalizedWeight = tokenWeightIn.quo(totalWeight);
    var zaz = oneDec.sub(normalizedWeight).mul(swapFee);
    var tokenAmountInAfterFee = tokenAmountIn.mul(oneDec.sub(zaz));
    var newTokenBalanceIn = tokenBalanceIn.add(tokenAmountInAfterFee);
    var tokenInRatio = newTokenBalanceIn.quo(tokenBalanceIn);
    // uint newPoolSupply = (ratioTi ^ weightTi) * poolSupply;
    var poolRatio = pow(tokenInRatio, normalizedWeight);
    var newPoolSupply = poolRatio.mul(poolSupply);
    return newPoolSupply.sub(poolSupply);
}
exports.calcPoolOutGivenSingleIn = calcPoolOutGivenSingleIn;
function calcSingleInGivenPoolOut(tokenBalanceIn, tokenWeightIn, poolSupply, totalWeight, poolAmountOut, swapFee) {
    var normalizedWeight = tokenWeightIn.quo(totalWeight);
    var newPoolSupply = poolSupply.add(poolAmountOut);
    var poolRatio = newPoolSupply.quo(poolSupply);
    // uint newBalTi = poolRatio^(1/weightTi) * balTi;
    var boo = oneDec.quo(normalizedWeight);
    var tokenInRatio = pow(poolRatio, boo);
    var newTokenBalanceIn = tokenInRatio.mul(tokenBalanceIn);
    var tokenAmountInAfterFee = newTokenBalanceIn.sub(tokenBalanceIn);
    // Do reverse order of fees charged in joinswap_ExternAmountIn, this way
    //     ``` pAo == joinswap_ExternAmountIn(Ti, joinswap_PoolAmountOut(pAo, Ti)) ```
    // uint tAi = tAiAfterFee / (1 - (1-weightTi) * swapFee) ;
    var zar = oneDec.sub(normalizedWeight).mul(swapFee);
    return tokenAmountInAfterFee.quo(oneDec.sub(zar));
}
exports.calcSingleInGivenPoolOut = calcSingleInGivenPoolOut;
function calcSingleOutGivenPoolIn(tokenBalanceOut, tokenWeightOut, poolSupply, totalWeight, poolAmountIn, swapFee) {
    var normalizedWeight = tokenWeightOut.quo(totalWeight);
    // charge exit fee on the pool token side
    // pAiAfterExitFee = pAi*(1-exitFee)
    var poolAmountInAfterExitFee = poolAmountIn.mul(oneDec);
    var newPoolSupply = poolSupply.sub(poolAmountInAfterExitFee);
    var poolRatio = newPoolSupply.quo(poolSupply);
    // newBalTo = poolRatio^(1/weightTo) * balTo;
    var tokenOutRatio = pow(poolRatio, oneDec.quo(normalizedWeight));
    var newTokenBalanceOut = tokenOutRatio.mul(tokenBalanceOut);
    var tokenAmountOutBeforeSwapFee = tokenBalanceOut.sub(newTokenBalanceOut);
    // charge swap fee on the output token side
    // uint tAo = tAoBeforeSwapFee * (1 - (1-weightTo) * swapFee)
    var zaz = oneDec.sub(normalizedWeight).mul(swapFee);
    return tokenAmountOutBeforeSwapFee.mul(oneDec.sub(zaz));
}
exports.calcSingleOutGivenPoolIn = calcSingleOutGivenPoolIn;
function calcPoolInGivenSingleOut(tokenBalanceOut, tokenWeightOut, poolSupply, totalWeight, tokenAmountOut, swapFee) {
    // charge swap fee on the output token side
    var normalizedWeight = tokenWeightOut.quo(totalWeight);
    // uint tAoBeforeSwapFee = tAo / (1 - (1-weightTo) * swapFee) ;
    var zoo = oneDec.sub(normalizedWeight);
    var zar = zoo.mul(swapFee);
    var tokenAmountOutBeforeSwapFee = tokenAmountOut.quo(oneDec.sub(zar));
    var newTokenBalanceOut = tokenBalanceOut.sub(tokenAmountOutBeforeSwapFee);
    var tokenOutRatio = newTokenBalanceOut.quo(tokenBalanceOut);
    // uint newPoolSupply = (ratioTo ^ weightTo) * poolSupply;
    var poolRatio = pow(tokenOutRatio, normalizedWeight);
    var newPoolSupply = poolRatio.mul(poolSupply);
    var poolAmountInAfterExitFee = poolSupply.sub(newPoolSupply);
    // charge exit fee on the pool token side
    // pAi = pAiAfterExitFee/(1-exitFee)
    return poolAmountInAfterExitFee.quo(oneDec);
}
exports.calcPoolInGivenSingleOut = calcPoolInGivenSingleOut;
function powInt(base, power) {
    if (power.equals(zeroInt)) {
        return oneDec;
    }
    var tmp = oneDec;
    for (var i = power; i.gt(new unit_1.Int(1));) {
        if (!i.mod(twoInt).equals(zeroInt)) {
            tmp = tmp.mul(base);
        }
        i = i.div(twoInt);
        base = base.mul(base);
    }
    return base.mul(tmp);
}
function pow(base, exp) {
    // Exponentiation of a negative base with an arbitrary real exponent is not closed within the reals.
    // You can see this by recalling that `i = (-1)^(.5)`. We have to go to complex numbers to define this.
    // (And would have to implement complex logarithms)
    // We don't have a need for negative bases, so we don't include any such logic.
    if (!base.isPositive()) {
        throw new Error('base must be greater than 0');
    }
    // TODO: Remove this if we want to generalize the function,
    // we can adjust the algorithm in this setting.
    if (base.gte(new unit_1.Dec('2'))) {
        throw new Error('base must be lesser than two');
    }
    // We will use an approximation algorithm to compute the power.
    // Since computing an integer power is easy, we split up the exponent into
    // an integer component and a fractional component.
    var integer = exp.truncate();
    var fractional = exp.sub(new unit_1.Dec(integer));
    var integerPow = powInt(base, integer);
    if (fractional.isZero()) {
        return integerPow;
    }
    var fractionalPow = powApprox(base, fractional, powPrecision);
    return integerPow.mul(fractionalPow);
}
exports.pow = pow;
function absDifferenceWithSign(a, b) {
    if (a.gte(b)) {
        return [a.sub(b), false];
    }
    else {
        return [b.sub(a), true];
    }
}
exports.absDifferenceWithSign = absDifferenceWithSign;
function powApprox(base, exp, precision) {
    if (exp.isZero()) {
        return new unit_1.Dec(0);
    }
    var a = exp;
    var _a = absDifferenceWithSign(base, oneDec), x = _a[0], xneg = _a[1];
    var term = oneDec;
    var sum = oneDec;
    var negative = false;
    // TODO: Document this computation via taylor expansion
    for (var i = 1; term.gte(precision); i++) {
        var bigK = oneDec.mul(new unit_1.Dec(i.toString()));
        var _b = absDifferenceWithSign(a, bigK.sub(oneDec)), c = _b[0], cneg = _b[1];
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
        }
        else {
            sum = sum.add(term);
        }
    }
    return sum;
}
exports.powApprox = powApprox;
