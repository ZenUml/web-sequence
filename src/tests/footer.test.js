import Footer from '../components/Footer';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

describe('Initial Test of the Footer', () => {
  test('Footer renders 1 link with an ID of notificationsBtn', () => {
    render(<Footer prefs={{}} />);
    const notificationsBtn = screen.getByRole('button', { name: /notifications/i });
    expect(notificationsBtn).toBeInTheDocument();
  });
});
