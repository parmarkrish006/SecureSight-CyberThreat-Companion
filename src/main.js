import './styles/variables.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import { initRouter } from './router.js';

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  initRouter();
});
