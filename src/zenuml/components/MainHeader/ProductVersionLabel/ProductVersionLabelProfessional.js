import { ProductVersionLabelAbstract } from './ProductVersionLabelAbstract';

const ProductVersionLabelProfessional = ({ clickHandler }) => {
  const style = {
    'background-color': '#d3a447',
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
