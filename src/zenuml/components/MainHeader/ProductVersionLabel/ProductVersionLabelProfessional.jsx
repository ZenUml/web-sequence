import { ProductVersionLabelAbstract } from './ProductVersionLabelAbstract.jsx';

const ProductVersionLabelProfessional = ({ clickHandler }) => {
  const style = {
    backgroundColor: '#d3a447',
    color: 'white',
  };

  return (
    <ProductVersionLabelAbstract
      className="pro"
      clickHandler={clickHandler}
      style={style}
      tooltip="Thanks for your support"
    />
  );
};

export { ProductVersionLabelProfessional };