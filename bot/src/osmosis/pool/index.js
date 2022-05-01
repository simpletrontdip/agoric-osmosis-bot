"use strict";
exports.__esModule = true;
var unit_1 = require("@keplr-wallet/unit");
var Math = require("./math");
var GAMMPool = /** @class */ (function () {
    function GAMMPool(data) {
        this.data = data;
        this.data = data;
    }
    GAMMPool.calculateSlippageTokenIn = function (spotPriceBefore, tokenIn, slippage) {
        var effectivePrice = spotPriceBefore.mul(slippage.add(new unit_1.Dec(1)));
        return new unit_1.Dec(tokenIn).quo(effectivePrice).truncate();
    };
    GAMMPool.calculateSlippageTokenOut = function (spotPriceBefore, tokenOut, slippage) {
        var effectivePrice = spotPriceBefore.mul(slippage.add(new unit_1.Dec(1)));
        return new unit_1.Dec(tokenOut).mul(effectivePrice).truncate();
    };
    Object.defineProperty(GAMMPool.prototype, "poolParamsRaw", {
        get: function () {
            return this.data.poolParams;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(GAMMPool.prototype, "id", {
        get: function () {
            return this.data.id;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(GAMMPool.prototype, "totalWeight", {
        get: function () {
            return new unit_1.Int(this.data.totalWeight);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(GAMMPool.prototype, "shareDenom", {
        get: function () {
            return this.data.totalShares.denom;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(GAMMPool.prototype, "swapFee", {
        get: function () {
            return new unit_1.Dec(this.data.poolParams.swapFee);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(GAMMPool.prototype, "exitFee", {
        get: function () {
            return new unit_1.Dec(this.data.poolParams.exitFee);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(GAMMPool.prototype, "totalShare", {
        get: function () {
            return new unit_1.Int(this.data.totalShares.amount);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(GAMMPool.prototype, "poolAssets", {
        get: function () {
            return this.data.poolAssets;
        },
        enumerable: true,
        configurable: true
    });
    GAMMPool.prototype.estimateJoinPool = function (shareOutAmount) {
        var tokenIns = [];
        var totalShare = this.totalShare;
        var shareRatio = new unit_1.Dec(shareOutAmount).quo(new unit_1.Dec(totalShare));
        if (shareRatio.lte(new unit_1.Dec(0))) {
            throw new Error('share ratio is zero or negative');
        }
        for (var _i = 0, _a = this.data.poolAssets; _i < _a.length; _i++) {
            var poolAsset = _a[_i];
            var tokenInAmount = shareRatio
                .mul(new unit_1.Dec(poolAsset.token.amount))
                .truncate();
            tokenIns.push(new unit_1.Coin(poolAsset.token.denom, tokenInAmount));
        }
        return {
            tokenIns: tokenIns
        };
    };
    GAMMPool.prototype.estimateJoinSwapExternAmountIn = function (tokenIn) {
        var poolAsset = this.getPoolAsset(tokenIn.denom);
        var shareOutAmount = Math.calcPoolOutGivenSingleIn(new unit_1.Dec(poolAsset.token.amount), new unit_1.Dec(poolAsset.weight), new unit_1.Dec(this.totalShare), new unit_1.Dec(this.totalWeight), tokenIn.amount.toDec(), this.swapFee).truncate();
        return {
            shareOutAmount: shareOutAmount
        };
    };
    GAMMPool.prototype.estimateExitPool = function (shareInAmount) {
        var tokenOuts = [];
        var totalShare = this.totalShare;
        var shareRatio = new unit_1.Dec(shareInAmount).quo(new unit_1.Dec(totalShare));
        if (shareRatio.lte(new unit_1.Dec(0))) {
            throw new Error('share ratio is zero or negative');
        }
        for (var _i = 0, _a = this.data.poolAssets; _i < _a.length; _i++) {
            var poolAsset = _a[_i];
            var tokenOutAmount = shareRatio
                .mul(new unit_1.Dec(poolAsset.token.amount))
                .truncate();
            tokenOuts.push(new unit_1.Coin(poolAsset.token.denom, tokenOutAmount));
        }
        return {
            tokenOuts: tokenOuts
        };
    };
    GAMMPool.prototype.estimateSwapExactAmountIn = function (tokenIn, tokenOutDenom) {
        var inPoolAsset = this.getPoolAsset(tokenIn.denom);
        var outPoolAsset = this.getPoolAsset(tokenOutDenom);
        var spotPriceBefore = Math.calcSpotPrice(new unit_1.Dec(inPoolAsset.token.amount), new unit_1.Dec(inPoolAsset.weight), new unit_1.Dec(outPoolAsset.token.amount), new unit_1.Dec(outPoolAsset.weight), this.swapFee);
        var tokenOutAmount = Math.calcOutGivenIn(new unit_1.Dec(inPoolAsset.token.amount), new unit_1.Dec(inPoolAsset.weight), new unit_1.Dec(outPoolAsset.token.amount), new unit_1.Dec(outPoolAsset.weight), new unit_1.Dec(tokenIn.amount), this.swapFee).truncate();
        var spotPriceAfter = Math.calcSpotPrice(new unit_1.Dec(inPoolAsset.token.amount).add(new unit_1.Dec(tokenIn.amount)), new unit_1.Dec(inPoolAsset.weight), new unit_1.Dec(outPoolAsset.token.amount).sub(new unit_1.Dec(tokenOutAmount)), new unit_1.Dec(outPoolAsset.weight), this.swapFee);
        if (spotPriceAfter.lt(spotPriceBefore)) {
            throw new Error("spot price can't be decreased after swap");
        }
        var effectivePrice = new unit_1.Dec(tokenIn.amount).quo(new unit_1.Dec(tokenOutAmount));
        var slippage = effectivePrice.quo(spotPriceBefore).sub(new unit_1.Dec('1'));
        return {
            tokenOutAmount: tokenOutAmount,
            spotPriceBefore: spotPriceBefore,
            spotPriceAfter: spotPriceAfter,
            slippage: slippage
        };
    };
    GAMMPool.prototype.estimateSwapExactAmountOut = function (tokenInDenom, tokenOut) {
        var inPoolAsset = this.getPoolAsset(tokenInDenom);
        var outPoolAsset = this.getPoolAsset(tokenOut.denom);
        var spotPriceBefore = Math.calcSpotPrice(new unit_1.Dec(inPoolAsset.token.amount), new unit_1.Dec(inPoolAsset.weight), new unit_1.Dec(outPoolAsset.token.amount), new unit_1.Dec(outPoolAsset.weight), this.swapFee);
        var tokenInAmount = Math.calcInGivenOut(new unit_1.Dec(inPoolAsset.token.amount), new unit_1.Dec(inPoolAsset.weight), new unit_1.Dec(outPoolAsset.token.amount), new unit_1.Dec(outPoolAsset.weight), new unit_1.Dec(tokenOut.amount), this.swapFee).truncate();
        var spotPriceAfter = Math.calcSpotPrice(new unit_1.Dec(inPoolAsset.token.amount).add(new unit_1.Dec(tokenInAmount)), new unit_1.Dec(inPoolAsset.weight), new unit_1.Dec(outPoolAsset.token.amount).sub(new unit_1.Dec(tokenOut.amount)), new unit_1.Dec(outPoolAsset.weight), this.swapFee);
        if (spotPriceAfter.lt(spotPriceBefore)) {
            throw new Error("spot price can't be decreased after swap");
        }
        var effectivePrice = new unit_1.Dec(tokenInAmount).quo(new unit_1.Dec(tokenOut.amount));
        var slippage = effectivePrice.quo(spotPriceBefore).sub(new unit_1.Dec('1'));
        return {
            tokenInAmount: tokenInAmount,
            spotPriceBefore: spotPriceBefore,
            spotPriceAfter: spotPriceAfter,
            slippage: slippage
        };
    };
    GAMMPool.prototype.calculateSpotPrice = function (inDenom, outDenom) {
        var inPoolAsset = this.getPoolAsset(inDenom);
        var outPoolAsset = this.getPoolAsset(outDenom);
        return Math.calcSpotPrice(new unit_1.Dec(inPoolAsset.token.amount), new unit_1.Dec(inPoolAsset.weight), new unit_1.Dec(outPoolAsset.token.amount), new unit_1.Dec(outPoolAsset.weight), new unit_1.Dec(this.data.poolParams.swapFee));
    };
    GAMMPool.prototype.calculateSpotPriceWithoutSwapFee = function (inDenom, outDenom) {
        var inPoolAsset = this.getPoolAsset(inDenom);
        var outPoolAsset = this.getPoolAsset(outDenom);
        return Math.calcSpotPrice(new unit_1.Dec(inPoolAsset.token.amount), new unit_1.Dec(inPoolAsset.weight), new unit_1.Dec(outPoolAsset.token.amount), new unit_1.Dec(outPoolAsset.weight), new unit_1.Dec(0));
    };
    GAMMPool.prototype.calculateSlippageSlope = function (inDenom, outDenom) {
        var inPoolAsset = this.getPoolAsset(inDenom);
        var outPoolAsset = this.getPoolAsset(outDenom);
        return Math.calcSlippageSlope(new unit_1.Dec(inPoolAsset.token.amount), new unit_1.Dec(inPoolAsset.weight), new unit_1.Dec(outPoolAsset.weight), this.swapFee);
    };
    GAMMPool.prototype.getPoolAsset = function (denom) {
        var poolAsset = this.data.poolAssets.find(function (poolAsset) {
            return poolAsset.token.denom === denom;
        });
        if (!poolAsset) {
            throw new Error("pool doesn't have the pool asset for " + denom);
        }
        return poolAsset;
    };
    return GAMMPool;
}());
exports.GAMMPool = GAMMPool;
