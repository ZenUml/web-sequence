const ProductVersionLabelAbstract = ({ className, tooltip, style, clickHandler }) => {
	const styleTemplate = {
		padding: '1px 15px 1px 15px'
	};

	const mergedStyle = {...styleTemplate, ...style};

	const classNames = "prod-version btn flex  flex-v-center  hint--rounded  hint--bottom-left" + " " + className
	return (
		<i style={mergedStyle}
			 className={classNames}
			 aria-label={tooltip} onClick={clickHandler}
		>Pro</i>
	);
};

export { ProductVersionLabelAbstract };
