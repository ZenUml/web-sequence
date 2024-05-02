import planService from '../../services/planService';

const UpgradeLink = (props) => {
  const checkout = (e) => {
    //e.preventDefault();
    //props.preActionCallback();

    let itemsList = [
      {
        priceId: 'pri_01hwwezba0hte3vyw1cpv9km8w', //Plus-Monthly
        quantity: 1,
      },
      // ,
      // {
      //   priceId: 'pri_01hwh7xf9fhp00vhpwyhv3vdss', //Plus-Yearly
      //   quantity: 1,
      // },
    ];
    Paddle.Checkout.open({
      items: itemsList,
      settings: {
        displayMode: 'overlay',
        frameTarget: 'checkout-container',
        frameInitialHeight: '450',
        frameStyle:
          'width: 100%; min-width: 312px; background-color: transparent; border: none;',
      },
    });
  };

  return (
    <a
      className="mt-2 block w-full bg-blue-500 border border-transparent rounded-md py-2 text-sm text-center hover:no-underline"
      href="#"
      onClick={checkout}
    >
      {props.upgradeBtnName}
    </a>
  );
};

export { UpgradeLink };
