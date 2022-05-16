import { E } from '@agoric/eventual-send';
import { Far } from '@agoric/marshal';
import { AmountMath } from '@agoric/ertp';
import * as unit from '@keplr-wallet/unit';

import { makeAgoricFund, makeAgoricPool } from './agoric.mjs';

const { Dec } = unit;

const startBot = async ({
  timeAuthority,
  checkInterval = 15n,
  maxRunCount = 2,
  ...args
}) => {
  const osmosisPool = Far('Osmosis pool', {
    getSpotPrice() {
      return Promise.resolve(new Dec(12.3));
    },
  });

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

  /**
   * @param {Dec} refPrice
   * @param {Dec} currentPrice
   * @returns boolean
   */
  const isEligibleForTrading = (refPrice, currentPrice) => {
    console.log(
      'Checking price change',
      refPrice.toString(),
      currentPrice.toString(),
    );
    return false;
  };

  /**
   * @returns {{
   *  swapIn: Dec,
   *  minimalReturn: Dec
   * }}
   */
  const findOptimialSwapAmount = async () => {
    console.log('Finding optimal amount');
    return {
      swapIn: new Dec(0),
      minimalReturn: new Dec(0),
    };
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
    if (!isEligibleForTrading(refPrice, currentPrice)) {
      return {
        shouldTrade: false,
      };
    }
    const swapBrand = refPrice.lt(currentPrice) ? centralBrand : secondaryBrand;
    const returnedBrand = refPrice.lt(currentPrice)
      ? secondaryBrand
      : centralBrand;

    const { swapIn, minimalReturn } = await findOptimialSwapAmount();
    const swapInAmount = AmountMath.make(swapBrand, swapIn);
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

    console.log('Price here====>', refPrice, currentPrice);

    const { shouldTrade, swapInAmount, expectedReturn } =
      await calculateTradeAmount(refPrice, currentPrice);

    if (!shouldTrade) {
      // do nothing here
      return;
    }

    const success = await doTradeOnAgoric(swapInAmount, expectedReturn);
    const newPrice = await E(agoricPool).getSpotPrice();

    if (success) {
      console.log('Trade succeeded, new price', newPrice);
    } else {
      console.log('Trade failed, bc of price change', newPrice);
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
  await registerNextWakeupCheck();
  console.log('Done');
};

harden(startBot);
export default startBot;
