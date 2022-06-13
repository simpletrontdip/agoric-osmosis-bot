import _m0 from 'protobufjs/minimal.js';
import Long from 'long';
import {
  createProtobufRpcClient,
  SigningStargateClient,
  defaultRegistryTypes,
} from '@cosmjs/stargate';
import { DirectSecp256k1HdWallet, Registry } from '@cosmjs/proto-signing';
import {
  QuerySpotPriceRequest,
  QuerySpotPriceResponse,
} from 'osmojs/main/proto/osmosis/gamm/v1beta1/query.js';
import {
  registry,
  MessageComposer,
} from 'osmojs/main/proto/osmosis/gamm/v1beta1/tx.registry.js';

// import { initClient } from './plugin.js';

const DEFAULT_MNEMONIC =
  'notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius';
const DEFAULT_OSMOSIS_RPC = 'http://localhost:26657';
const DEFAULT_OSMOSIS_LCD = 'http://localhost:1337';

const stdFee = {
  amount: [],
  gas: '250000',
};

const initClient = async (mnemonic, rpcEndpoint) => {
  const offlineSigner = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: 'osmo',
  });
  const accounts = await offlineSigner.getAccounts();
  const address = accounts[0].address;

  const osmo = await SigningStargateClient.connectWithSigner(
    rpcEndpoint,
    offlineSigner,
    {
      registry: new Registry([...defaultRegistryTypes, ...registry]),
    },
  );
  console.log('Osmo address', address);
  return { osmo, address };
};

const { osmo, address } = await initClient(
  DEFAULT_MNEMONIC,
  DEFAULT_OSMOSIS_RPC,
  DEFAULT_OSMOSIS_LCD,
);

const rpc = createProtobufRpcClient(osmo.getQueryClient());

console.log('Addr', address);

const getBalance = async () => {
  const result = await osmo.getBalance(address, 'uusdc');
  console.log('Balance', result);
  return result;
};

const getSpotPrice = async () => {
  const msg = QuerySpotPriceRequest.encode({
    poolId: Long.fromString('1'),
    tokenInDenom: 'uusdc',
    tokenOutDenom: 'uosmo',
  }).finish();

  const result = await rpc
    .request('osmosis.gamm.v1beta1.Query', 'SpotPrice', msg)
    .then((data) => QuerySpotPriceResponse.decode(new _m0.Reader(data)));

  console.log('Decoded', result);
  return result;
};

const swapInOsmo = async (amount, minReturn) => {
  console.log('Selling OSMO', amount);
  const swapMsg = MessageComposer.withTypeUrl.swapExactAmountIn({
    sender: address,
    routes: [
      {
        poolId: Long.fromString('1'),
        tokenOutDenom: 'uusdc',
      },
    ],
    tokenIn: {
      denom: 'uosmo',
      amount: (amount * 1_000_000).toString(),
    },
    tokenOutMinAmount: (minReturn ? minReturn * 1_000_000 : 1).toString(),
  });
  console.log('Swap detail', swapMsg);

  const result = await osmo.signAndBroadcast(address, [swapMsg], stdFee);
  console.log(
    'Broadcasted',
    result.code ? 'failed' : 'succeeded',
    result.transactionHash,
  );
  return result;
};

const swapOutOsmo = async (amount, maxSpend) => {
  console.log('Buying OSMO', amount);
  const swapMsg = MessageComposer.withTypeUrl.swapExactAmountOut({
    sender: address,
    routes: [
      {
        poolId: Long.fromString('1'),
        tokenInDenom: 'uusdc',
      },
    ],
    tokenOut: {
      denom: 'uosmo',
      amount: (amount * 1_000_000).toString(),
    },
    tokenInMaxAmount: (maxSpend ? maxSpend * 1_000_000 : 1).toString(),
  });
  console.log('Swap detail', swapMsg);

  const result = await osmo.signAndBroadcast(address, [swapMsg], stdFee);
  console.log(
    'Broadcasted',
    result.code ? 'failed' : 'succeeded',
    result.transactionHash,
  );
  return result;
};

const { amount: oldAmount } = await getBalance();
const { spotPrice: oldPrice } = await getSpotPrice();

// eslint-disable-next-line no-undef
if (process.env.MODE === 'sell') {
  await swapInOsmo(1000);
} else {
  await swapOutOsmo(1000, 10000);
}

const { amount: newAmount } = await getBalance();
const { spotPrice: newPrice } = await getSpotPrice();

console.log(
  'Prices',
  oldPrice,
  newPrice,
  'Rate(%)',
  ((newPrice - oldPrice) / oldPrice) * 100,
);
console.log(
  'Balance',
  oldAmount,
  newAmount,
  'Diff',
  newAmount - oldAmount,
  'Rate(%)',
  ((newAmount - oldAmount) / oldAmount) * 100,
);
