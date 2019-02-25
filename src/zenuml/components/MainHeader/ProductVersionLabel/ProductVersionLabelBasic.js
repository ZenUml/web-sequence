import { ProductVersionLabelAbstract } from './ProductVersionLabelAbstract';

const ProductVersionLabelBasic = ({ tooltip, clickHandler }) => {
	const theme = {
		'background-color': 'grey'
	};
	return <ProductVersionLabelAbstract tooltip={tooltip} clickHandler={clickHandler} theme={theme} />
};

export { ProductVersionLabelBasic };
