import { Far } from '@agoric/marshal';
import axios from 'axios';

export const bootPlugin = () => {
  // console.error('booting osmosisClient');
  return Far('Plugin', {
    /**
     * @param {Record<string, any>} opts
     * @returns {OsmosisClient}
     */
    async start(opts) {
      const baseUrl = opts.rpcEndpoint || 'https://lcd-osmosis.keplr.app';

      return Far('osmosis-client', {
        async getPoolData(poolId) {
          assert(poolId, 'Pool id is required to get Pool data');
          const response = await axios.get(
            `${baseUrl}/osmosis/gamm/v1beta1/pools/${poolId}`,
          );
          return response.data;
        },
      });
    },
  });
};
