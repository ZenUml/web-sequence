const ProductVersionLabelAbstract = ({ className, tooltip, style, clickHandler }) => {
	const styleTemplate = {};

	const mergedStyle = {...styleTemplate, ...style};

	const classNames = "prod-version btn flex  flex-v-center  hint--rounded  hint--bottom-left" + " " + className
	return (
		<button style={mergedStyle}
			 className={classNames}
			 aria-label={tooltip} onClick={clickHandler}
		>Pro</button>
	);
};

export { ProductVersionLabelAbstract };
