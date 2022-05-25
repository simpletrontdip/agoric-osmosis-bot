import { E } from '@agoric/eventual-send';
import { Far } from '@agoric/marshal';

import { Dec } from './math/decimal';
import { calcSpotPrice } from './math';

const zeroDec = new Dec(0);

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
    async getSpotPrice(includeSwapFee) {
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
        includeSwapFee ? new Dec(poolParams.swapFee) : zeroDec,
      );
    },
  });
};

harden(makeOsmosisPool);
export { makeOsmosisPool };
