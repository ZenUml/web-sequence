const ProductVersionLabelAbstract = ({ tooltip, style, clickHandler }) => {
	const styleTemplate = {
		padding: '1px 15px 1px 15px'
	};

	const mergedStyle = {...styleTemplate, ...style};

	return (
		<i style={mergedStyle}
			 className="btn flex  flex-v-center  hint--rounded  hint--bottom-left"
			 aria-label={tooltip} onClick={clickHandler}
		>Pro</i>
	);
};

export { ProductVersionLabelAbstract };
