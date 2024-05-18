import planService from '../../services/planService';
import userService from '../../services/user_service';

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
      successCallback: () => {
        alert('Please refresh the page later to display subscriptions.');
        props.postActionCallback();
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
