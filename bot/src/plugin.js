import { Far } from '@agoric/marshal';
import Long from 'long';
import Osmo from 'osmojs';
import axios from 'axios';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { MessageComposer } from 'osmojs/main/proto/osmosis/gamm/v1beta1/tx.registry.js';

const DEFAULT_MNEMONIC =
  'notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius';
const DEFAULT_OSMOSIS_RPC = 'http://localhost:26657';
const DEFAULT_OSMOSIS_LCD = 'http://localhost:1337';

const DEFAULT_FEE = {
  amount: [],
  gas: '250000',
};

const initClient = async (mnemonic, rpcEndpoint, lcdEndpoint) => {
  const offlineSigner = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: 'osmo',
  });
  const accounts = await offlineSigner.getAccounts();
  const address = accounts[0].address;

  // signing client
  const osmo = await Osmo.getSigningOsmosisClient({
    rpcEndpoint,
    signer: offlineSigner,
  });

  // query client
  const lcd = axios.create({
    baseURL: lcdEndpoint,
    headers: {
      Accept: 'application/json',
    },
  });

  console.log('Osmo address', address);
  return { osmo, lcd, address };
};

export const bootPlugin = () => {
  // console.error('booting osmoClient');
  // watch {"jsonrpc":"2.0","method":"subscribe","id":1,"params":{"query":"token_swapped.pool_id=1"}}

  return Far('plugin', {
    /**
     * @param {Record<string, any>} opts
     * @returns {OsmosisClient}
     */
    async start(opts) {
      let osmo = null;
      let address = null;
      let lcd = null;

      const mnemonic = opts.mnemonic || DEFAULT_MNEMONIC;
      const rpcEndpoint = opts.rpcEndpoint || DEFAULT_OSMOSIS_RPC;
      const lcdEndpoint = opts.lcdEndpoint || DEFAULT_OSMOSIS_LCD;

      const initialize = async () => {
        if (osmo) {
          console.warn('Client initialized, ignoring...');
          return;
        }
        const result = await initClient(mnemonic, rpcEndpoint, lcdEndpoint);
        osmo = result.osmo;
        address = result.address;
        lcd = result.lcd;
      };

      const queryChainData = async (path, params) => {
        const { data } = await lcd.get(path, params);
        return data;
      };

      const broadcastTxMsg = async (msgType, rawMsg, stdFee = DEFAULT_FEE) => {
        const msgBuilderFn = MessageComposer.withTypeUrl[msgType];
        assert(msgBuilderFn, `Can not find MsgBuilderFn for type ${msgType}`);

        const broadcastedMsg = msgBuilderFn(rawMsg);
        console.log('Broadcasting', broadcastedMsg);
        const result = await osmo.signAndBroadcast(
          address,
          [broadcastedMsg],
          stdFee,
        );
        console.log(
          'Broadcasted',
          result.code ? 'failed' : 'succeeded',
          result.transactionHash,
        );
        return result;
      };

      return Far('osmo-client', {
        initialize,
        getAddress: () => address,
        async balance() {
          assert(osmo, 'Client need to be initalized');
          return osmo.getBalance(address);
        },
        async getPoolData(poolId) {
          assert(poolId, 'Pool id is required');
          return queryChainData(`/osmosis/gamm/v1beta1/pools/${poolId}`);
        },
        async getSpotPrice(poolId, tokenInDenom, tokenOutDenom, withSwapFee) {
          assert(poolId, 'Pool id is required');
          return queryChainData(`osmosis/gamm/v1beta1/pools/${poolId}/prices`, {
            tokenInDenom,
            tokenOutDenom,
            withSwapFee,
          });
        },
        async swapExactAmountIn(
          poolId,
          tokenInDenom,
          tokenInAmount,
          tokenOutDenom,
          tokenOutMinAmount,
        ) {
          assert(osmo, 'Client need to be initalized');
          assert(poolId, 'Pool id is required');

          return broadcastTxMsg('swapExactAmountIn', {
            sender: address,
            routes: [
              {
                poolId: Long.fromString(poolId),
                tokenOutDenom,
              },
            ],
            tokenIn: {
              denom: tokenInDenom,
              amount: tokenInAmount.toString(),
            },
            tokenOutMinAmount: (tokenOutMinAmount || '').toString(),
          });
        },
        async swapExactAmountOut(
          poolId,
          tokenInDenom,
          tokenInMaxAmount,
          tokenOutDenom,
          tokenOutAmount,
        ) {
          assert(osmo, 'Client need to be initalized');

          return broadcastTxMsg('swapExactAmountOut', {
            sender: address,
            routes: [
              {
                poolId: Long.fromString(poolId),
                tokenInDenom,
              },
            ],
            tokenOut: {
              denom: tokenOutDenom,
              amount: tokenOutAmount.toString(),
            },
            tokenInMaxAmount: (tokenInMaxAmount || '').toString(),
          });
        },
      });
    },
  });
};

export { initClient };
