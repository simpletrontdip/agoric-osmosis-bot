import { E } from '@agoric/eventual-send';
import { Far } from '@agoric/marshal';
import { AmountMath } from '@agoric/ertp';

import { Dec } from './math/decimal';
import { makeAgoricFund, makeAgoricPool } from './agoric.js';

const oneDec = new Dec(1);
const zeroDec = new Dec(0);

const makeOsmosisPool = () => {
  return Far('Osmosis pool', {
    getSpotPrice() {
      return new Dec(335n, 1);
    },
  });
};

const startBot = async ({
  timeAuthority,
  checkInterval = 15n,
  maxRunCount = 2,
  ...args
}) => {
  const osmosisPool = makeOsmosisPool(args);
  const agoricFund = await makeAgoricFund(args);
  const agoricPool = await makeAgoricPool({
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

  /**
   * @param {Brand} swapInBrand
   * @param {Brand} returnedBrand
   * @param currentPrice
   * @param refPrice
   * @returns {{
   *  swapIn: Dec,
   *  minimalReturn: Dec
   * }}
   */
  const findOptimialSwapAmount = async (
    swapInBrand,
    returnedBrand,
    currentPrice,
    refPrice,
  ) => {
    // TODO find the maximum value of each trade, find the righ price to match the spot
    console.log('Finding optimal amount');
    return harden({
      swapIn: 500n,
      minimalReturn: 0n,
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
    console.log('Diff ratio', diffRatio.toString());
    const shouldTrade = diffRatio.abs().gte(priceDiffThreshold);

    if (!shouldTrade) {
      return {
        shouldTrade: false,
      };
    }
    const swapInBrand = diffRatio.gt(zeroDec) ? centralBrand : secondaryBrand;
    const returnedBrand = refPrice.lt(currentPrice)
      ? secondaryBrand
      : centralBrand;

    const { swapIn, minimalReturn } = await findOptimialSwapAmount(
      swapInBrand,
      returnedBrand,
      currentPrice,
      refPrice,
    );
    const swapInAmount = AmountMath.make(swapInBrand, swapIn);
    const expectedReturn = AmountMath.make(returnedBrand, minimalReturn);

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
      'Price here ====>',
      refPrice.toString(),
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
  console.log('Done');
};

harden(startBot);
export default startBot;
