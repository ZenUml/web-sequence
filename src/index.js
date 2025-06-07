import ReactDOM from 'react-dom';
import App from './components/app.jsx';
import './config/paddleInit';
import './test-pages'; // Import test script for pages implementation
import './style.css';

const root = document.getElementById('app');
if (root) {
  ReactDOM.render(<App />, root);
}
