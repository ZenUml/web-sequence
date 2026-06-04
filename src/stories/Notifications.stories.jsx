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

export const WithSupportHandler = {
  args: {
    onSupportBtnClick: fn(),
  },
  name: 'With Support Handler (logged)',
};

export const NoopHandler = {
  args: {
    onSupportBtnClick: () => {},
  },
  name: 'No-op Handler',
};
