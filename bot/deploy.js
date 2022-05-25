// @ts-check
/* eslint-env node */
// Agoric Dapp api deployment script

import { AmountMath } from '@agoric/ertp';
import { E } from '@agoric/eventual-send';

import '@agoric/zoe/exported.js';

const OSMO_DENOM = 'uosmo';
const USDC_DENOM =
  'ibc/D189335C6E4A68B513C10AB227BF1C1D38C746766278BA3EEB4FB14124F1D858';

const arbitrage = harden({
  agoric: {
    fund: {
      Central: {
        purse: 'Agoric RUN currency',
        amount: 1_000_000_000_000n,
      },
      Secondary: {
        purse: 'OSMO to arbitrage',
        ammount: 1_000_000_000_000n,
      },
    },
    pool: {
      keyword: 'OSMO',
      name: 'OSMO/USDC',
    },
  },
  osmosis: {
    pool: {
      id: '678',
      name: 'OSMO/USDC',
      inDenom: USDC_DENOM,
      outDenom: OSMO_DENOM,
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
  { bundleSource, pathResolve, installUnsafePlugin },
) {
  // Let's wait for the promise to resolve.
  const home = await homePromise;

  // Unpack the references.
  const { zoe, board, wallet, chainTimerService, spawner } = home;

  const poolKeyword = arbitrage.agoric.pool.keyword;
  const { id: poolId, inDenom, outDenom } = arbitrage.osmosis.pool;

  const osmosisClient = await installUnsafePlugin('./src/plugin.js', {}).catch(
    (e) => console.error(`${e}`),
  );

  // Bundle up the handler code
  const bundle = await bundleSource(pathResolve('./src/bot.js'));

  const walletAdminP = E(wallet).getAdminFacet();

  const centralPurseP = E(walletAdminP).getPurse(
    arbitrage.agoric.fund.Central.purse,
  );
  const secondaryPurseP = E(walletAdminP).getPurse(
    arbitrage.agoric.fund.Secondary.purse,
  );

  const centralDepositFacetP = E(centralPurseP).getDepositFacet();
  const secondaryDepositFacetP = E(secondaryPurseP).getDepositFacet();

  const arbitrages = await E(walletAdminP).getAgoricNames(
    'uiConfig',
    'VaultFactory',
  );
  const instance = await E(board).getValue(arbitrages.AMM_INSTANCE_BOARD_ID);
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

  // Install it on the spawner
  const installation = E(spawner).install(bundle);

  // Spawn the function
  await E(installation).spawn({
    zoe,
    ammAPI,
    ammTerms,
    centralBrand,
    secondaryBrand,
    centralIssuer,
    secondaryIssuer,
    centralPayment,
    secondaryPayment,
    centralDepositFacetP,
    secondaryDepositFacetP,
    timeAuthority: chainTimerService,
    // osmosis config
    poolId,
    inDenom,
    outDenom,
    osmosisClient,
  });
}
