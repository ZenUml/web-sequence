import Footer from '../components/Footer';
// Needs to be kept here
import React from 'react';
import Enzyme, { configure, mount } from 'enzyme';
import Adapter from '@wojtekmaj/enzyme-adapter-react-17';
Enzyme.configure({ adapter: new Adapter() });

describe('Initial Test of the Footer', () => {
  test('Footer renders 1 link with an ID of notificationsBtn', () => {
    const context = mount(<Footer prefs={{}} />);
    expect(context.find('#notificationsBtn').exists()).toBeTruthy();
  });
});
