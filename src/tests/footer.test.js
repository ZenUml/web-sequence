import Footer from '../components/Footer';
// Needs to be kept here
import { h } from 'preact';
import { configure, mount } from 'enzyme';
import Adapter from 'enzyme-adapter-preact-pure';
configure({ adapter: new Adapter });

describe('Initial Test of the Footer', () => {
	test('Footer renders 1 link with an ID of notificationsBtn', () => {
		const context = mount(<Footer prefs={{}} />);
		expect(context.find('#notificationsBtn').exists()).toBeTruthy();
	});
});
