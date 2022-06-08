import { E } from '@agoric/eventual-send';
import { Far } from '@agoric/marshal';

import { AmountMath } from '@agoric/ertp';
import { Dec } from './math/decimal';
import { calcSpotPrice } from './math';

const BP_PRECISIONS = 4;
const zeroDec = new Dec(0);
const oneDec = new Dec(1);

const showBrand = (b) => `${b}`.replace(/.object Alleged: (.*) brand./, '$1');

const showAmount = ({ brand, value }) => {
  const b = `${showBrand(brand)}`;
  return `${value} ${b}`;
};

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
        'Withdrawing ==>',
        showBrand(amount.brand),
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
        'Depositing ==>',
        showBrand(brand),
        isCentral ? 'central' : 'secondary',
        'amount',
        amount.value,
      );
      const updateFund = isCentral ? updateCentralFund : updateSecondaryFund;

      const combined = await E(issuer).combine([currentFund, payment]);

      updateFund(combined);
      return amount;
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
  const swapFeeDec = new Dec(
    ammTerms.poolFeeBP + ammTerms.protocolFeeBP,
    BP_PRECISIONS,
  );

  const makePoolTrade = async (invitation, proposal, payments) => {
    let isTradeOk = false;
    const seatP = E(zoe).offer(invitation, proposal, payments);

    const pendingPayments = Promise.all([
      E(seatP)
        .getPayout('In')
        .then((payout) => {
          return E(fund).deposit(payout);
        }),
      E(seatP)
        .getPayout('Out')
        .then(async (payout) => {
          const amount = await E(fund).deposit(payout);

          // Swap out amount should not be empty
          isTradeOk = !AmountMath.isEmpty(amount);
        }),
    ]);

    await E(seatP).getOfferResult();
    await pendingPayments;
    return isTradeOk;
  };

  return Far('Agoric Bot Pool', {
    name() {
      return 'Agoric';
    },
    async getPoolAllocation() {
      return E(ammAPI).getPoolAllocation(secondaryBrand);
    },
    async getSpotPrice(includeSwapFee) {
      const allocation = await E(ammAPI).getPoolAllocation(secondaryBrand);
      const centralAmount = allocation.Central;
      const secondaryAmount = allocation.Secondary;

      return calcSpotPrice(
        new Dec(centralAmount.value),
        oneDec,
        new Dec(secondaryAmount.value),
        oneDec,
        includeSwapFee ? swapFeeDec : zeroDec,
      );
    },
    async sellToken(inAmount, minReturn) {
      // sell secondary coin
      const swapInAmount = AmountMath.make(secondaryBrand, inAmount);
      const swapOutMinAmount = AmountMath.make(centralBrand, minReturn);

      const proposal = harden({
        want: { Out: swapOutMinAmount },
        give: { In: swapInAmount },
      });
      const invitation = await E(ammAPI).makeSwapInInvitation();
      const payments = harden({
        In: await E(fund).withdraw(swapInAmount),
      });

      console.log(
        'Agoric: Selling',
        showAmount(swapInAmount),
        'With min return',
        showAmount(swapOutMinAmount),
      );

      return makePoolTrade(invitation, proposal, payments);
    },
    async buyToken(outAmount, maxSpend) {
      // buy secondary token
      const swapInMaxAmount = AmountMath.make(centralBrand, maxSpend);
      const swapOutAmount = AmountMath.make(secondaryBrand, outAmount);

      const proposal = harden({
        want: { Out: swapOutAmount },
        give: { In: swapInMaxAmount },
      });
      const invitation = await E(ammAPI).makeSwapOutInvitation();
      const payments = harden({
        In: await E(fund).withdraw(swapInMaxAmount),
      });

      console.log(
        'Agoric: Buying',
        showAmount(swapOutAmount),
        'With max spend',
        showAmount(swapInMaxAmount),
      );

      return makePoolTrade(invitation, proposal, payments);
    },
    async shutdown() {
      console.log('Shutting down Agoric pool');
      return E(fund).cleanup();
    },
  });
};

harden(makeAgoricFund);
harden(makeAgoricPool);

export { makeAgoricPool, makeAgoricFund };
