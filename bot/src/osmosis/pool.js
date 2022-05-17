/* eslint-disable max-classes-per-file */
import * as Math from '../math';
import { Int } from '../math/int';
import { Dec } from '../math/decimal';

export class Coin {
  constructor(denom, amount) {
    this.denom = denom;
    this.amount = amount instanceof Int ? amount : new Int(amount);
  }

  static parse(str) {
    const re = new RegExp('([0-9]+)[ ]*([a-zA-Z]+)');
    const execed = re.exec(str);
    if (!execed || execed.length !== 3) {
      throw new Error('Invalid coin str');
    }
    const denom = execed[2];
    const amount = execed[1];
    return new Coin(denom, amount);
  }

  toString() {
    return `${this.amount.toString()}${this.denom}`;
  }
}
export class GAMMPool {
  constructor(data) {
    this.data = data;
  }

  static calculateSlippageTokenIn(spotPriceBefore, tokenIn, slippage) {
    const effectivePrice = spotPriceBefore.mul(slippage.add(new Dec(1)));
    return new Dec(tokenIn).quo(effectivePrice).truncate();
  }

  static calculateSlippageTokenOut(spotPriceBefore, tokenOut, slippage) {
    const effectivePrice = spotPriceBefore.mul(slippage.add(new Dec(1)));
    return new Dec(tokenOut).mul(effectivePrice).truncate();
  }

  get poolParamsRaw() {
    return this.data.poolParams;
  }

  get id() {
    return this.data.id;
  }

  get totalWeight() {
    return new Int(this.data.totalWeight);
  }

  get shareDenom() {
    return this.data.totalShares.denom;
  }

  get swapFee() {
    return new Dec(this.data.poolParams.swapFee);
  }

  get exitFee() {
    return new Dec(this.data.poolParams.exitFee);
  }

  get totalShare() {
    return new Int(this.data.totalShares.amount);
  }

  get poolAssets() {
    return this.data.poolAssets;
  }

  estimateJoinPool(shareOutAmount) {
    const tokenIns = [];
    const totalShare = this.totalShare;
    const shareRatio = new Dec(shareOutAmount).quo(new Dec(totalShare));
    if (shareRatio.lte(new Dec(0))) {
      throw new Error('share ratio is zero or negative');
    }
    for (const poolAsset of this.data.poolAssets) {
      const tokenInAmount = shareRatio
        .mul(new Dec(poolAsset.token.amount))
        .truncate();
      tokenIns.push(new Coin(poolAsset.token.denom, tokenInAmount));
    }
    return {
      tokenIns,
    };
  }

  estimateJoinSwapExternAmountIn(tokenIn) {
    const poolAsset = this.getPoolAsset(tokenIn.denom);
    const shareOutAmount = Math.calcPoolOutGivenSingleIn(
      new Dec(poolAsset.token.amount),
      new Dec(poolAsset.weight),
      new Dec(this.totalShare),
      new Dec(this.totalWeight),
      new Dec(tokenIn.amount),
      this.swapFee,
    ).truncate();
    return {
      shareOutAmount,
    };
  }

  estimateExitPool(shareInAmount) {
    const tokenOuts = [];
    const totalShare = this.totalShare;
    const shareRatio = new Dec(shareInAmount).quo(new Dec(totalShare));
    if (shareRatio.lte(new Dec(0))) {
      throw new Error('share ratio is zero or negative');
    }
    for (const poolAsset of this.data.poolAssets) {
      const tokenOutAmount = shareRatio
        .mul(new Dec(poolAsset.token.amount))
        .truncate();
      tokenOuts.push(new Coin(poolAsset.token.denom, tokenOutAmount));
    }
    return {
      tokenOuts,
    };
  }

  estimateSwapExactAmountIn(tokenIn, tokenOutDenom) {
    const inPoolAsset = this.getPoolAsset(tokenIn.denom);
    const outPoolAsset = this.getPoolAsset(tokenOutDenom);
    const spotPriceBefore = Math.calcSpotPrice(
      new Dec(inPoolAsset.token.amount),
      new Dec(inPoolAsset.weight),
      new Dec(outPoolAsset.token.amount),
      new Dec(outPoolAsset.weight),
      this.swapFee,
    );
    const tokenOutAmount = Math.calcOutGivenIn(
      new Dec(inPoolAsset.token.amount),
      new Dec(inPoolAsset.weight),
      new Dec(outPoolAsset.token.amount),
      new Dec(outPoolAsset.weight),
      new Dec(tokenIn.amount),
      this.swapFee,
    ).truncate();
    const spotPriceAfter = Math.calcSpotPrice(
      new Dec(inPoolAsset.token.amount).add(new Dec(tokenIn.amount)),
      new Dec(inPoolAsset.weight),
      new Dec(outPoolAsset.token.amount).sub(new Dec(tokenOutAmount)),
      new Dec(outPoolAsset.weight),
      this.swapFee,
    );
    if (spotPriceAfter.lt(spotPriceBefore)) {
      throw new Error("spot price can't be decreased after swap");
    }
    const effectivePrice = new Dec(tokenIn.amount).quo(new Dec(tokenOutAmount));
    const slippage = effectivePrice.quo(spotPriceBefore).sub(new Dec('1'));
    return {
      tokenOutAmount,
      spotPriceBefore,
      spotPriceAfter,
      slippage,
    };
  }

  estimateSwapExactAmountOut(tokenInDenom, tokenOut) {
    const inPoolAsset = this.getPoolAsset(tokenInDenom);
    const outPoolAsset = this.getPoolAsset(tokenOut.denom);
    const spotPriceBefore = Math.calcSpotPrice(
      new Dec(inPoolAsset.token.amount),
      new Dec(inPoolAsset.weight),
      new Dec(outPoolAsset.token.amount),
      new Dec(outPoolAsset.weight),
      this.swapFee,
    );
    const tokenInAmount = Math.calcInGivenOut(
      new Dec(inPoolAsset.token.amount),
      new Dec(inPoolAsset.weight),
      new Dec(outPoolAsset.token.amount),
      new Dec(outPoolAsset.weight),
      new Dec(tokenOut.amount),
      this.swapFee,
    ).truncate();
    const spotPriceAfter = Math.calcSpotPrice(
      new Dec(inPoolAsset.token.amount).add(new Dec(tokenInAmount)),
      new Dec(inPoolAsset.weight),
      new Dec(outPoolAsset.token.amount).sub(new Dec(tokenOut.amount)),
      new Dec(outPoolAsset.weight),
      this.swapFee,
    );
    if (spotPriceAfter.lt(spotPriceBefore)) {
      throw new Error("spot price can't be decreased after swap");
    }
    const effectivePrice = new Dec(tokenInAmount).quo(new Dec(tokenOut.amount));
    const slippage = effectivePrice.quo(spotPriceBefore).sub(new Dec('1'));
    return {
      tokenInAmount,
      spotPriceBefore,
      spotPriceAfter,
      slippage,
    };
  }

  calculateSpotPrice(inDenom, outDenom) {
    const inPoolAsset = this.getPoolAsset(inDenom);
    const outPoolAsset = this.getPoolAsset(outDenom);
    return Math.calcSpotPrice(
      new Dec(inPoolAsset.token.amount),
      new Dec(inPoolAsset.weight),
      new Dec(outPoolAsset.token.amount),
      new Dec(outPoolAsset.weight),
      new Dec(this.data.poolParams.swapFee),
    );
  }

  calculateSpotPriceWithoutSwapFee(inDenom, outDenom) {
    const inPoolAsset = this.getPoolAsset(inDenom);
    const outPoolAsset = this.getPoolAsset(outDenom);
    return Math.calcSpotPrice(
      new Dec(inPoolAsset.token.amount),
      new Dec(inPoolAsset.weight),
      new Dec(outPoolAsset.token.amount),
      new Dec(outPoolAsset.weight),
      new Dec(0),
    );
  }

  calculateSlippageSlope(inDenom, outDenom) {
    const inPoolAsset = this.getPoolAsset(inDenom);
    const outPoolAsset = this.getPoolAsset(outDenom);
    return Math.calcSlippageSlope(
      new Dec(inPoolAsset.token.amount),
      new Dec(inPoolAsset.weight),
      new Dec(outPoolAsset.weight),
      this.swapFee,
    );
  }

  getPoolAsset(denom) {
    const poolAsset = this.data.poolAssets.find((p) => {
      return p.token.denom === denom;
    });
    if (!poolAsset) {
      throw new Error(`pool doesn't have the pool asset for ${denom}`);
    }
    return poolAsset;
  }
}
