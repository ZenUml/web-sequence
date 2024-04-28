const DisabledUpgradeLink = (props) => {
  return (
    <a
      className="no-underline mt-2 block w-full bg-gray-200 text-gray-800 border border-transparent rounded-md py-2 text-sm text-center pointer-events-none cursor-not-allowed hover:no-underline"
      href="#"
    >
      {props.upgradeBtnName}
    </a>
  );
};

export { DisabledUpgradeLink };
