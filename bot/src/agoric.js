import { E } from '@agoric/eventual-send';
import { Far } from '@agoric/marshal';

import { Dec } from './math/decimal';
import { calcSpotPrice } from './math';

// from the code
const SUCCESS_OFFER_MSG = 'Swap successfully completed.';
const BP_PRECISIONS = 4;

const makeAgoricFund = ({
  centralBrand,
  // secondaryBrand,
  centralIssuer,
  secondaryIssuer,
  centralPayment,
  secondaryPayment,
  centralDepositFacetP,
  secondaryDepositFacetP,
}) => {
  let centralFund = centralPayment;
  let secondaryFund = secondaryPayment;

  const updateCentralFund = (payment) => {
    centralFund = payment;
  };

  const updateSecondaryFund = (payment) => {
    secondaryFund = payment;
  };

  return Far('Agoric Bot Fund', {
    async getAmountOf(brand) {
      const isCentral = brand === centralBrand;
      const issuer = isCentral ? centralIssuer : secondaryIssuer;
      const fund = isCentral ? centralFund : secondaryFund;

      return E(issuer).getAmountOf(fund);
    },
    async withdraw(amount) {
      const isCentral = amount.brand === centralBrand;
      console.log(
        'Withdrawing, brand ==>',
        amount.brand,
        isCentral ? 'central' : 'secondary',
      );
      const currentFund = isCentral ? centralFund : secondaryFund;
      const issuer = isCentral ? centralIssuer : secondaryIssuer;
      const updateFund = isCentral ? updateCentralFund : updateSecondaryFund;

      const [payment, remainPayment] = await E(issuer).split(
        currentFund,
        amount,
      );

      updateFund(remainPayment);
      return payment;
    },
    async deposit(payment) {
      const brand = await E(payment).getAllegedBrand();
      const isCentral = brand === centralBrand;

      const currentFund = isCentral ? centralFund : secondaryFund;
      const issuer = isCentral ? centralIssuer : secondaryIssuer;
      const amount = await E(issuer).getAmountOf(payment);

      console.log(
        'Depositing, brand ==>',
        brand,
        isCentral ? 'central' : 'secondary',
        'amount',
        amount.value,
      );
      const updateFund = isCentral ? updateCentralFund : updateSecondaryFund;

      const combined = await E(issuer).combine([currentFund, payment]);

      updateFund(combined);
    },
    async cleanup() {
      console.log('Cleaning up bot fund');
      return Promise.all([
        E(centralDepositFacetP).receive(centralFund),
        E(secondaryDepositFacetP).receive(secondaryFund),
      ]);
    },
  });
};

const makeAgoricPool = ({
  zoe,
  ammAPI,
  ammTerms,
  centralBrand,
  secondaryBrand,
  fund,
}) => {
  return Far('Agoric Bot Pool', {
    getCentralBrand() {
      return centralBrand;
    },
    getSecondaryBrand() {
      return secondaryBrand;
    },
    async getPoolAllocation() {
      return E(ammAPI).getPoolAllocation(secondaryBrand);
    },
    async getSpotPrice() {
      console.log('Agoric pool, getting spot price');
      const allocation = await E(ammAPI).getPoolAllocation(secondaryBrand);
      const centralAmount = allocation.Central;
      const secondaryAmount = allocation.Secondary;

      const oneDec = new Dec(1);

      const swapFeeDec = new Dec(
        ammTerms.poolFeeBP + ammTerms.protocolFeeBP,
        BP_PRECISIONS,
      );

      return calcSpotPrice(
        new Dec(centralAmount.value),
        oneDec,
        new Dec(secondaryAmount.value),
        oneDec,
        swapFeeDec,
      );
    },
    async trade(swapInAmount, expectedReturn) {
      const proposal = harden({
        want: { Out: expectedReturn },
        give: { In: swapInAmount },
      });
      const invitation = await E(ammAPI).makeSwapInInvitation();
      const payments = harden({
        In: await E(fund).withdraw(swapInAmount),
      });

      console.log(
        'Offerring a trade',
        swapInAmount.brand,
        swapInAmount.value,
        '==>',
        expectedReturn.brand,
        expectedReturn.value,
      );

      const seatP = E(zoe).offer(invitation, proposal, payments);
      const pendingPayments = Promise.all([
        E(seatP)
          .getPayout('In')
          .then((payout) => {
            return E(fund).deposit(payout);
          }),
        E(seatP)
          .getPayout('Out')
          .then((payout) => {
            return E(fund).deposit(payout);
          }),
      ]);

      const result = await E(seatP).getOfferResult();
      await pendingPayments;
      return result === SUCCESS_OFFER_MSG;
    },
  });
};

harden(makeAgoricFund);
harden(makeAgoricPool);

export { makeAgoricPool, makeAgoricFund };
