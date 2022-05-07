// @ts-check
/* eslint-env node */
// Agoric Dapp api deployment script

import { E } from '@agoric/eventual-send';
import { Dec } from '@keplr-wallet/unit';
import { calcSpotPrice } from './src/math';

import '@agoric/zoe/exported.js';

// deploy.js runs in an ephemeral Node.js outside of swingset. The
// spawner runs within ag-solo, so is persistent.  Once the deploy.js
// script ends, connections to any of its objects are severed.

/**
 * @typedef {Object} DeployPowers The special powers that `agoric deploy` gives us
 * @property {(path: string) => { moduleFormat: string, source: string }} bundleSource
 * @property {(path: string, opts?: any) => Promise<any>} installUnsafePlugin
 * @property {(path: string, format?: any) => string} pathResolve
 */

/**
 * @param {any} homePromise A promise for the references
 * available from REPL home
 * @param {DeployPowers} powers
 */
export default async function deployApi(
  homePromise,
  {
    bundleSource,
    pathResolve,
    // installUnsafePlugin
  },
) {
  // Let's wait for the promise to resolve.
  const home = await homePromise;

  // Unpack the references.
  const { wallet, spawner } = home;

  const poolKeyword = 'ATOM';
  // const mnemonic = process.env.OSMOSIS_MNEMNONIC;
  // const rpcEndpoint = process.env.OSMOSIS_RPC_ENDPOINT;
  // const deploymentId = process.env.OSMOSIS_WATCHED_DSEQ;

  // assert(mnemonic, 'OSMOSIS_MNEMNONIC env variables must not be empty');
  // assert(rpcEndpoint, 'OSMOSIS_RPC_ENDPOINT env variables must not be empty');
  // assert(deploymentId, 'OSMOSIS_WATCHED_DSEQ env variables must not be empty');

  // const osmosisClient = await installUnsafePlugin('./src/osmosis.js', {
  //   mnemonic,
  //   rpcEndpoint,
  // }).catch((e) => console.error(`${e}`));

  // Bundle up the handler code
  const bundle = await bundleSource(pathResolve('./src/agoric.mjs'));

  const walletAdminP = E(wallet).getAdminFacet();
  const configs = await E(walletAdminP).getAgoricNames(
    'uiConfig',
    'VaultFactory',
  );
  const instance = await E(home.board).getValue(configs.AMM_INSTANCE_BOARD_ID);
  const [publicFacet, terms] = await Promise.all([
    E(home.zoe).getPublicFacet(instance),
    E(home.zoe).getTerms(instance),
  ]);

  const secondaryBrand = terms.brands[poolKeyword];
  const allocation = await E(publicFacet).getPoolAllocation(secondaryBrand);
  const centralAmount = allocation.Central;
  const secondaryAmount = allocation.Secondary;

  const oneDec = new Dec(1);
  const swapFeeDec = new Dec(terms.poolFeeBP + terms.protocolFeeBP).quo(
    new Dec(10_000n),
  );

  const spotPrice = calcSpotPrice(
    new Dec(centralAmount.value),
    oneDec,
    new Dec(secondaryAmount.value),
    oneDec,
    swapFeeDec,
  );

  console.log('Spot price here ===>', spotPrice);

  // Install it on the spawner
  const installation = E(spawner).install(bundle);

  // Spawn the function
  await E(installation).spawn({
    // osmosisClient,
    poolKeyword,
    publicFacet,
    terms,
  });
}
