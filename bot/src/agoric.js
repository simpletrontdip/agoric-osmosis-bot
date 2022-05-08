import { E } from '@agoric/eventual-send';
import { Far } from '@agoric/marshal';
import { Dec } from '@keplr-wallet/unit';

import { calcSpotPrice } from './math';

// from the code
const SUCCESS_OFFER_MSG = 'Swap successfully completed.';

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
    async withdraw(amount) {
      const isCentral = amount.brand === centralBrand;
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
      const isCentral = payment.getAllegedBrand() === centralBrand;
      const currentFund = isCentral ? centralFund : secondaryFund;
      const issuer = isCentral ? centralIssuer : secondaryIssuer;
      const updateFund = isCentral ? updateCentralFund : updateSecondaryFund;

      const combined = await E(issuer).combine([currentFund, payment]);

      updateFund(combined);
    },
    async cleanup() {
      return Promise.all([
        E(centralDepositFacetP).deposit(centralFund),
        E(secondaryDepositFacetP).deposit(secondaryFund),
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
    async getSpotPrice() {
      const allocation = await E(ammAPI).getPoolAllocation(secondaryBrand);
      const centralAmount = allocation.Central;
      const secondaryAmount = allocation.Secondary;

      const oneDec = new Dec(1);
      const swapFeeDec = new Dec(
        ammTerms.poolFeeBP + ammTerms.protocolFeeBP,
      ).quo(new Dec(10_000n));

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

      const seatP = E(zoe).offer(invitation, proposal, payments);

      E(seatP)
        .getPayouts()
        .then(async (payouts) => {
          // get our money back
          const swapInRemain = payouts.In;
          const swapOutPayment = payouts.Out;

          return Promise.all([
            E(fund).deposit(swapInRemain),
            E(fund).deposit(swapOutPayment),
          ]);
        });

      const result = await E(seatP).getOfferResult();

      return result === SUCCESS_OFFER_MSG;
    },
  });
};

harden(makeAgoricFund);
harden(makeAgoricPool);

export { makeAgoricPool, makeAgoricFund };
