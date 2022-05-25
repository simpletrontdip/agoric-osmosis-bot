import { E } from '@agoric/eventual-send';
import { Far } from '@agoric/marshal';
import { AmountMath } from '@agoric/ertp';

import { Dec } from './math/decimal';
import { makeOsmosisPool } from './osmosis';
import { makeAgoricFund, makeAgoricPool } from './agoric.js';

const oneDec = new Dec(1);
const oneHundred = new Dec(100);
const oneExp6 = new Dec(1_000_000n);

const isDebugging = false;
const AGORIC_AMOUNT_PRECISION = 6;

const makeAmountFromDec = (brand, decVal) => {
  const value = BigInt(decVal.mul(oneExp6).round().toString());
  return AmountMath.make(brand, value);
};

const startBot = async ({
  timeAuthority,
  checkInterval = 15n,
  maxRunCount = 5,
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
  const xyDiffThreshold = new Dec(5n, 4); // 0.005%
  const priceDiffThreshold = new Dec(5n, 4); // 0.005% diff
  const expectedReturnScale = oneDec.sub(new Dec(5n, 2));

  const assertDiffWithinThreshold = (name, currVal, newVal, threshold) => {
    const diff = currVal.sub(newVal).abs();
    const diffRate = diff.quo(currVal).mul(oneHundred);

    if (isDebugging) {
      console.log(
        name,
        'diff:',
        diff.toString(),
        'diffRate(%):',
        diffRate.toString(),
      );
    }

    assert(
      diffRate.lte(threshold),
      `${name} violated, diffRate: ${diffRate.toString()}, expected < ${threshold.toString()}`,
    );
  };

  /**
   * @param {Dec} refPrice
   * @returns {{
   *  swapInAmount: Amount,
   *  expectedReturn: Amount
   * }}
   */
  const findOptimalSwapAmount = async (refPrice) => {
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

    // We have
    // (Central + dCentral)(Secondary + dSecondary) = Central * Secondary
    // (Central + dCentral)/(Secondary + dSecondary) = refPrice

    // solve it (with dCentral * dSecondary < 0)
    // dCentral = sqrt(Central * Secondary * refPrice) - Central
    // dSecondary = sqrt(Central * Secondary / refPrice) - Secondary

    const XY = centralAmountDec.mul(secondaryAmountDec);
    const dCentralAmount = XY.mul(refPrice).sqrt().sub(centralAmountDec);
    const dSecondaryAmount = XY.quo(refPrice).sqrt().sub(secondaryAmountDec);

    const newCentralAmount = centralAmountDec.add(dCentralAmount);
    const newSecondaryAmount = secondaryAmountDec.add(dSecondaryAmount);
    const newXY = newCentralAmount.mul(newSecondaryAmount);
    const newPrice = newCentralAmount.quo(newSecondaryAmount);

    assertDiffWithinThreshold('XyInvariant', XY, newXY, xyDiffThreshold);
    assertDiffWithinThreshold(
      'RefPrice',
      refPrice,
      newPrice,
      priceDiffThreshold,
    );

    assert(
      dCentralAmount.mul(dSecondaryAmount).isNegative(),
      `Something wrong, swap amounts seem not correct dCentral ${dCentralAmount.toString()}, dSecondary ${dSecondaryAmount.toString()}`,
    );

    const shouldDepositCentral = dCentralAmount.isPositive();

    const swapIn = shouldDepositCentral ? dCentralAmount : dSecondaryAmount;
    const swapInBrand = shouldDepositCentral ? centralBrand : secondaryBrand;

    const minimalReturn = shouldDepositCentral
      ? dSecondaryAmount.neg()
      : dCentralAmount.neg();
    const returnedBrand = shouldDepositCentral ? secondaryBrand : centralBrand;

    console.log(
      'Result, swapIn:',
      swapIn.toString(AGORIC_AMOUNT_PRECISION),
      'minimalReturn:',
      minimalReturn.toString(AGORIC_AMOUNT_PRECISION),
      'scale',
      expectedReturnScale.toString(),
    );

    const swapInAmount = makeAmountFromDec(swapInBrand, swapIn);
    const expectedReturn = makeAmountFromDec(
      returnedBrand,
      minimalReturn.mul(expectedReturnScale),
    );

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
    console.log('Checking price change');

    const diffRate = currentPrice.quo(refPrice).sub(oneDec).mul(oneHundred);
    console.log('Diff rate(%)', diffRate.toString());
    const shouldTrade = diffRate.abs().gte(priceDiffThreshold);

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
        'ref price',
        refPrice.toString(),
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
    console.log('Registering next wakeup call (', count, ') at', checkAfter);

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

  console.log('Starting the bot, debug:', isDebugging);
  if (isDebugging) {
    await checkAndActOnPriceChanges();
    await E(agoricFund).cleanup();
  } else {
    await registerNextWakeupCheck();
  }

  console.log('Done');
};

harden(startBot);
export default startBot;
