import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/app.jsx';
import './config/paddleInit';
import './test-pages'; // Import test script for pages implementation
import './style.css';

const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
