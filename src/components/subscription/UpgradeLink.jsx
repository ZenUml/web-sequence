import planService from '../../services/planService';

const UpgradeLink = (props) => {
  const checkout = (e) => {
    e.preventDefault();
    props.preActionCallback();

    Paddle.Checkout.open({
      items: [
        {
          priceId: planService.getProductByPlanType(props.planType),
          quantity: 1,
        },
      ],
      customer: {
        email: props.userEmail,
      },
      customData: { userId: props.userId, planType: props.planType },
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
