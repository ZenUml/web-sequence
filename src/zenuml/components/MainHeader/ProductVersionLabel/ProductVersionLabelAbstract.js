const ProductVersionLabelAbstract = ({ tooltip, style, clickHandler }) => {
	const styleTemplate = {
		padding: '1px 15px 1px 15px'
	};

	const mergedStyle = {...styleTemplate, ...style};

	//可选 .btn  .btn--dark .btn--primary.  你们试试看下效果。
	//或者看看还有什么 css class 可用
	//但是依然需要inline 覆盖颜色和 padding
	return (
		<i style={mergedStyle}
			 className="btn flex  flex-v-center  hint--rounded  hint--bottom-left"
			 aria-label={tooltip} onClick={clickHandler}
		>Pro</i>
	);
};

export { ProductVersionLabelAbstract };
