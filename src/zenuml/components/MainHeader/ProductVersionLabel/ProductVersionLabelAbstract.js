const ProductVersionLabelAbstract = ({ tooltip, theme, clickHandler }) => {
	const style = {
		'border-radius': '4px',
		padding: '1px 15px 1px 15px'
	};

	const mergedStyle = {...style, ...theme};

	return (
		<i style={mergedStyle}
			 className="flex  flex-v-center  hint--rounded  hint--bottom-left"
			 aria-label={tooltip} onClick={clickHandler}
		>Pro</i>
	);
};

export { ProductVersionLabelAbstract };
