import { E } from '@agoric/eventual-send';

const setupAMM = async (zoe, board, instanceID) => {
  const instance = await E(board).getValue(instanceID);
  const [ammAPI, terms] = await Promise.all([
    E(zoe).getPublicFacet(instance),
    E(zoe).getTerms(instance),
  ]);
  const {
    brands: { Central: centralBrand, ...otherBrands },
  } = terms;
  return {
    instance,
    ammAPI,
    centralBrand,
    otherBrands,
  };
};

const createPool = async () => {
  // const BLDLiquidityIssuer = await E(publicFacet).addPool(BLDIssuer, 'BLD');
  // const aliceProposal = harden({
  //   want: { Liquidity: BLDLiquidity(50n) },
  //   give: {
  //     Secondary: AmountMath.make(BLDBrand, 100n),
  //     Central: AmountMath.make(RUNBrand, 50n),
  //   },
  // });
  // const alicePayments = {
  //   Secondary: aliceBLDPayment,
  //   Central: aliceRUNPayment,
  // };
  // const aliceAddLiquidityInvitation = E(
  //   publicFacet,
  // ).makeAddLiquidityInvitation();
  // const addLiquiditySeat = await E(zoe).offer(
  //   aliceAddLiquidityInvitation,
  //   aliceProposal,
  //   alicePayments,
  // );
};

const doTrade = async () => {
  // const quote = E(publicFacet).getOutputPrice(
  //   AmountMath.make(BLDBrand, 275n),
  //   AmountMath.makeEmpty(ATMBrand),
  // );
  // const saraProposal = harden({
  //   want: { Out: AmountMath.make(BLDBrand, 275n) },
  //   give: { In: AmountMath.make(atmBrand, 220n) },
  // });
  // const swapInvitation = await E(publicFacet).makeSwapOutInvitation();
  // const atmPayment = harden({
  //   In: saraAtmPurse.withdraw(AmountMath.make(atmBrand, 220n)),
  // });
  // const saraSeat = await E(zoe).offer(swapInvitation, saraProposal, atmPayment);
  // const saraResult = await saraSeat.getOfferResult();
  // const BLDProceeds = await E(saraSeat).getPayout('In');
  // const atmRefund = await E(saraSeat).getPayout('Out');
  // const BLDProceedsAmount = E(saraBLDPurse).deposit(BLDProceeds);
  // E(saraAtmPurse).deposit(atmRefund);
};

export { setupAMM, doTrade, createPool };
