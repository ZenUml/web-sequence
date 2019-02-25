const ProductVersionLabelProfessional = ({ clickHandler }) => {
	const style = {
		'background-color': 'gold',
		color: 'white',
		'border-radius': '4px',
		padding: '1px 15px 1px 15px'
	};

	return (
		<i style={style}
			 className="flex  flex-v-center  hint--rounded  hint--bottom-left"
			 aria-label="Thanks for your support" onClick={clickHandler}
		>Pro</i>
	);
};

export { ProductVersionLabelProfessional };
