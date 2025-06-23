import { ProductVersionLabelAbstract } from './ProductVersionLabelAbstract.jsx';

const ProductVersionLabelBasic = ({ tooltip, clickHandler }) => {
  const style = {
    'background-color': 'transparent',
  };
  return (
    <ProductVersionLabelAbstract
      className="basic"
      tooltip={tooltip}
      clickHandler={clickHandler}
      style={style}
    />
  );
};

export { ProductVersionLabelBasic };
