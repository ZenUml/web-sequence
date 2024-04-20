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
      className="px-3 py-2 border-gray-400 border w-full rounded-lg block !no-underline decoration-0 hover:bg-gray-500/20"
    >
      Cancel subscription
    </a>
  );
};

export { CancellationLink };
