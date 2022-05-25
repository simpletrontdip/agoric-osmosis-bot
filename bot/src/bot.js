import { E } from '@agoric/eventual-send';
import { Far } from '@agoric/marshal';
import { AmountMath } from '@agoric/ertp';

import { Dec } from './math/decimal';
import { calcSpotPrice } from './math';
import { makeAgoricFund, makeAgoricPool } from './agoric.js';

const oneDec = new Dec(1);
const oneHundred = new Dec(100);
const oneExp6 = new Dec(1_000_000n);
const AGORIC_AMOUNT_PRECISION = 6;

const makeAmountFromDec = (brand, decVal) => {
  const value = BigInt(decVal.mul(oneExp6).round().toString());
  console.log('Value ===>', value, typeof value);
  return AmountMath.make(brand, value);
};

const makeOsmosisPool = ({ osmosisClient, poolId, inDenom, outDenom }) => {
  assert(poolId, 'poolId is required to watch Osmosis pool');
  assert(inDenom, 'inDenom is required');
  assert(outDenom, 'outDenom is required');

  let poolData = null;

  const updatePoolData = async () => {
    const data = await E(osmosisClient).getPoolData(poolId);
    poolData = data.pool;
  };

  return Far('Osmosis pool', {
    async getPoolData() {
      return poolData;
    },
    async getSpotPrice() {
      await updatePoolData();
      const { poolAssets, poolParams } = poolData;
      const inPoolAsset = poolAssets.find((p) => p.token.denom === inDenom);
      const outPoolAsset = poolAssets.find((p) => p.token.denom === outDenom);

      assert(inPoolAsset, `Pool asset for ${inDenom} could not be found`);
      assert(outPoolAsset, `Pool asset for ${outDenom} could not be found`);

      return calcSpotPrice(
        new Dec(inPoolAsset.token.amount),
        new Dec(inPoolAsset.weight),
        new Dec(outPoolAsset.token.amount),
        new Dec(outPoolAsset.weight),
        new Dec(poolParams.swapFee),
      );
    },
  });
};

const startBot = async ({
  timeAuthority,
  checkInterval = 15n,
  maxRunCount = 3,
  // maxTradeAmount = 10_000_000n,
  ...args
}) => {
  const osmosisPool = makeOsmosisPool(args);
  const agoricFund = makeAgoricFund(args);
  const agoricPool = makeAgoricPool({
    ...args,
    fund: agoricFund,
  });

  assert(osmosisPool, 'Osmosis pool is required');
  assert(agoricPool, 'Agoric pool is required');
  assert(agoricFund, 'Agoric Fund is required');

  const centralBrand = await E(agoricPool).getCentralBrand();
  const secondaryBrand = await E(agoricPool).getSecondaryBrand();

  let count = 0;
  const priceDiffThreshold = new Dec(5n, 4); // 0.5% diff
  const xyDiffThresholdPercentage = new Dec(5n, 4); // 0.005%
  const priceDiffThresholdPercentage = new Dec(5n, 4); // 0.005%

  /**
   * @param {Dec} refPrice
   * @returns {{
   *  swapInAmount: Amount,
   *  expectedReturn: Amount
   * }}
   */
  const findOptimalSwapAmount = async (refPrice) => {
    // We have
    // (Central + dCentral)(Secondary + dSecondary) = Central * Secondary
    // (Central + dCentral)/(Secondary + dSecondary) = refPrice

    // solve it (with dCentral * dSecondary < 0)
    // dCentral = sqrt(Central * Secondary * refPrice) - Central
    // dSecondary = sqrt(Central * Secondary / refPrice) - Secondary

    console.log('Finding optimal amount');
    const allocation = await E(agoricPool).getPoolAllocation();

    const centralAmountDec = new Dec(
      allocation.Central.value,
      AGORIC_AMOUNT_PRECISION,
    );
    const secondaryAmountDec = new Dec(
      allocation.Secondary.value,
      AGORIC_AMOUNT_PRECISION,
    );
    console.log(
      'Allocation ====>',
      centralAmountDec.toString(),
      secondaryAmountDec.toString(),
    );

    const XY = centralAmountDec.mul(secondaryAmountDec);
    const dCentralAmount = XY.mul(refPrice).sqrt().sub(centralAmountDec);
    const dSecondaryAmount = XY.quo(refPrice).sqrt().sub(secondaryAmountDec);

    const newCentralAmount = centralAmountDec.add(dCentralAmount);
    const newSecondaryAmount = secondaryAmountDec.add(dSecondaryAmount);
    const newXY = newCentralAmount.mul(newSecondaryAmount);
    const newPrice = newCentralAmount.quo(newSecondaryAmount);

    const xyDiff = XY.sub(newXY);
    const xyDiffRatio = xyDiff.quo(XY).mul(oneHundred);
    const priceDiff = refPrice.sub(newPrice);
    const priceDiffRatio = priceDiff.quo(refPrice).mul(oneHundred);

    assert(
      xyDiffRatio.lte(xyDiffThresholdPercentage),
      `Something wrong, XY invariant is violated, diffRatio: ${xyDiffRatio}`,
    );

    assert(
      priceDiffRatio.lte(priceDiffThresholdPercentage),
      `Something wrong, priceDiff is not correct, diffRatio: ${priceDiffRatio}`,
    );

    assert(
      dCentralAmount.mul(dSecondaryAmount).isNegative(),
      `Something wrong, swap amounts seem not correct dCentral ${dCentralAmount.toString()}, dSecondary ${dSecondaryAmount.toString()}`,
    );

    console.log(
      'Testing back ===> XY:',
      xyDiff.toString(),
      'rate(%):',
      xyDiffRatio.toString(),
    );

    console.log(
      'Testing back ===> price:',
      priceDiff.toString(),
      'rate(%):',
      priceDiffRatio.toString(),
    );

    console.log(
      'Found value, central',
      dCentralAmount.toString(),
      'secondary',
      dSecondaryAmount.toString(),
    );

    const shouldDepositCentral = dCentralAmount.isPositive();

    const swapIn = shouldDepositCentral ? dCentralAmount : dSecondaryAmount;
    const swapInBrand = shouldDepositCentral ? centralBrand : secondaryBrand;

    const minimalReturn = shouldDepositCentral
      ? dSecondaryAmount.neg()
      : dCentralAmount.neg();
    const returnedBrand = shouldDepositCentral ? secondaryBrand : centralBrand;

    console.log(
      'Swap final result, swapIn:',
      swapIn.toString(AGORIC_AMOUNT_PRECISION),
      'minimalReturn:',
      minimalReturn.toString(AGORIC_AMOUNT_PRECISION),
    );

    const swapInAmount = makeAmountFromDec(swapInBrand, swapIn);
    const expectedReturn = makeAmountFromDec(returnedBrand, minimalReturn);

    return harden({
      swapInAmount,
      expectedReturn,
    });
  };

  /**
   * @param {Dec} refPrice
   * @param {Dec} currentPrice
   *
   * @returns {{
   *   shouldTrade: boolean,
   *   swapInAmount?: Amount
   *   expectedReturn?: Amount
   * }}
   */
  const calculateTradeAmount = async (refPrice, currentPrice) => {
    console.log(
      'Checking price change',
      refPrice.toString(),
      currentPrice.toString(),
    );

    const diffRatio = currentPrice.quo(refPrice).sub(oneDec);
    console.log('Diff ratio', diffRatio.mul(new Dec(100n)).toString(), '%');
    const shouldTrade = diffRatio.abs().gte(priceDiffThreshold);

    if (!shouldTrade) {
      return {
        shouldTrade: false,
      };
    }

    const { swapInAmount, expectedReturn } = await findOptimalSwapAmount(
      refPrice,
    );

    return {
      shouldTrade: true,
      swapInAmount,
      expectedReturn,
    };
  };

  const doTradeOnAgoric = async (swapInAmount, expectedReturn) => {
    console.log('Trading on Agoric', swapInAmount, expectedReturn);

    return E(agoricPool).trade(swapInAmount, expectedReturn);
  };

  const checkAndActOnPriceChanges = async () => {
    console.log('Checking the price...');

    const [refPrice, currentPrice] = await Promise.all([
      E(osmosisPool).getSpotPrice(),
      E(agoricPool).getSpotPrice(),
    ]);

    console.log(
      'Price ====>',
      'osmosis',
      refPrice.toString(),
      'agoric',
      currentPrice.toString(),
    );

    const { shouldTrade, swapInAmount, expectedReturn } =
      await calculateTradeAmount(refPrice, currentPrice);

    if (!shouldTrade) {
      // do nothing here
      console.log('Price diff is not worth trading, ignoring...');
      return;
    }

    const success = await doTradeOnAgoric(swapInAmount, expectedReturn);
    const newPrice = await E(agoricPool).getSpotPrice();

    if (success) {
      console.log(
        'Trade succeeded, new price',
        newPrice.toString(),
        'old price',
        currentPrice.toString(),
      );
    } else {
      console.log(
        'Trade failed, bc of price change',
        newPrice.toString(),
        'old price',
        currentPrice.toString(),
      );
    }
  };

  const registerNextWakeupCheck = async () => {
    count += 1;

    if (count > maxRunCount) {
      console.log('Max check reached, exiting...');
      console.log('Getting back current fund...');
      await E(agoricFund).cleanup();
      console.log('Done');
      return;
    }

    const currentTs = await E(timeAuthority).getCurrentTimestamp();
    const checkAfter = currentTs + checkInterval;
    console.log('Registering next wakeup call at', checkAfter);

    E(timeAuthority)
      .setWakeup(
        checkAfter,
        Far('wakeObj', {
          wake: async () => {
            await checkAndActOnPriceChanges();
            registerNextWakeupCheck();
          },
        }),
      )
      .catch((err) => {
        console.error(
          `Could not schedule the nextWakeupCheck at the deadline ${checkAfter} using this timer ${timeAuthority}`,
        );
        console.error(err);
        throw err;
      });
  };

  console.log('Starting the bot');
  // await registerNextWakeupCheck();
  await checkAndActOnPriceChanges();
  await E(agoricFund).cleanup();

  console.log('Done');
};

harden(startBot);
export default startBot;
