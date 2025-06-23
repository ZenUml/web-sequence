const ProductVersionLabelAbstract = ({
  className,
  tooltip,
  style,
  clickHandler,
}) => {
  const classNames =
    'h-10 flex items-center gap-1.5 px-4 bg-black-600 rounded-lg font-semibold hover:opacity-80 duration-200' +
    ' ' +
    className;
  return (
    <button className={classNames} aria-label={tooltip} onClick={clickHandler}>
      <img src="assets/icon-pro.svg" width={16} />
      Upgrade plan
    </button>
  );
};

export { ProductVersionLabelAbstract };
