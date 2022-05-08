// @ts-check
/* eslint-env node */
// Agoric Dapp api deployment script

import { AmountMath } from '@agoric/ertp';
import { E } from '@agoric/eventual-send';

import '@agoric/zoe/exported.js';
import { makeAgoricFund, makeAgoricPool } from './src/agoric';

const arbitrage = harden({
  agoric: {
    fund: {
      Central: {
        purse: 'Bot BLD Purse',
        amount: 10_000_000n,
      },
      Secondary: {
        purse: 'Bot ATOM Purse',
        ammount: 1_000_000n,
      },
    },
    pool: {
      keyword: 'ATOM',
    },
  },
  osmosis: {
    pool: {
      id: '1',
    },
  },
});

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
  const { zoe, board, wallet, spawner } = home;

  const poolKeyword = arbitrage.agoric.pool.keyword;

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
  const bundle = await bundleSource(pathResolve('./src/bot.mjs'));

  const walletAdminP = E(wallet).getAdminFacet();

  const centralPurseP = E(walletAdminP).getPurse(
    arbitrage.agoric.fund.Central.purse,
  );
  const secondaryPurseP = E(walletAdminP).getPurse(
    arbitrage.agoric.fund.Secondary.purse,
  );

  const centralDepositFacetP = E(centralPurseP).getDepositFacet();
  const secondaryDepositFacetP = E(secondaryPurseP).getDepositFacet();

  const configs = await E(walletAdminP).getAgoricNames(
    'uiConfig',
    'VaultFactory',
  );
  const instance = await E(board).getValue(configs.AMM_INSTANCE_BOARD_ID);
  const [ammAPI, ammTerms] = await Promise.all([
    E(zoe).getPublicFacet(instance),
    E(zoe).getTerms(instance),
  ]);

  const centralBrand = ammTerms.brands.Central;
  const secondaryBrand = ammTerms.brands[poolKeyword];

  const centralIssuer = ammTerms.issuers.Central;
  const secondaryIssuer = ammTerms.issuers[poolKeyword];

  const centralAmount = AmountMath.make(
    centralBrand,
    arbitrage.agoric.fund.Central.amount,
  );
  const secondaryAmount = AmountMath.make(
    secondaryBrand,
    arbitrage.agoric.fund.Secondary.ammount,
  );

  const centralPayment = await E(centralPurseP).withdraw(centralAmount);
  const secondaryPayment = await E(secondaryPurseP).withdraw(secondaryAmount);

  const agoricFund = makeAgoricFund({
    centralBrand,
    // secondaryBrand,
    centralIssuer,
    secondaryIssuer,
    centralPayment,
    centralDepositFacetP,
    secondaryPayment,
    secondaryDepositFacetP,
  });
  const agoricPool = makeAgoricPool({
    zoe,
    ammAPI,
    ammTerms,
    centralBrand,
    secondaryBrand,
    fund: agoricFund,
  });

  // Install it on the spawner
  const installation = E(spawner).install(bundle);

  // Spawn the function
  const result = await E(installation).spawn({
    // osmosisClient,
    agoricPool,
    agoricFund,
    ammAPI,
    ammTerms,
  });

  console.log('Result here', result);
}
