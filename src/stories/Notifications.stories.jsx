import { Notifications } from '../components/Notifications';

const fn = () => () => {};

export default {
  title: 'Components/Notifications',
  component: Notifications,
  parameters: {
    backgrounds: { default: 'dark' },
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export const Default = {
  args: {
    onSupportBtnClick: fn(),
  },
};
