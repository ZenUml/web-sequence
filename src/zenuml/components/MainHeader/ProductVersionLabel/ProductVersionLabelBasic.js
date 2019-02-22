const ProductVersionLabelBasic = ({ tooltip }) => {
	return (
		<i style="background-color:grey; border-radius: 4px; padding: 1px 15px 1px 15px;"
			 className="flex  flex-v-center  hint--rounded  hint--bottom-left"
			 aria-label={tooltip}
		>Pro</i>
	);
};

export { ProductVersionLabelBasic };
