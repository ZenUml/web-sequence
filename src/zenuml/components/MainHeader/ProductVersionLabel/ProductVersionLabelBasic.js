import { ProductVersionLabelAbstract } from './ProductVersionLabelAbstract';

const ProductVersionLabelBasic = ({ tooltip, clickHandler }) => {
	const style = {
		'background-color': 'grey'
	};
	return <ProductVersionLabelAbstract tooltip={tooltip} clickHandler={clickHandler} style={style} />
};

export { ProductVersionLabelBasic };
