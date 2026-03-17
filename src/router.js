/**
 * Simple client-side router
 */
import { renderDashboard } from './pages/dashboard.js';
import { renderAnomaly } from './pages/anomaly.js';
import { renderDeepfake } from './pages/deepfake.js';
import { renderPhishing } from './pages/phishing.js';
import { $ } from './utils/helpers.js';

const routes = {
  dashboard: renderDashboard,
  anomaly: renderAnomaly,
  deepfake: renderDeepfake,
  phishing: renderPhishing,
};

let currentPage = 'dashboard';

export function navigate(page) {
  if (!routes[page]) return;
  currentPage = page;

  // Update sidebar active states
  document.querySelectorAll('.sidebar-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  // Render page
  const main = $('#main-content');
  main.innerHTML = '';
  routes[page](main);

  // Scroll to top
  main.scrollTop = 0;
}

export function getCurrentPage() {
  return currentPage;
}

export function initRouter() {
  // Set up sidebar button clicks
  document.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigate(btn.dataset.page);
    });
  });

  // Initial render
  navigate('dashboard');
}
