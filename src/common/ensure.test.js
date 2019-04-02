import ensure from '../common/ensure'

describe('ensure', () => {
	test('Ensure with function - no violation', () => {
		ensure(() => true, 'All good.')
	})
	test('Ensure with function - with violation', () => {
		expect(() => {
			ensure(() => false, 'Something wrong.')
		}).toThrow('Something wrong.')
	})
	test('Ensure with non-function - not allowed', () => {
		expect(() => {
			ensure(true, 'Something wrong.')
		}).toThrow('`condition` must be a function.')
	})
	test('Ensure with non-function - not allowed', () => {
		expect(() => {
			ensure(false, 'Something wrong.')
		}).toThrow('`condition` must be a function.')
	})
})
