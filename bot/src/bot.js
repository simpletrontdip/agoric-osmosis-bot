import { E } from '@agoric/eventual-send';
import { Far } from '@agoric/marshal';

import { Dec } from './math/decimal';
import { calcOptimalTradeAmount } from './math/index.js';
import { makeOsmosisPool } from './osmosis.js';
import { makeAgoricFund, makeAgoricPool } from './agoric.js';

const oneDec = new Dec(1);
const oneHundred = new Dec(100);
const oneExp6 = new Dec(1_000_000n);

const isDebugging = true;
// const AGORIC_AMOUNT_PRECISION = 6;

const decToMicroNumber = (dec) => {
  return BigInt(dec.mul(oneExp6).round().toString());
};

const startBot = async ({
  timeAuthority,
  checkInterval = 10n,
  maxRunCount = 10,
  arbitrageOptions = {
    maxTradeAmount: 1000_000_000n,
    minTradeAmount: 1_000_000n,
    smoothTradeRate: new Dec(5, 3),
  },
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

  let count = 0;
  const priceDiffThreshold = new Dec(50n, 4); // 0.05% diff
  const minProfitThreshold = new Dec(50, 2); // 0.5 usdc
  const smoothTradeRate = arbitrageOptions.smoothTradeRate || new Dec(5, 3); // 0.05

  const shutdown = async () => {
    console.log('Shutdown bot');
    return Promise.all([E(agoricPool).shutdown(), E(osmosisPool).shutdown()]);
  };

  const findOptimalSwapAmount = async (buyPool, sellPool) => {
    console.log('Finding optimal amount');

    const [buyPoolData, sellPoolData] = await Promise.all([
      E(buyPool).getPoolData(),
      E(sellPool).getPoolData(),
    ]);

    const {
      central: { amount: cB },
      secondary: { amount: sB },
      swapFee: fB,
    } = buyPoolData;
    const {
      central: { amount: cS },
      secondary: { amount: sS },
      swapFee: fS,
    } = sellPoolData;

    return calcOptimalTradeAmount(cB, sB, fB, cS, sS, fS, arbitrageOptions);
  };

  const calculateTradeParams = async (osmosisPrice, agoricPrice) => {
    console.log('Checking price change');

    const diffRate = agoricPrice.quo(osmosisPrice).sub(oneDec).mul(oneHundred);
    console.log('Diff rate(%)', diffRate.toString());
    const shouldTrade = diffRate.abs().gte(priceDiffThreshold);

    if (!shouldTrade) {
      console.log('Price diff is not worth trading');
      return {
        shouldTrade: false,
      };
    }

    const isAgoricCheaper = diffRate.isNegative();
    const buyPool = isAgoricCheaper ? agoricPool : osmosisPool;
    const sellPool = isAgoricCheaper ? osmosisPool : agoricPool;

    const solution = await findOptimalSwapAmount(buyPool, sellPool);

    if (!solution) {
      return {
        shouldTrade: false,
      };
    }

    const {
      secondaryAmount,
      centralBuyMaxAmount,
      centralSellMinAmount,
      profit,
    } = solution;

    console.log(
      'Found a solution =======>',
      'Token amount',
      secondaryAmount.toString(4),
      'Max spend',
      centralBuyMaxAmount.toString(4),
      'Min return',
      centralSellMinAmount.toString(4),
      'Profit(USD)',
      profit.toString(4),
    );

    if (profit.lt(minProfitThreshold)) {
      console.log('Profit might not cover gas fee');
      return {
        shouldTrade: false,
      };
    }

    return {
      shouldTrade: true,
      secondaryAmount: decToMicroNumber(secondaryAmount),
      centralBuyMaxAmount: decToMicroNumber(
        centralBuyMaxAmount.mul(oneDec.add(smoothTradeRate)),
      ),
      centralSellMinAmount: decToMicroNumber(
        centralSellMinAmount.mul(oneDec.sub(smoothTradeRate)),
      ),
      buyPool,
      sellPool,
    };
  };

  const doArbitrage = async (
    secondaryAmount,
    centralBuyMaxAmount,
    centralSellMinAmount,
    buyPool,
    sellPool,
  ) => {
    console.log('Start arbitraging');

    const [buySuccess, sellSuccess] = await Promise.all([
      E(buyPool).buyToken(
        secondaryAmount,
        centralBuyMaxAmount || 10n * secondaryAmount,
      ),
      E(sellPool).sellToken(secondaryAmount, centralSellMinAmount || 1n),
    ]);

    console.log('Done');
    return buySuccess && sellSuccess;
  };

  const checkAndActOnPriceChanges = async () => {
    console.log('Checking the prices...');

    const [osmosisPrice, agoricPrice] = await Promise.all([
      E(osmosisPool).getSpotPrice(),
      E(agoricPool).getSpotPrice(),
    ]);

    console.log(
      'Price ====>',
      'osmosis',
      osmosisPrice.toString(),
      'agoric',
      agoricPrice.toString(),
    );

    const {
      shouldTrade,
      secondaryAmount,
      centralBuyMaxAmount,
      centralSellMinAmount,
      buyPool,
      sellPool,
    } = await calculateTradeParams(osmosisPrice, agoricPrice);

    if (!shouldTrade) {
      // do nothing here
      console.log('Ignoring...');
      return;
    }

    const success = await doArbitrage(
      secondaryAmount,
      centralBuyMaxAmount,
      centralSellMinAmount,
      buyPool,
      sellPool,
    );
    const [osmosisNewPrice, agoricNewPrice] = await Promise.all([
      E(osmosisPool).getSpotPrice(),
      E(agoricPool).getSpotPrice(),
    ]);

    console.log(
      'Trade',
      success ? 'succeed' : 'failed',
      '===> NewPrice',
      'osmosis',
      osmosisNewPrice.toString(),
      'agoric',
      agoricNewPrice.toString(),
    );
  };

  const registerNextWakeupCheck = async () => {
    count += 1;

    if (count > maxRunCount) {
      console.log('Max check reached, exiting...');
      await shutdown();

      console.log('Done');
      return;
    }

    const currentTs = await E(timeAuthority).getCurrentTimestamp();
    const checkAfter = currentTs + checkInterval;
    console.log(
      `==> ((${count})) <== Registering next wakeup call at`,
      checkAfter,
    );

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
    await shutdown();
  } else {
    await registerNextWakeupCheck();
  }

  console.log('Done');
};

harden(startBot);
export default startBot;
