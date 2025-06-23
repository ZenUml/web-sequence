import userService from '../../../../services/user_service';
import { ProductVersionLabelBasic } from './ProductVersionLabelBasic.jsx';

export function ProductVersionLabel(props) {
  const isAnonymous = !props.user;
  const tooltip = isAnonymous
    ? 'Please login to upgrade to Pro'
    : 'Get more out of ZenUML — Go Pro';

  if (!window.user || userService.isSubscribed()) return null;

  return (
    <ProductVersionLabelBasic
      tooltip={tooltip}
      clickHandler={props.clickHandler}
    />
  );
}