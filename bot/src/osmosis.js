import { E } from '@agoric/eventual-send';
import { Far } from '@agoric/marshal';

import { Dec } from './math/decimal';
import { calcSpotPrice } from './math';

const zeroDec = new Dec(0);

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

  let poolData = null;

  const updatePoolData = async () => {
    const data = await E(osmosisClient).getPoolData(poolId);
    poolData = data.pool;
  };

  return Far('Osmosis pool', {
    name() {
      return 'Osmosis';
    },
    async getPoolData() {
      return poolData;
    },
    async getSpotPrice(includeSwapFee) {
      await updatePoolData();
      const { poolAssets, poolParams } = poolData;
      const inPoolAsset = poolAssets.find(
        (p) => p.token.denom === centralDenom,
      );
      const outPoolAsset = poolAssets.find(
        (p) => p.token.denom === secondaryDenom,
      );

      assert(inPoolAsset, `Pool asset for ${centralDenom} could not be found`);
      assert(
        outPoolAsset,
        `Pool asset for ${secondaryDenom} could not be found`,
      );

      return calcSpotPrice(
        new Dec(inPoolAsset.token.amount),
        new Dec(inPoolAsset.weight),
        new Dec(outPoolAsset.token.amount),
        new Dec(outPoolAsset.weight),
        includeSwapFee ? new Dec(poolParams.swapFee) : zeroDec,
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
