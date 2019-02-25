import { ProductVersionLabelAbstract } from './ProductVersionLabelAbstract';

const ProductVersionLabelProfessional = ({ clickHandler }) => {
	const theme = {
		'background-color': 'gold',
		color: 'white'
	};

	return <ProductVersionLabelAbstract clickHandler={clickHandler} theme={theme} tooltip="Thanks for your support" />
};

export { ProductVersionLabelProfessional };
