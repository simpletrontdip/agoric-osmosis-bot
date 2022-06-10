import { E } from '@agoric/eventual-send';
import { Far } from '@agoric/marshal';

import { Dec } from './math/decimal';
import { calcSpotPrice } from './math';

const zeroDec = new Dec(0);
const OSMO_PRECISIONS = 6;

const makeOsmosisPool = async ({
  osmosisClient,
  poolId,
  centralDenom,
  secondaryDenom,
}) => {
  assert(poolId, 'poolId is required to watch Osmosis pool');
  assert(centralDenom, 'centralDenom is required');
  assert(secondaryDenom, 'secondaryDenom is required');

  await E(osmosisClient).initialize();

  let rawPoolData = null;

  const updatePoolData = async () => {
    const data = await E(osmosisClient).getPoolData(poolId);
    rawPoolData = data.pool;
  };

  return Far('Osmosis pool', {
    name() {
      return 'Osmosis';
    },
    async balances() {
      const balances = await E(osmosisClient).balances();
      const central = balances.find((token) => token.denom === centralDenom);
      const secondary = balances.find(
        (token) => token.denom === secondaryDenom,
      );

      return {
        central: new Dec(central.amount, OSMO_PRECISIONS),
        secondary: new Dec(secondary.amount, OSMO_PRECISIONS),
      };
    },
    async getPoolData() {
      const { poolAssets, poolParams } = rawPoolData;
      const centralAsset = poolAssets.find(
        (p) => p.token.denom === centralDenom,
      );
      const secondaryAsset = poolAssets.find(
        (p) => p.token.denom === secondaryDenom,
      );
      assert(centralAsset, `Pool asset for ${centralDenom} could not be found`);
      assert(
        secondaryAsset,
        `Pool asset for ${secondaryDenom} could not be found`,
      );

      return {
        central: {
          amount: new Dec(centralAsset.token.amount, OSMO_PRECISIONS),
          weight: new Dec(centralAsset.weight),
        },
        secondary: {
          amount: new Dec(secondaryAsset.token.amount, OSMO_PRECISIONS),
          weight: new Dec(secondaryAsset.weight),
        },
        swapFee: new Dec(poolParams.swapFee),
      };
    },
    async getSpotPrice(includeSwapFee) {
      await updatePoolData();
      const poolData = await this.getPoolData();

      return calcSpotPrice(
        poolData.central.amount,
        poolData.central.weight,
        poolData.secondary.amount,
        poolData.secondary.weight,
        includeSwapFee ? poolData.swapFee : zeroDec,
      );
    },
    async sellToken(inAmount, minReturn) {
      // sell secondary coin
      const inDenom = secondaryDenom;
      const outDenom = centralDenom;

      console.log(
        'Osmosis: Selling',
        inAmount,
        inDenom,
        'With min return',
        minReturn,
        outDenom,
      );

      return E(osmosisClient).swapExactAmountIn(
        poolId,
        inDenom,
        inAmount,
        outDenom,
        minReturn,
      );
    },
    async buyToken(outAmount, maxSpend) {
      // buy secondary coin
      const inDenom = centralDenom;
      const outDenom = secondaryDenom;

      console.log(
        'Osmosis: Buying',
        outAmount,
        outDenom,
        'With max spend',
        maxSpend,
        inDenom,
      );

      return E(osmosisClient).swapExactAmountOut(
        poolId,
        outDenom,
        outAmount,
        inDenom,
        maxSpend,
      );
    },
    async shutdown() {
      console.log('Shutting down Osmosis pool');
    },
  });
};

harden(makeOsmosisPool);
export { makeOsmosisPool };
