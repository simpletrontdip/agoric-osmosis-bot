import { Int } from '@keplr-wallet/unit';
import { GAMMPool } from './pool';

const data = {
  '@type': '/osmosis.gamm.v1beta1.Pool',
  address: 'osmo1mw0ac6rwlp5r8wapwk3zs6g29h8fcscxqakdzw9emkne6c8wjp9q0t3v8t',
  id: '1',
  poolParams: {
    swapFee: '0.003000000000000000',
    exitFee: '0.000000000000000000',
    smoothWeightChangeParams: null,
  },
  future_pool_governor: '24h',
  totalShares: {
    denom: 'gamm/pool/1',
    amount: '448219696466620949728727443',
  },
  poolAssets: [
    {
      token: {
        denom:
          'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
        amount: '7818275115863',
      },
      weight: '536870912000000',
    },
    {
      token: {
        denom: 'uosmo',
        amount: '36154223457374',
      },
      weight: '536870912000000',
    },
  ],
  totalWeight: '1073741824000000',
};
const pool = new GAMMPool(data);
const inDenom = 'uosmo';
const outDenom =
  'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2';

const spotPrice = pool.calculateSpotPrice(inDenom, outDenom);
const { tokenOutAmount, spotPriceAfter, spotPriceBefore, slippage } =
  pool.estimateSwapExactAmountIn(
    {
      denom: inDenom,
      amount: new Int(14_000_000),
    },
    outDenom,
  );

console.log('Here ===>', {
  spotPrice,
  tokenOutAmount,
  spotPriceAfter,
  spotPriceBefore,
  slippage,
});
