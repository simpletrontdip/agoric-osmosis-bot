import { E } from '@agoric/eventual-send';
import * as unit from '@keplr-wallet/unit';
import { calcSpotPrice } from './math';

const Dec = unit.Dec;

const start = async ({ publicFacet, terms, poolKeyword = 'ATOM' }) => {
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

  console.log('Spot price here =====>', spotPrice);
};

harden(start);
export default start;
