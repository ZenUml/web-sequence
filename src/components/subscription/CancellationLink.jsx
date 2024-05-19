import mixpanel from '../../services/mixpanel';

const CancellationLink = (props) => {
  const handleClick = () => {
    mixpanel.track({ event: 'cancelSubscription', category: 'ui' });
  };

  return (
    <a
      href={props.cancelUrl}
      onClick={handleClick}
      target="_blank"
      className="no-underline mt-2 block w-full bg-red-500 border border-transparent rounded-md py-2 text-sm text-center hover:no-underline"
    >
      Cancel subscription
    </a>
  );
};

export { CancellationLink };
