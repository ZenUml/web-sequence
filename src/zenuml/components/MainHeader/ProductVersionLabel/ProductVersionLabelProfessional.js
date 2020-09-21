import { ProductVersionLabelAbstract } from './ProductVersionLabelAbstract';

const ProductVersionLabelProfessional = ({ clickHandler }) => {
	const style = {
		'background-color': 'gold',
		color: 'white'
	};

	return <ProductVersionLabelAbstract className="pro" clickHandler={clickHandler} style={style} tooltip="Thanks for your support" />
};

export { ProductVersionLabelProfessional };
