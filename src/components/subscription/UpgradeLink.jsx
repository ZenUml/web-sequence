import planService from '../../services/planService';

const UpgradeLink = (props) => {
  const checkout = (e) => {
    e.preventDefault();
    props.preActionCallback();

    Paddle.Checkout.open({
      product: planService.getProductByPlanType(props.planType),
      email: props.userEmail,
      passthrough: JSON.stringify({
        userId: props.userId,
        planType: props.planType,
      }),
      successCallback: props.postActionCallback,
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
