// ReviewPilot AI SaaS - Production Frontend Controller
// Version: 2.1.0

let currentOutlet = 'All Outlets';
let currentToken = localStorage.getItem('r2r_token') || '';
let currentUser = null;
let currentOrg = null;
let cachedReviews = [];
let cachedTasks = [];
let cachedClusters = [];
let cachedOutlets = [];
let activeReviewInModal = null;
let activeTaskForOutcome = null;
let onboardingStep = 1;

// ============================================================================
// 1. Client-Side Router (History API & Deep Linking)
// ============================================================================

const ROUTE_CONFIG = {
  '/': {
    type: 'landing',
    title: 'ReviewPilot AI | Turn Every Customer Review Into Restaurant Growth'
  },
  '/login': {
    type: 'auth',
    card: 'authCardLogin',
    title: 'Sign In | ReviewPilot AI'
  },
  '/signup': {
    type: 'auth',
    card: 'authCardSignup',
    title: 'Start Free Trial | ReviewPilot AI'
  },
  '/recover': {
    type: 'auth',
    card: 'authCardRecover',
    title: 'Reset Password | ReviewPilot AI'
  },
  '/dashboard': {
    type: 'dashboard',
    pane: 'pane-dashboard',
    heading: 'Operations Dashboard',
    sub: 'Real-time customer feedback intelligence across all restaurant locations.',
    title: 'Operations Dashboard | ReviewPilot AI'
  },
  '/restaurants': {
    type: 'dashboard',
    pane: 'pane-restaurants',
    heading: 'Restaurants & Outlets',
    sub: 'Manage physical locations, cloud kitchens, franchise branches, and localized operating hours.',
    title: 'Restaurants & Outlets | ReviewPilot AI'
  },
  '/reviews': {
    type: 'dashboard',
    pane: 'pane-reviews',
    heading: 'Reviews Inbox & Telemetry',
    sub: 'Multi-platform customer feedback with structured sentiment and dish extraction.',
    title: 'Reviews Inbox | ReviewPilot AI'
  },
  '/ai-insights': {
    type: 'dashboard',
    pane: 'pane-ai-insights',
    heading: 'AI Root-Cause Intel',
    sub: 'Multi-step AI investigation formulation: facts vs hypotheses and verification checklists.',
    title: 'AI Insights | ReviewPilot AI'
  },
  '/action-center': {
    type: 'dashboard',
    pane: 'pane-action-center',
    heading: 'Action Center & Kitchen Tasks',
    sub: 'Assigned corrective playbooks with SOPs, verification checklists, and post-intervention tracking.',
    title: 'Action Center | ReviewPilot AI'
  },
  '/analytics': {
    type: 'dashboard',
    pane: 'pane-analytics',
    heading: 'Analytics & Executive Reports',
    sub: 'Cross-outlet benchmarks, menu sales vs sentiment matrix, and executive reports.',
    title: 'Analytics & Reports | ReviewPilot AI'
  },
  '/integrations': {
    type: 'dashboard',
    pane: 'pane-integrations',
    heading: 'viaSocket Multi-Platform Connectors',
    sub: 'Connect restaurant channels via viaSocket OAuth, fetch customer reviews & stream live operational data.',
    title: 'viaSocket Connectors | ReviewPilot AI'
  },
  '/automations': {
    type: 'dashboard',
    pane: 'pane-integrations',
    heading: 'AI Automation Workflows & viaSocket Connectors',
    sub: 'Configure and monitor automated alerts, daily summaries, weekly improvement reports, and circuit breaker health.',
    title: 'Automations & Workflows | ReviewPilot AI'
  },
  '/settings': {
    type: 'dashboard',
    pane: 'pane-settings',
    heading: 'Organization Settings & Audit Trail',
    sub: 'Immutable security log of user logins, review imports, and status modifications.',
    title: 'Organization Settings | ReviewPilot AI'
  }
};

window.appNavigate = function(path, pushState = true) {
  // Normalize path
  let targetPath = path || '/';
  if (targetPath.includes('#')) {
    const [cleanPath, hash] = targetPath.split('#');
    targetPath = cleanPath || '/';
    if (hash) {
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    }
  }

  const landingView = document.getElementById('landingView');
  const authView = document.getElementById('authView');
  const dashboardShell = document.getElementById('dashboardShell');
  const publicReviewView = document.getElementById('publicReviewView');
  const printPosterView = document.getElementById('printPosterView');

  // Phase 3: Public Restaurant Review & Poster Routes (/r/:slug, /r/:slug/poster)
  if (targetPath.startsWith('/r/')) {
    if (pushState && window.location.pathname !== targetPath) {
      window.history.pushState({ path: targetPath }, '', targetPath);
    }
    if (landingView) landingView.style.display = 'none';
    if (authView) authView.style.display = 'none';
    if (dashboardShell) dashboardShell.style.display = 'none';

    if (targetPath.endsWith('/poster')) {
      if (publicReviewView) publicReviewView.style.display = 'none';
      if (printPosterView) printPosterView.style.display = 'block';
      const cleanSlug = targetPath.replace('/r/', '').replace('/poster', '').split('/')[0];
      loadPublicPoster(cleanSlug);
    } else {
      if (printPosterView) printPosterView.style.display = 'none';
      if (publicReviewView) publicReviewView.style.display = 'block';
      const cleanSlug = targetPath.replace('/r/', '').split('/')[0];
      loadPublicReviewPage(cleanSlug);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  // Ensure public review views are hidden for all other routes
  if (publicReviewView) publicReviewView.style.display = 'none';
  if (printPosterView) printPosterView.style.display = 'none';

  const route = ROUTE_CONFIG[targetPath] || ROUTE_CONFIG['/'];

  // History state
  if (pushState && window.location.pathname !== targetPath) {
    window.history.pushState({ path: targetPath }, '', targetPath);
  }

  document.title = route.title;

  if (route.type === 'landing') {
    if (landingView) landingView.style.display = 'block';
    if (authView) authView.style.display = 'none';
    if (dashboardShell) dashboardShell.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (route.type === 'auth') {
    if (landingView) landingView.style.display = 'none';
    if (authView) authView.style.display = 'flex';
    if (dashboardShell) dashboardShell.style.display = 'none';

    ['authCardLogin', 'authCardSignup', 'authCardRecover'].forEach(id => {
      const card = document.getElementById(id);
      if (card) card.style.display = (id === route.card) ? 'block' : 'none';
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  // Dashboard Shell Routes
  if (route.type === 'dashboard') {
    if (!currentToken) {
      window.appNavigate('/login', pushState);
      return;
    }
    if (landingView) landingView.style.display = 'none';
    if (authView) authView.style.display = 'none';
    if (dashboardShell) dashboardShell.style.display = 'flex';

    // Update Topbar
    const pageHeading = document.getElementById('pageHeading');
    const pageSub = document.getElementById('pageSub');
    if (pageHeading) pageHeading.textContent = route.heading;
    if (pageSub) pageSub.textContent = route.sub;

    // Switch Pane
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    const activePane = document.getElementById(route.pane);
    if (activePane) activePane.classList.add('active');

    // Update Sidebar Active Item
    document.querySelectorAll('.sidebar .nav-item').forEach(item => {
      const itemRoute = item.getAttribute('data-route');
      if (itemRoute === targetPath) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    if (targetPath === '/ai-insights') {
      if (typeof loadAIInsights === 'function') loadAIInsights();
    }
    if (targetPath === '/action-center') {
      if (typeof loadActionCenter === 'function') loadActionCenter();
    }
    if (targetPath === '/analytics') {
      if (typeof loadAnalyticsDashboard === 'function') loadAnalyticsDashboard();
    }
    if (targetPath === '/reviews') {
      if (typeof updateReviewSyncBadge === 'function') updateReviewSyncBadge();
    }
    if (targetPath === '/automations') {
      if (typeof fetchAutomations === 'function') fetchAutomations();
      setTimeout(() => {
        const wfEl = document.getElementById('workflowsGrid');
        if (wfEl) wfEl.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
    if (targetPath === '/integrations') {
      if (typeof fetchIntegrations === 'function') fetchIntegrations();
      if (typeof fetchAutomations === 'function') fetchAutomations();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

// ============================================================================
// Phase 3: Public Review Collection & Poster Controller
// ============================================================================

let currentPublicSlug = '';
let selectedOverallRating = 5;
const selectedSubRatings = {
  food_quality: 5,
  service: 5,
  cleanliness: 5,
  value_for_money: 5
};

async function loadPublicReviewPage(slug) {
  currentPublicSlug = slug || 'royal-spice-kitchen';
  document.title = 'Customer Feedback | ReviewPilot AI';

  const formContainer = document.getElementById('pubFormContainer');
  const successCard = document.getElementById('pubSuccessCard');
  const notFoundCard = document.getElementById('pubNotFoundCard');
  const alertBox = document.getElementById('pubFormAlert');
  if (alertBox) alertBox.style.display = 'none';

  try {
    const res = await fetch(`/api/public/restaurants/${encodeURIComponent(currentPublicSlug)}`);
    if (!res.ok) {
      if (formContainer) formContainer.style.display = 'none';
      if (successCard) successCard.style.display = 'none';
      if (notFoundCard) notFoundCard.style.display = 'block';
      document.title = 'Restaurant Not Found | ReviewPilot AI';
      return;
    }
    const profile = await res.json();
    if (!profile || !profile.name) {
      if (formContainer) formContainer.style.display = 'none';
      if (successCard) successCard.style.display = 'none';
      if (notFoundCard) notFoundCard.style.display = 'block';
      return;
    }

    if (notFoundCard) notFoundCard.style.display = 'none';
    if (successCard) successCard.style.display = 'none';
    if (formContainer) formContainer.style.display = 'block';

    document.title = `${profile.name} - Dining Feedback | ReviewPilot AI`;
    const nameEl = document.getElementById('pubRestaurantName');
    if (nameEl) nameEl.textContent = profile.name;
    const cuisineEl = document.getElementById('pubRestaurantCuisine');
    if (cuisineEl) cuisineEl.textContent = profile.cuisine || 'Fine Dining';
    const cityEl = document.getElementById('pubRestaurantCity');
    if (cityEl) cityEl.textContent = profile.city || (profile.locations && profile.locations.join(', ')) || '';

    // Populate Outlets dropdown
    const outletSelect = document.getElementById('pubOutletSelect');
    const outletGroup = document.getElementById('pubOutletGroup');
    if (outletSelect && profile.outlets && profile.outlets.length > 0) {
      outletSelect.innerHTML = profile.outlets.map(o => 
        `<option value="${escapeHtml(o.outlet_id)}">${escapeHtml(o.outlet_name || o.name || 'Main Location')}</option>`
      ).join('');
      if (outletGroup) outletGroup.style.display = 'block';
    } else if (outletGroup) {
      outletGroup.style.display = 'none';
    }

    resetPublicReviewForm();
  } catch (err) {
    console.error('Failed to load public restaurant profile', err);
    if (formContainer) formContainer.style.display = 'none';
    if (notFoundCard) notFoundCard.style.display = 'block';
  }
}

async function loadPublicPoster(slug) {
  const currentSlug = slug || currentOrg?.slug || 'royal-spice-kitchen';
  document.title = 'Print Poster | ReviewPilot AI';

  try {
    const res = await fetch(`/api/public/restaurants/${encodeURIComponent(currentSlug)}`);
    if (res.ok) {
      const profile = await res.json();
      const titleEl = document.getElementById('posterRestaurantName');
      if (titleEl && profile.name) titleEl.textContent = profile.name;
      document.title = `${profile.name} - Table Poster | ReviewPilot AI`;
    }
  } catch (e) {
    console.warn('Poster profile fetch error', e);
  }

  const reviewUrl = `${window.location.origin}/r/${currentSlug}`;
  const qrImg = document.getElementById('posterQrImage');
  if (qrImg) {
    qrImg.src = `/api/public/restaurants/${encodeURIComponent(currentSlug)}/qr?format=png`;
  }
  const urlText = document.getElementById('posterReviewUrlText');
  if (urlText) {
    urlText.textContent = reviewUrl;
  }

  const btnDl = document.getElementById('btnDownloadPosterQr');
  if (btnDl) {
    btnDl.onclick = () => {
      const a = document.createElement('a');
      a.href = `/api/public/restaurants/${encodeURIComponent(currentSlug)}/qr?format=png`;
      a.download = `${currentSlug}-review-qr.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Downloading QR Code image...');
    };
  }
}

function initPublicReviewForm() {
  // Overall Star buttons
  const starBtns = document.querySelectorAll('#overallStarRow .star-btn');
  const starLabel = document.getElementById('overallStarLabel');
  const ratingInput = document.getElementById('pubOverallRating');

  const starLabels = {
    1: '1 Star — Poor Experience',
    2: '2 Stars — Fair Experience',
    3: '3 Stars — Good Experience',
    4: '4 Stars — Very Good Experience',
    5: '5 Stars — Outstanding Experience'
  };

  function updateOverallStars(val) {
    selectedOverallRating = Number(val);
    if (ratingInput) ratingInput.value = val;
    if (starLabel) starLabel.textContent = starLabels[val] || `${val} Stars`;

    starBtns.forEach(btn => {
      const btnVal = Number(btn.getAttribute('data-val'));
      if (btnVal <= val) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  starBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = Number(btn.getAttribute('data-val'));
      updateOverallStars(val);
    });
    btn.addEventListener('mouseenter', () => {
      const val = Number(btn.getAttribute('data-val'));
      starBtns.forEach(b => {
        const bVal = Number(b.getAttribute('data-val'));
        if (bVal <= val) b.classList.add('active');
        else b.classList.remove('active');
      });
      if (starLabel) starLabel.textContent = starLabels[val] || `${val} Stars`;
    });
  });

  const starRow = document.getElementById('overallStarRow');
  if (starRow) {
    starRow.addEventListener('mouseleave', () => {
      updateOverallStars(selectedOverallRating);
    });
  }

  // Category Sub-ratings (Food, Service, Cleanliness, Value)
  const miniStarRows = document.querySelectorAll('.mini-star-row');
  miniStarRows.forEach(row => {
    const field = row.getAttribute('data-field');
    const btns = row.querySelectorAll('.mini-star-btn');

    function updateMiniStars(val) {
      selectedSubRatings[field] = Number(val);
      const inputMap = {
        food_quality: 'pubFoodRating',
        service: 'pubServiceRating',
        cleanliness: 'pubCleanlinessRating',
        value_for_money: 'pubValueRating'
      };
      const inp = document.getElementById(inputMap[field]);
      if (inp) inp.value = val;

      btns.forEach(b => {
        const bVal = Number(b.getAttribute('data-val'));
        if (bVal <= val) b.classList.add('active');
        else b.classList.remove('active');
      });
    }

    btns.forEach(b => {
      b.addEventListener('click', () => {
        const val = Number(b.getAttribute('data-val'));
        updateMiniStars(val);
      });
    });
  });

  // Character counter
  const textarea = document.getElementById('pubReviewText');
  const counter = document.getElementById('charCountDisplay');
  if (textarea && counter) {
    textarea.addEventListener('input', () => {
      const len = textarea.value.length;
      counter.textContent = `${len} / 2500`;
      if (len < 5) {
        counter.style.color = '#ef4444';
      } else {
        counter.style.color = 'var(--text-dim)';
      }
    });
  }

  // Form submission
  const form = document.getElementById('formPublicReview');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const alertBox = document.getElementById('pubFormAlert');
      const submitBtn = document.getElementById('btnSubmitPublicReview');
      if (alertBox) {
        alertBox.style.display = 'none';
        alertBox.className = 'auth-alert';
      }

      // Check honeypot field
      const hp = document.getElementById('pubWebsiteHp')?.value;
      if (hp && hp.trim().length > 0) {
        // Pretend success to silent drop bot submission
        const formContainer = document.getElementById('pubFormContainer');
        const successCard = document.getElementById('pubSuccessCard');
        if (formContainer) formContainer.style.display = 'none';
        if (successCard) successCard.style.display = 'block';
        return;
      }

      const review_text = textarea?.value?.trim() || '';
      if (review_text.length < 5) {
        if (alertBox) {
          alertBox.textContent = 'Please enter at least 5 characters describing your dining experience.';
          alertBox.style.display = 'block';
          alertBox.className = 'auth-alert error';
        }
        return;
      }

      const outlet_id = document.getElementById('pubOutletSelect')?.value || undefined;
      const menu_item = document.getElementById('pubMenuItem')?.value?.trim() || undefined;
      const visit_date = document.getElementById('pubVisitDate')?.value || undefined;
      const customer_name = document.getElementById('pubCustomerName')?.value?.trim() || undefined;
      const customer_email = document.getElementById('pubCustomerEmail')?.value?.trim() || undefined;

      const payload = {
        outlet_id,
        star_rating: selectedOverallRating,
        sub_ratings: {
          food_quality: selectedSubRatings.food_quality || 5,
          service: selectedSubRatings.service || 5,
          cleanliness: selectedSubRatings.cleanliness || 5,
          value_for_money: selectedSubRatings.value_for_money || 5
        },
        review_text,
        menu_item,
        visit_date,
        customer_name,
        customer_email,
        website_hp: hp
      };

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Transmitting Feedback...';
      }

      try {
        const slug = currentPublicSlug || 'royal-spice-kitchen';
        const res = await fetch(`/api/public/restaurants/${encodeURIComponent(slug)}/reviews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
          if (alertBox) {
            alertBox.textContent = data.error || 'Failed to submit feedback. Please check your inputs.';
            alertBox.style.display = 'block';
            alertBox.className = 'auth-alert error';
          }
          return;
        }

        // Success!
        const formContainer = document.getElementById('pubFormContainer');
        const successCard = document.getElementById('pubSuccessCard');
        if (formContainer) formContainer.style.display = 'none';
        if (successCard) successCard.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        console.error('Submission error', err);
        if (alertBox) {
          alertBox.textContent = 'Network error while submitting feedback. Please try again.';
          alertBox.style.display = 'block';
          alertBox.className = 'auth-alert error';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Feedback to Management →';
        }
      }
    });
  }

  // Submit another response button
  const btnAnother = document.getElementById('btnPubSubmitAnother');
  if (btnAnother) {
    btnAnother.addEventListener('click', () => {
      resetPublicReviewForm();
      const formContainer = document.getElementById('pubFormContainer');
      const successCard = document.getElementById('pubSuccessCard');
      if (formContainer) formContainer.style.display = 'block';
      if (successCard) successCard.style.display = 'none';
    });
  }
}

function resetPublicReviewForm() {
  const form = document.getElementById('formPublicReview');
  if (form) form.reset();
  const alertBox = document.getElementById('pubFormAlert');
  if (alertBox) alertBox.style.display = 'none';

  selectedOverallRating = 5;
  selectedSubRatings.food_quality = 5;
  selectedSubRatings.service = 5;
  selectedSubRatings.cleanliness = 5;
  selectedSubRatings.value_for_money = 5;

  const starBtns = document.querySelectorAll('#overallStarRow .star-btn');
  starBtns.forEach(b => b.classList.add('active'));
  const starLabel = document.getElementById('overallStarLabel');
  if (starLabel) starLabel.textContent = '5 Stars — Outstanding Experience';

  const miniBtns = document.querySelectorAll('.mini-star-btn');
  miniBtns.forEach(b => b.classList.add('active'));

  const counter = document.getElementById('charCountDisplay');
  if (counter) {
    counter.textContent = '0 / 2500';
    counter.style.color = 'var(--text-dim)';
  }
}

function openQrCodeModal(slug) {
  const targetSlug = slug || currentOrg?.slug || 'royal-spice-kitchen';
  const url = `${window.location.origin}/r/${targetSlug}`;

  const img = document.getElementById('modalQrImage');
  if (img) {
    img.src = `/api/public/restaurants/${encodeURIComponent(targetSlug)}/qr?format=png`;
  }
  const text = document.getElementById('modalQrUrlText');
  if (text) {
    text.textContent = url;
  }

  const btnCopy = document.getElementById('btnCopyReviewUrl');
  if (btnCopy) {
    btnCopy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(url);
        showToast('Public review link copied to clipboard!');
      } catch (e) {
        showToast('Link copied: ' + url);
      }
    };
  }

  const btnDl = document.getElementById('btnDownloadQrPng');
  if (btnDl) {
    btnDl.onclick = () => {
      const a = document.createElement('a');
      a.href = `/api/public/restaurants/${encodeURIComponent(targetSlug)}/qr?format=png`;
      a.download = `${targetSlug}-review-qr.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Downloading QR Code image...');
    };
  }

  const btnPoster = document.getElementById('btnOpenPosterPage');
  if (btnPoster) {
    btnPoster.onclick = () => {
      document.getElementById('qrCodeModal')?.classList.add('hidden');
      appNavigate(`/r/${targetSlug}/poster`);
    };
  }

  document.getElementById('qrCodeModal')?.classList.remove('hidden');
}

window.openQrCodeModal = openQrCodeModal;
window.openQrModalForOutlet = function(outletId) {
  openQrCodeModal(currentOrg?.slug || 'royal-spice-kitchen');
};

// ============================================================================
// 2. Initialization & Event Delegation
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  initRouteDelegation();
  initModals();
  initDropdowns();
  initFilters();
  initForms();
  initPublicReviewForm();

  await checkAuthAndBootstrap();

  // Route according to current URL
  const initialPath = window.location.pathname || '/';
  appNavigate(initialPath, false);
});

window.addEventListener('popstate', (e) => {
  const path = (e.state && e.state.path) || window.location.pathname || '/';
  appNavigate(path, false);
});

function initRouteDelegation() {
  document.addEventListener('click', (e) => {
    const routeTrigger = e.target.closest('[data-route]');
    if (routeTrigger) {
      const targetRoute = routeTrigger.getAttribute('data-route');
      if (targetRoute) {
        e.preventDefault();
        appNavigate(targetRoute);
      }
    }
  });
}

// Toast Notifications Helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : '⚠️'}</span>
    <span style="flex-grow:1;">${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 260);
  }, 3500);
}

// Modal Display Helpers
function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove('hidden');
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add('hidden');
}

// ============================================================================
// 3. API Client & Auth Bootstrap
// ============================================================================

async function api(endpoint, options = {}, maybeBody = null) {
  let config = {};
  if (typeof options === 'string') {
    config = { method: options.toUpperCase() };
    if (maybeBody !== null && maybeBody !== undefined) {
      config.body = (maybeBody instanceof FormData || typeof maybeBody === 'string')
        ? maybeBody
        : JSON.stringify(maybeBody);
    }
  } else {
    config = { ...options };
    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }
  }

  const headers = config.headers || {};
  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }
  if (!headers['Content-Type'] && !(config.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  config.headers = headers;

  const res = await fetch(endpoint, config);
  if (res.status === 401 && currentToken) {
    localStorage.removeItem('r2r_token');
    currentToken = '';
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
    }
    return data;
  } else {
    const text = await res.text();
    if (!res.ok) {
      const cleanText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      throw new Error(cleanText || `Request failed with status ${res.status}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }
}

async function checkAuthAndBootstrap() {
  try {
    const data = await api('/api/auth/me');
    if (data.user) {
      currentUser = data.user;
      currentOrg = data.organization;

      const topbarName = document.getElementById('topbarUserName');
      if (topbarName) topbarName.textContent = currentUser.full_name || currentUser.email;

      const profileName = document.getElementById('profileDropdownName');
      const profileEmail = document.getElementById('profileDropdownEmail');
      if (profileName) profileName.textContent = currentUser.full_name || 'Restaurant Owner';
      if (profileEmail) profileEmail.textContent = currentUser.email || '';

      if (currentOrg) {
        const orgNameEl = document.getElementById('sidebarOrgName');
        const brandGroupEl = document.getElementById('sidebarBrandGroup');
        const planBadgeEl = document.getElementById('sidebarPlanBadge');
        if (orgNameEl) orgNameEl.textContent = currentOrg.name;
        if (brandGroupEl) brandGroupEl.textContent = currentOrg.brand_group || 'Multi-Outlet Chain';
        if (planBadgeEl) planBadgeEl.textContent = (currentOrg.plan_tier || 'growth').toUpperCase();
      }
    }
  } catch (err) {
    console.warn('Auth check fallback to demo mode:', err);
  }

  await loadMeta();
  await loadAllData();
}

async function loadMeta() {
  try {
    const meta = await api('/api/meta');
    if (meta.categories) {
      const catSelect = document.getElementById('filterCategory');
      if (catSelect && catSelect.children.length <= 1) {
        meta.categories.forEach(cat => {
          const opt = document.createElement('option');
          opt.value = cat;
          opt.textContent = cat;
          catSelect.appendChild(opt);
        });
      }
    }

    if (meta.outlets) {
      cachedOutlets = meta.outlets;
      const globalOutlet = document.getElementById('globalOutletFilter');
      const manOutlet = document.getElementById('manOutlet');

      if (manOutlet) manOutlet.innerHTML = '';
      meta.outlets.forEach(o => {
        if (manOutlet) {
          const opt = document.createElement('option');
          opt.value = o.name;
          opt.textContent = `${o.name} (${o.city || 'Metro'})`;
          manOutlet.appendChild(opt);
        }
      });
      renderOutletsGrid(meta.outlets);
    }
  } catch (e) {
    console.error('Failed to load metadata', e);
  }
}

async function loadAllData() {
  await Promise.allSettled([
    fetchOverview(),
    fetchReviews(),
    fetchClustersAndInvestigations(),
    loadAIInsights(),
    fetchTasks(),
    fetchOutletsComparison(),
    fetchMenuRevenue(),
    fetchCompetitors(),
    fetchReports(),
    fetchAutomations(),
    fetchIntegrations(),
    fetchTeam(),
    fetchAuditLogs(),
    updateReviewSyncBadge(),
    fetchNotifications()
  ]);
}

// ============================================================================
// 4. Dashboard Overview Data
// ============================================================================

async function fetchOverview() {
  try {
    const data = await api(`/api/overview?outlet=${encodeURIComponent(currentOutlet)}`);
    const avgRatingEl = document.getElementById('kpiAvgRating');
    const totalRevEl = document.getElementById('kpiTotalReviews');
    const badgeCountEl = document.getElementById('badgeReviewsCount');
    const criticalEl = document.getElementById('kpiCriticalActions');
    const badgeCriticalEl = document.getElementById('badgeCriticalTasks');

    if (avgRatingEl) avgRatingEl.textContent = data.average_rating > 0 ? data.average_rating.toFixed(1) : '--';
    if (totalRevEl) totalRevEl.textContent = data.total_reviews;
    if (badgeCountEl) badgeCountEl.textContent = data.total_reviews;
    if (criticalEl) criticalEl.textContent = data.critical_actions_count;
    if (badgeCriticalEl) badgeCriticalEl.textContent = data.critical_actions_count;

    // Top Complaints in Overview
    const listEl = document.getElementById('overviewTopComplaintsList');
    if (listEl) {
      if (!data.top_complaints || data.top_complaints.length === 0) {
        listEl.innerHTML = '<div class="empty-state">No significant complaint clusters recorded.</div>';
      } else {
        listEl.innerHTML = data.top_complaints.map(c => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border-subtle);">
            <div>
              <div style="font-weight:600; color:var(--text-primary); font-size:13px;">${escapeHtml(c.category)}</div>
              <div style="font-size:11.5px; color:var(--text-dim);">Recurring customer friction point</div>
            </div>
            <span class="badge negative">${c.count} complaints</span>
          </div>
        `).join('');
      }
    }

    // Sentiment split bar
    const sentBox = document.getElementById('sentimentDistributionBox');
    if (sentBox) {
      const sb = data.sentiment_breakdown || { positive: 0, mixed: 0, negative: 0 };
      const total = data.total_reviews || 1;
      sentBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:8px;">
          <span>Positive: <strong>${sb.positive}</strong> (${((sb.positive/total)*100).toFixed(0)}%)</span>
          <span>Mixed: <strong>${sb.mixed}</strong></span>
          <span>Negative: <strong>${sb.negative}</strong> (${((sb.negative/total)*100).toFixed(0)}%)</span>
        </div>
        <div style="height:10px; background:#e2e8f0; border-radius:999px; overflow:hidden; display:flex;">
          <div style="width:${(sb.positive/total)*100}%; background:var(--emerald-primary);"></div>
          <div style="width:${(sb.mixed/total)*100}%; background:var(--amber-primary);"></div>
          <div style="width:${(sb.negative/total)*100}%; background:var(--rose-primary);"></div>
        </div>
      `;
    }

    // Notifications in Overview
    const notifEl = document.getElementById('overviewNotificationsList');
    if (notifEl) {
      notifEl.innerHTML = (data.notifications || []).map(n => `
        <div style="padding:8px 10px; background:var(--bg-subtle); border-radius:var(--radius-sm); margin-bottom:6px; font-size:11.5px;">
          <div style="font-weight:700; color:${n.severity === 'critical' ? 'var(--rose-primary)' : 'var(--text-primary)'};">${escapeHtml(n.title)}</div>
          <div style="color:var(--text-muted); margin-top:2px;">${escapeHtml(n.message)}</div>
        </div>
      `).join('') || '<div style="font-size:12px; color:var(--text-dim);">No active alerts.</div>';
    }
  } catch (e) {
    console.error('fetchOverview failed', e);
  }
}

// ============================================================================
// 5. Restaurants & Outlets (/restaurants)
// ============================================================================

function renderOutletsGrid(outlets) {
  const container = document.getElementById('outletsGridContainer');
  if (!container) return;

  if (!outlets || outlets.length === 0) {
    container.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">No restaurant outlets configured. Click "+ Add New Outlet" to get started.</div>';
    return;
  }

  container.innerHTML = outlets.map(o => `
    <div class="outlet-box-card">
      <div class="outlet-box-header">
        <div>
          <div class="outlet-box-title">${escapeHtml(o.name)}</div>
          <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">Code: <code>${escapeHtml(o.code || 'N/A')}</code> · ${escapeHtml(o.city || 'Metro')}</div>
        </div>
        <span class="badge positive">Active</span>
      </div>
      <div style="margin: 12px 0; font-size:12px; color:var(--text-secondary);">
        <div>Timezone: <strong>${escapeHtml(o.time_zone || 'Asia/Kolkata')}</strong></div>
        <div style="margin-top:3px;">Manager: <strong>${escapeHtml(o.manager_name || 'Assigned General Manager')}</strong></div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; pt:8px; border-top:1px solid var(--border-subtle); margin-top:12px; padding-top:10px;">
        <div style="display:flex; gap:6px;">
          <button class="btn btn-xs btn-outline" onclick="openQrModalForOutlet('${escapeHtml(o.outlet_id || o.id || '')}')">📱 Review QR</button>
          <button class="btn btn-xs btn-outline" onclick="selectOutletFilter('${escapeHtml(o.name)}')">Filter Reviews</button>
        </div>
      </div>
    </div>
  `).join('');
}

function selectOutletFilter(name) {
  const sel = document.getElementById('globalOutletFilter');
  if (sel) {
    sel.value = name;
    currentOutlet = name;
    loadAllData();
    appNavigate('/reviews');
  }
}

// ============================================================================
// 6. Reviews Inbox & Reply Modals (/reviews)
// ============================================================================

async function updateReviewSyncBadge() {
  const badge = document.getElementById('syncStatusBadge');
  if (!badge) return;

  try {
    const status = await api('/api/reviews/sync-status');
    if (!status || !status.has_connected_source) {
      badge.innerHTML = '<span style="color:#d97706; font-size:12px;">⚠️ No review sources connected in Settings &gt; Integrations</span>';
      return;
    }

    const latest = status.latest_sync;
    const sourceNames = (status.connected_sources || []).map(s => s.account_name || s.provider).join(', ');

    if (!latest) {
      badge.innerHTML = `<span style="color:#059669; font-size:12px;">● Connected to ${escapeHtml(sourceNames)}</span> <span style="opacity:0.75; font-size:12px;">· Ready to sync</span>`;
      return;
    }

    const syncTime = new Date(latest.completed_at || latest.started_at);
    const now = new Date();
    const diffMinutes = Math.max(0, Math.round((now - syncTime) / 60000));
    const timeStr = diffMinutes === 0 ? 'just now' : diffMinutes < 60 ? `${diffMinutes}m ago` : `${Math.round(diffMinutes / 60)}h ago`;

    const icon = latest.status === 'success' ? '✓' : latest.status === 'partial' ? '⚠️' : latest.status === 'empty' ? 'ℹ️' : '❌';
    const color = latest.status === 'success' ? '#059669' : latest.status === 'failed' ? '#dc2626' : '#d97706';

    badge.innerHTML = `<span style="color:${color}; font-weight:600; font-size:12px;">${icon} Last synced with viaSocket: ${timeStr}</span> <span style="opacity:0.75; font-size:12px;">(${latest.records_fetched || 0} fetched, ${latest.records_inserted || 0} added)</span>`;
  } catch (e) {
    console.warn('Failed to update sync badge:', e);
  }
}

async function syncReviewsViaSocket() {
  const btn = document.getElementById('btnSyncViaSocketReviews');
  const filterExclusionNotice = document.getElementById('filterExclusionNotice');
  const filterExclusionMsg = document.getElementById('filterExclusionMsg');
  if (!btn || btn.disabled) return;

  const originalHtml = btn.innerHTML;
  try {
    // 1. Loading state: disable button, spinner, label, duplicate prevention
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Fetching reviews...';

    if (filterExclusionNotice) {
      filterExclusionNotice.style.display = 'none';
    }

    // 2. Real integration request to backend
    const res = await api('/api/reviews/fetch-viasocket', { method: 'POST' });

    if (!res || !res.success) {
      const errMessage = res?.error || 'Failed to fetch reviews from viaSocket.';
      showToast(errMessage, 'error');
      return;
    }

    // 3. Refresh review query, table, dashboard overview & telemetry
    await fetchReviews();
    if (typeof fetchOverview === 'function') fetchOverview();
    if (typeof fetchAutomations === 'function') fetchAutomations();
    updateReviewSyncBadge();

    const summary = res.summary || {};
    const totalFetched = Number(summary.fetched || 0);
    const inserted = Number(summary.inserted || 0);
    const updated = Number(summary.updated || 0);
    const skipped = Number(summary.skipped || 0);

    // 4. On Empty Results
    if (res.is_empty || totalFetched === 0) {
      showToast('No new reviews were returned by viaSocket. Check the connected workflow, date range, and source configuration.', 'info');
      return;
    }

    // 5. On Success: Granular count feedback
    let toastMsg = '';
    if (inserted === 0 && updated === 0 && skipped > 0) {
      toastMsg = `All ${totalFetched} customer reviews are already synced (${skipped} duplicate records skipped).`;
    } else {
      toastMsg = `Synced ${totalFetched} reviews from viaSocket: ${inserted} new added, ${updated} updated, ${skipped} duplicate skipped.`;
    }
    showToast(toastMsg, 'success');

    // 6. Check if active filters hide the newly synced reviews
    const hasActiveFilter = Boolean(
      (document.getElementById('filterReviewSearch')?.value || '').trim() ||
      (document.getElementById('filterRating')?.value && document.getElementById('filterRating')?.value !== 'all') ||
      (document.getElementById('filterSentiment')?.value && document.getElementById('filterSentiment')?.value !== 'all') ||
      (document.getElementById('filterCategory')?.value && document.getElementById('filterCategory')?.value !== 'all') ||
      (document.getElementById('filterSource')?.value && document.getElementById('filterSource')?.value !== 'all') ||
      (document.getElementById('filterModeration')?.value && document.getElementById('filterModeration')?.value !== 'all') ||
      document.getElementById('filterDateFrom')?.value ||
      document.getElementById('filterDateTo')?.value
    );

    if (hasActiveFilter && (!cachedReviews || cachedReviews.length === 0)) {
      if (filterExclusionNotice && filterExclusionMsg) {
        filterExclusionMsg.textContent = `${inserted || totalFetched} reviews were synced from viaSocket, but your active filters currently hide them.`;
        filterExclusionNotice.style.display = 'flex';
      }
    }
  } catch (err) {
    console.error('Fetch from viaSocket failed:', err);
    const errMsg = err?.message || 'Unable to sync reviews from viaSocket. Please verify your connection in Settings.';
    showToast(errMsg, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

function resetReviewFilters() {
  const filterIds = [
    'filterReviewSearch',
    'filterSource',
    'filterModeration',
    'filterRating',
    'filterSentiment',
    'filterCategory',
    'filterSeverity',
    'filterDateFrom',
    'filterDateTo'
  ];
  filterIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') {
      el.value = 'all';
    } else {
      el.value = '';
    }
  });

  const filterExclusionNotice = document.getElementById('filterExclusionNotice');
  if (filterExclusionNotice) {
    filterExclusionNotice.style.display = 'none';
  }

  fetchReviews();
}

async function fetchReviews() {
  try {
    const qSearch = document.getElementById('filterReviewSearch')?.value || '';
    const qRating = document.getElementById('filterRating')?.value || 'all';
    const qSentiment = document.getElementById('filterSentiment')?.value || 'all';
    const qCategory = document.getElementById('filterCategory')?.value || 'all';
    const qSeverity = document.getElementById('filterSeverity')?.value || 'all';
    const qSource = document.getElementById('filterSource')?.value || 'all';
    const qModeration = document.getElementById('filterModeration')?.value || 'all';
    const qDateFrom = document.getElementById('filterDateFrom')?.value || '';
    const qDateTo = document.getElementById('filterDateTo')?.value || '';

    const params = new URLSearchParams({
      outlet: currentOutlet,
      rating: qRating,
      sentiment: qSentiment,
      category: qCategory,
      severity: qSeverity,
      source: qSource,
      moderation: qModeration,
      dateFrom: qDateFrom,
      dateTo: qDateTo,
      search: qSearch
    });

    const data = await api(`/api/reviews?${params.toString()}`);
    cachedReviews = data.reviews || [];
    renderReviewsTable(cachedReviews);
  } catch (e) {
    console.error('fetchReviews failed', e);
  }
}

function renderReviewsTable(reviews) {
  const tbody = document.getElementById('reviewsTableBody');
  if (!tbody) return;

  if (reviews.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><div class="empty-state-icon">🔍</div>No customer reviews match your active filters.</td></tr>';
    return;
  }

  tbody.innerHTML = reviews.map(r => {
    const a = r.analysis || {};
    const sentClass = (a.sentiment || 'neutral').toLowerCase();
    const sevClass = (a.severity || 'low').toLowerCase().replace(/\s+/g, '-');
    const dish = (a.mentioned_dish_names || []).join(', ') || r.menu_item || r.dish_name || '--';
    const starVal = r.star_rating !== undefined && r.star_rating !== null ? r.star_rating : (r.rating !== undefined && r.rating !== null ? r.rating : 5);
    const rawSource = r.source_platform || r.review_source || r.platform || (r.review_id?.startsWith('GS-') ? 'Google Sheets' : r.review_id?.startsWith('GBP-') ? 'Google Business Profile' : null);
    const isDirect = (rawSource === 'Direct Customer Review' || r.is_private === true || !rawSource);

    // Moderation badge
    const modStatus = (r.moderation_status || 'approved').toLowerCase();
    let modBadge = '';
    if (modStatus === 'pending') {
      modBadge = '<span class="badge moderation-pending" style="font-size:10px;">Pending Moderation</span>';
    } else if (modStatus === 'flagged' || modStatus === 'spam') {
      modBadge = '<span class="badge moderation-flagged" style="font-size:10px;">🚩 Flagged Spam</span>';
    } else {
      modBadge = '<span class="badge moderation-approved" style="font-size:10px;">✓ Approved</span>';
    }

    const sourceBadge = isDirect
      ? '<span class="badge" style="background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; font-size:10px;">🔒 Direct Private</span>'
      : `<span class="badge neutral" style="font-size:10px;">🌐 ${escapeHtml(rawSource)}</span>`;

    return `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:6px;">
            <strong style="color:${starVal <= 2 ? 'var(--rose-primary)' : starVal >= 4 ? 'var(--emerald-primary)' : 'var(--amber-primary)'}; font-size:14px;">${starVal}★</strong>
          </div>
          <div style="margin-top:4px;">${modBadge}</div>
        </td>
        <td>
          <div style="font-weight:600;">${escapeHtml(r.outlet_name || 'All Outlets')}</div>
          <div style="margin-top:4px; display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
            ${sourceBadge}
            <span style="font-size:11px; color:var(--text-dim);">${r.review_date || (r.created_at ? r.created_at.slice(0, 10) : '')}</span>
          </div>
        </td>
        <td style="max-width:320px;">
          <div style="line-height:1.4;">"${escapeHtml((r.review_text || '').slice(0, 110))}${r.review_text?.length > 110 ? '...' : ''}"</div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:3px;">
            Dish: <strong>${escapeHtml(dish)}</strong>
            ${r.customer_name ? ` · Guest: <strong>${escapeHtml(r.customer_name)}</strong>` : ''}
          </div>
        </td>
        <td>
          <span class="badge ${sentClass}">${a.sentiment || 'Neutral'}</span>
          <div style="font-size:11px; color:var(--text-muted); margin-top:3px;">${escapeHtml(a.primary_category || 'General')}</div>
        </td>
        <td><span class="badge severity-${sevClass}">${escapeHtml(a.severity || 'Low')}</span></td>
        <td><span class="badge ${a.reply_approval_status === 'approved' ? 'positive' : 'neutral'}">${escapeHtml(a.reply_approval_status || 'draft_generated')}</span></td>
        <td>
          <button class="btn btn-xs btn-outline inspect-review-btn" data-id="${r.review_id}">Inspect & Reply</button>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll('.inspect-review-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const rev = cachedReviews.find(r => r.review_id === id);
      if (rev) openReviewModal(rev);
    });
  });
}

function openReviewModal(review) {
  activeReviewInModal = review;
  const a = review.analysis || {};
  const isDirect = (review.source_platform === 'Direct Customer Review' || review.is_private === true || !review.source_platform);

  document.getElementById('mdlReviewId').textContent = `Review ${review.review_id} (${review.customer_name || review.reviewer_name || 'Anonymous Guest'})`;
  document.getElementById('mdlReviewStars').textContent = `${review.star_rating}★`;
  document.getElementById('mdlReviewOutlet').textContent = review.outlet_name || 'Flagship';
  document.getElementById('mdlReviewDate').textContent = review.visit_date ? `Visited: ${review.visit_date}` : `Date: ${review.review_date}`;
  document.getElementById('mdlReviewText').textContent = review.review_text || '';

  // Source Badge
  const srcBadge = document.getElementById('mdlReviewSourceBadge');
  if (srcBadge) {
    if (isDirect) {
      srcBadge.className = 'badge positive';
      srcBadge.textContent = '🔒 Direct Private Feedback (Never Published Externally)';
    } else {
      srcBadge.className = 'badge neutral';
      srcBadge.textContent = `🌐 ${review.source_platform || 'External Platform'}`;
    }
  }

  // Moderation Badge
  const modStatus = (review.moderation_status || 'approved').toLowerCase();
  const modBadgeContainer = document.getElementById('revDetailModerationBadge');
  if (modBadgeContainer) {
    if (modStatus === 'pending') {
      modBadgeContainer.innerHTML = '<span class="badge moderation-pending">Pending Review</span>';
    } else if (modStatus === 'flagged' || modStatus === 'spam') {
      modBadgeContainer.innerHTML = '<span class="badge moderation-flagged">🚩 Flagged as Spam</span>';
    } else {
      modBadgeContainer.innerHTML = '<span class="badge moderation-approved">✓ Approved for Insights</span>';
    }
  }

  // Sub-ratings
  const subs = review.sub_ratings || {};
  const foodEl = document.getElementById('revDetailFoodRating');
  const servEl = document.getElementById('revDetailServiceRating');
  const cleanEl = document.getElementById('revDetailCleanRating');
  const valEl = document.getElementById('revDetailValueRating');
  if (foodEl) foodEl.textContent = subs.food_quality ? `${subs.food_quality}★` : '—';
  if (servEl) servEl.textContent = subs.service ? `${subs.service}★` : '—';
  if (cleanEl) cleanEl.textContent = subs.cleanliness ? `${subs.cleanliness}★` : '—';
  if (valEl) valEl.textContent = subs.value_for_money ? `${subs.value_for_money}★` : '—';

  // Contact & Dish
  const custNameEl = document.getElementById('revDetailCustomerName');
  const custEmailEl = document.getElementById('revDetailCustomerEmail');
  const dishEl = document.getElementById('revDetailDish');
  const visitDateEl = document.getElementById('revDetailVisitDate');
  if (custNameEl) custNameEl.textContent = review.customer_name || review.reviewer_name || 'Anonymous Diner';
  if (custEmailEl) custEmailEl.textContent = review.customer_email || 'No email provided';
  if (dishEl) dishEl.textContent = review.menu_item || review.dish_name || (a.mentioned_dish_names || []).join(', ') || 'Not specified';
  if (visitDateEl) visitDateEl.textContent = review.visit_date ? `Visited: ${review.visit_date}` : (review.review_date || 'N/A');

  // AI Diagnostic
  document.getElementById('mdlFactualSummary').textContent = a.factual_summary || 'No factual summary extracted.';
  document.getElementById('mdlInferredInterpretation').textContent = a.inferred_interpretation || 'No inferred hypotheses.';

  // Suggested Reply
  document.getElementById('mdlReplyText').value = a.approved_reply || a.suggested_reply || '';
  document.getElementById('mdlReplyStatus').textContent = a.reply_approval_status || 'draft_generated';

  // Moderation Handlers
  const btnApprove = document.getElementById('btnModApprove');
  const btnFlag = document.getElementById('btnModFlag');
  const btnPending = document.getElementById('btnModPending');

  async function handleModeration(newStatus) {
    try {
      const res = await api(`/api/reviews/${review.review_id}/moderation`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      if (res.review) {
        review.moderation_status = newStatus;
        showToast(`Review moderation updated to ${newStatus}`);
        openReviewModal(review);
        renderReviewsTable(cachedReviews);
      } else {
        showToast(res.error || 'Failed to update moderation', 'error');
      }
    } catch (e) {
      showToast('Error updating moderation', 'error');
    }
  }

  if (btnApprove) btnApprove.onclick = () => handleModeration('approved');
  if (btnFlag) btnFlag.onclick = () => handleModeration('flagged');
  if (btnPending) btnPending.onclick = () => handleModeration('pending');

  document.getElementById('reviewDetailModal')?.classList.remove('hidden');
}

// ============================================================================
// 7. Root-Cause Investigation Agent (/ai-insights)
// ============================================================================

// ============================================================================
// 7. ReviewPilot AI Review-Intelligence Agent Controller (/ai-insights)
// ============================================================================

let cachedAiDrafts = [];
let currentDraftFilter = 'all';
let currentQaThreadId = 'qa-' + Date.now().toString(36);

async function loadAIInsights(forceRefresh = false) {
  try {
    // 1. Fetch AI Overview
    const overviewRes = await api('/api/ai/overview');
    if (overviewRes && overviewRes.success) {
      renderAiOverview(overviewRes);
    }

    // 2. Fetch Recurring Complaints (≥2 reviews rule)
    const complaintsRes = await api(`/api/ai/recurring-complaints${forceRefresh ? '?refresh=true' : ''}`);
    if (complaintsRes && complaintsRes.success && complaintsRes.data) {
      renderAiRecurringComplaints(complaintsRes.data.recurring_complaints || []);
      renderAiPositiveThemes(complaintsRes.data.frequently_praised || []);
    }

    // 3. Fetch Growth Recommendations
    const recsRes = await api(`/api/ai/growth-recommendations${forceRefresh ? '?refresh=true' : ''}`);
    if (recsRes && recsRes.success && recsRes.data) {
      renderAiGrowthRecommendations(recsRes.data.recommendations || []);
    }

    // 4. Fetch Response Drafts
    const draftsRes = await api('/api/ai/drafts');
    if (draftsRes && draftsRes.success) {
      cachedAiDrafts = draftsRes.drafts || [];
      renderAiResponseDrafts();
    }

    // 5. Also load legacy cluster investigations for compatibility
    fetchClustersAndInvestigations();
  } catch (err) {
    console.error('Failed to load AI Insights:', err);
  }
}

function renderAiOverview(data) {
  const sent = data.sentiment || { positive: 0, neutral: 0, negative: 0, positive_pct: 0 };
  const posPctEl = document.getElementById('aiSentimentPositivePct');
  if (posPctEl) posPctEl.textContent = `${sent.positive_pct}%`;

  const total = (sent.positive + sent.neutral + sent.negative) || 1;
  const barPos = document.getElementById('aiSentimentBarPos');
  const barNeu = document.getElementById('aiSentimentBarNeu');
  const barNeg = document.getElementById('aiSentimentBarNeg');
  if (barPos) barPos.style.width = `${Math.round((sent.positive / total) * 100)}%`;
  if (barNeu) barNeu.style.width = `${Math.round((sent.neutral / total) * 100)}%`;
  if (barNeg) barNeg.style.width = `${Math.round((sent.negative / total) * 100)}%`;

  const cntPos = document.getElementById('aiSentimentCountPos');
  const cntNeu = document.getElementById('aiSentimentCountNeu');
  const cntNeg = document.getElementById('aiSentimentCountNeg');
  if (cntPos) cntPos.textContent = `${sent.positive} Positive`;
  if (cntNeu) cntNeu.textContent = `${sent.neutral} Neutral`;
  if (cntNeg) cntNeg.textContent = `${sent.negative} Negative`;

  const recCount = document.getElementById('aiRecurringCount');
  if (recCount) recCount.textContent = (data.recurring_complaints || []).length;

  const recsCount = document.getElementById('aiRecommendationsCount');
  if (recsCount) recsCount.textContent = (data.recommendations || []).length;

  const draftsCount = document.getElementById('aiPendingDraftsCount');
  if (draftsCount) draftsCount.textContent = data.pending_drafts_count || 0;

  // Render Category Distribution
  const catContainer = document.getElementById('aiTopComplaintCategories');
  if (catContainer && data.topics) {
    const topics = data.topics;
    const topicIcons = {
      food: '🍲 Food Quality',
      service: '⏱️ Service & Wait Times',
      cleanliness: '✨ Hygiene & Cleanliness',
      delivery: '📦 Delivery & Packaging',
      pricing: '💰 Pricing & Portion Value',
      staff: '👥 Staff Conduct',
      ambience: '🎵 Ambience & Atmosphere',
      other: '📌 Other Feedback'
    };

    const sortedTopics = Object.entries(topics).sort((a, b) => b[1] - a[1]);
    catContainer.innerHTML = sortedTopics.map(([k, count]) => {
      const label = topicIcons[k] || k;
      const pct = data.total_reviews > 0 ? Math.round((count / data.total_reviews) * 100) : 0;
      return `
        <div style="padding:10px 14px; background:#f8fafc; border:1px solid var(--border-subtle); border-radius:var(--radius-md); display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:13px; font-weight:600; color:var(--text-primary);">${label}</div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:12px; color:var(--text-muted);">${count} reviews (${pct}%)</span>
            <div style="width:48px; height:6px; background:#e2e8f0; border-radius:3px; overflow:hidden;">
              <div style="height:100%; width:${Math.min(pct * 2, 100)}%; background:var(--primary);"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
}

function renderAiRecurringComplaints(complaints) {
  const container = document.getElementById('aiRecurringComplaintsList');
  if (!container) return;

  if (!complaints || complaints.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:24px; text-align:center; color:var(--text-muted);">
        <div style="font-size:24px; margin-bottom:8px;">✅</div>
        <div style="font-weight:700; color:var(--text-primary); margin-bottom:4px;">No Recurring Complaint Patterns Detected</div>
        <div style="font-size:12.5px; max-width:440px; margin:0 auto;">
          Our AI engine requires at least 2 corroborating reviews before flagging a pattern as recurring. Currently, all recorded issues are isolated or resolved.
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = complaints.map(c => {
    const dates = c.date_range ? `${c.date_range.start_date} to ${c.date_range.end_date}` : 'Recent period';
    const conf = c.confidence ? `${Math.round(c.confidence * 100)}% Confidence` : 'Verified';
    return `
      <div style="padding:16px 18px; background:#fff; border:1px solid #fed7aa; border-left:4px solid #f97316; border-radius:var(--radius-md); margin-bottom:14px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:15px; font-weight:800; color:#9a3412;">${escapeHtml(c.issue_title)}</span>
              <span class="badge" style="background:#ffedd5; color:#c2410c; font-weight:700;">${c.supporting_review_count} Supporting Reviews</span>
              <span class="badge" style="background:#f1f5f9; color:#475569;">${conf}</span>
            </div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
              📅 Date Range: <strong>${dates}</strong> • Affected: <strong>${escapeHtml(c.affected_item_or_area || c.category)}</strong>
            </div>
          </div>
        </div>

        <div style="margin-top:10px; font-size:13px; color:var(--text-secondary); line-height:1.45; background:#fffaf0; padding:10px 14px; border-radius:var(--radius-sm); border:1px dashed #fdba74;">
          <strong>Operational Root-Cause Hypothesis:</strong> ${escapeHtml(c.root_cause_hypothesis || 'Identified across recurring customer reviews.')}
        </div>

        <!-- Evidence Excerpts -->
        <div style="margin-top:12px;">
          <div style="font-size:11.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">Verbatim Customer Evidence Excerpts:</div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${(c.evidence_excerpts || []).map(e => `
              <div style="padding:8px 12px; background:#f8fafc; border:1px solid var(--border-subtle); border-radius:var(--radius-sm); font-size:12px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <span style="font-style:italic; color:var(--text-primary); flex:1;">"${escapeHtml(e.quote)}"</span>
                <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                  <span style="color:#d97706; font-weight:700;">${e.rating}★</span>
                  <a href="/reviews?search=${encodeURIComponent(e.review_id || '')}" data-route="/reviews" class="btn btn-outline btn-sm" style="font-size:11px; padding:3px 8px;">
                    View Review
                  </a>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderAiPositiveThemes(themes) {
  const container = document.getElementById('aiPositiveThemes');
  if (!container) return;

  if (!themes || themes.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); font-size:12.5px;">No positive themes aggregated yet.</div>';
    return;
  }

  container.innerHTML = themes.map(t => `
    <div style="padding:10px 14px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:var(--radius-md); display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-size:13.5px; font-weight:700; color:#065f46;">⭐ ${escapeHtml(t.item_or_service)}</div>
        ${t.positive_excerpts && t.positive_excerpts[0] ? `
          <div style="font-size:11.5px; color:#047857; margin-top:2px; font-style:italic;">"${escapeHtml(t.positive_excerpts[0])}"</div>
        ` : ''}
      </div>
      <span class="badge" style="background:#d1fae5; color:#065f46; font-weight:700;">${t.praise_count} Mentions</span>
    </div>
  `).join('');
}

function renderAiGrowthRecommendations(recommendations) {
  const container = document.getElementById('aiGrowthRecommendationsList');
  if (!container) return;

  if (!recommendations || recommendations.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:20px; text-align:center; color:var(--text-muted);">No recommendations generated yet. Click "Refresh Intel" to calculate.</div>';
    return;
  }

  container.innerHTML = recommendations.map((rec, i) => {
    const priorityColor = rec.priority === 'urgent' ? '#b91c1c' : rec.priority === 'high' ? '#c2410c' : '#2563eb';
    const priorityBg = rec.priority === 'urgent' ? '#fee2e2' : rec.priority === 'high' ? '#ffedd5' : '#eff6ff';

    return `
      <div style="padding:18px 20px; background:#fff; border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:14px; box-shadow:var(--shadow-card);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge" style="background:${priorityBg}; color:${priorityColor}; font-weight:800; text-transform:uppercase;">Priority: ${rec.priority}</span>
              <span class="badge" style="background:#f1f5f9; color:#475569;">Effort: ${rec.effort_level}</span>
              <h3 style="font-size:15px; font-weight:800; color:var(--text-primary); margin:0;">${escapeHtml(rec.title || `Recommendation #${i + 1}`)}</h3>
            </div>
            <div style="font-size:13px; color:var(--text-secondary); margin-top:6px;">
              <strong>Identified Opportunity / Issue:</strong> ${escapeHtml(rec.issue_or_opportunity)}
            </div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:14px; padding:12px 14px; background:#f8fafc; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
          <div>
            <div style="font-size:11.5px; font-weight:700; color:var(--primary); text-transform:uppercase; margin-bottom:4px;">🎯 Recommended Action (SOP)</div>
            <div style="font-size:12.5px; color:var(--text-primary); line-height:1.45;">${escapeHtml(rec.recommended_action)}</div>
          </div>
          <div>
            <div style="font-size:11.5px; font-weight:700; color:#059669; text-transform:uppercase; margin-bottom:4px;">📈 Expected Impact & Measurable Metric</div>
            <div style="font-size:12.5px; color:var(--text-primary); line-height:1.45;">
              <div>${escapeHtml(rec.expected_impact)}</div>
              <div style="margin-top:4px; font-weight:700; color:#047857;">Suggested KPI: ${escapeHtml(rec.suggested_metric)}</div>
            </div>
          </div>
        </div>

        ${rec.supporting_evidence ? `
          <div style="margin-top:12px; font-size:11.5px; color:var(--text-muted); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px;">
            <span>Corroborating Evidence: <strong>${rec.supporting_evidence.review_count} customer reviews</strong></span>
            ${rec.supporting_evidence.related_review_ids && rec.supporting_evidence.related_review_ids.length > 0 ? `
              <div style="display:flex; gap:6px; align-items:center;">
                <span>Source Reviews:</span>
                ${rec.supporting_evidence.related_review_ids.slice(0, 3).map(id => `
                  <a href="/reviews?search=${encodeURIComponent(id)}" data-route="/reviews" class="btn btn-outline btn-sm" style="font-size:10.5px; padding:2px 6px;">
                    ${escapeHtml(id)}
                  </a>
                `).join('')}
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function filterDrafts(status) {
  currentDraftFilter = status;
  document.querySelectorAll('#btnDraftFilterAll, #btnDraftFilterPending, #btnDraftFilterApproved').forEach(btn => {
    btn.classList.remove('active');
  });
  if (status === 'all') document.getElementById('btnDraftFilterAll')?.classList.add('active');
  else if (status === 'draft') document.getElementById('btnDraftFilterPending')?.classList.add('active');
  else if (status === 'approved') document.getElementById('btnDraftFilterApproved')?.classList.add('active');

  renderAiResponseDrafts();
}

function renderAiResponseDrafts() {
  const container = document.getElementById('aiResponseDraftsList');
  if (!container) return;

  let filtered = cachedAiDrafts;
  if (currentDraftFilter === 'draft') {
    filtered = cachedAiDrafts.filter(d => d.status === 'draft');
  } else if (currentDraftFilter === 'approved') {
    filtered = cachedAiDrafts.filter(d => d.status === 'approved' || d.status === 'sent');
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:24px; text-align:center; color:var(--text-muted);">No response drafts found matching this filter. Run AI analysis to generate drafts.</div>';
    return;
  }

  container.innerHTML = filtered.slice(0, 10).map(d => {
    const isApproved = d.status === 'approved' || d.status === 'sent';
    return `
      <div style="padding:16px 18px; background:#fff; border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:14px; box-shadow:var(--shadow-card);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <strong style="font-size:14px; color:var(--text-primary);">${escapeHtml(d.reviewer_name)}</strong>
              <span style="color:#d97706; font-weight:700;">${d.star_rating}★</span>
              <span class="badge ${d.sentiment === 'positive' ? 'positive' : d.sentiment === 'negative' ? 'negative' : 'neutral'}">${d.sentiment}</span>
              <span class="badge" style="background:${isApproved ? '#d1fae5' : '#fef3c7'}; color:${isApproved ? '#065f46' : '#92400e'};">${isApproved ? 'Approved' : 'Pending Review'}</span>
            </div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:3px;">
              Outlet: ${escapeHtml(d.outlet_name)} • Date: ${d.review_date}
            </div>
          </div>
          <a href="/reviews?search=${encodeURIComponent(d.review_id)}" data-route="/reviews" class="btn btn-outline btn-sm" style="font-size:11px;">
            View in Inbox
          </a>
        </div>

        <div style="margin:10px 0 8px; font-size:12px; font-style:italic; color:var(--text-secondary); background:#f8fafc; padding:8px 12px; border-radius:var(--radius-sm);">
          "${escapeHtml(d.review_text.slice(0, 140))}${d.review_text.length > 140 ? '...' : ''}"
        </div>

        <!-- Editable Draft Textarea -->
        <div style="margin-top:8px;">
          <label style="font-size:11.5px; font-weight:700; color:var(--text-muted); display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>AI Response Draft (Editable):</span>
            <span style="font-weight:normal; color:#059669;">🛡️ Privacy-conscious • Non-liable</span>
          </label>
          <textarea id="draftText_${d.review_id}" class="form-input" style="width:100%; min-height:76px; font-size:13px; line-height:1.45; padding:8px 10px; resize:vertical;">${escapeHtml(d.draft_text)}</textarea>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
          <div style="font-size:11px; color:var(--text-muted);">
            Updated: ${new Date(d.updated_at).toLocaleString()}
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-outline btn-sm" onclick="regenerateDraftReply('${d.review_id}')">
              🔄 Regenerate
            </button>
            <button class="btn btn-primary btn-sm" onclick="saveDraftReply('${d.review_id}', 'approved')">
              💾 Save & Approve
            </button>
            <button class="btn btn-outline btn-sm" onclick="saveDraftReply('${d.review_id}', 'sent')" style="color:#059669; border-color:#a7f3d0;">
              📨 Mark Sent
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function runAiBatchAnalysis() {
  const alertEl = document.getElementById('aiBatchProgressAlert');
  const btn = document.getElementById('btnRunAiBatch');
  if (alertEl) alertEl.style.display = 'flex';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Analyzing reviews...';
  }

  try {
    const res = await api('/api/ai/analyze-batch', 'POST', { force_all: true });
    if (res && res.success) {
      showToast(res.message || 'Batch AI analysis completed successfully!', 'success');
      await loadAIInsights(true);
    }
  } catch (err) {
    showToast(`AI Analysis error: ${err.message}`, 'error');
  } finally {
    if (alertEl) alertEl.style.display = 'none';
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        Run viaSocket AI Analysis
      `;
    }
  }
}

async function saveDraftReply(reviewId, status = 'approved') {
  const textarea = document.getElementById(`draftText_${reviewId}`);
  const text = textarea ? textarea.value.trim() : '';
  if (!text) {
    showToast('Draft text cannot be empty.', 'error');
    return;
  }

  try {
    const res = await api(`/api/ai/replies/${encodeURIComponent(reviewId)}/approve`, 'POST', {
      reply_text: text,
      status
    });
    if (res && res.success) {
      showToast(`Reply draft saved and marked as ${status}!`, 'success');
      const item = cachedAiDrafts.find(d => d.review_id === reviewId);
      if (item) {
        item.draft_text = text;
        item.status = status;
        item.updated_at = new Date().toISOString();
      }
      renderAiResponseDrafts();
    }
  } catch (err) {
    showToast(`Failed to save reply: ${err.message}`, 'error');
  }
}

async function regenerateDraftReply(reviewId) {
  const textarea = document.getElementById(`draftText_${reviewId}`);
  if (textarea) textarea.disabled = true;

  try {
    const res = await api(`/api/ai/reviews/${encodeURIComponent(reviewId)}/draft-reply`, 'POST', {});
    if (res && res.success && res.draft) {
      if (textarea) textarea.value = res.draft.reply_draft;
      showToast('AI reply draft regenerated!', 'success');
    }
  } catch (err) {
    showToast(`Failed to regenerate draft: ${err.message}`, 'error');
  } finally {
    if (textarea) textarea.disabled = false;
  }
}

function askAiQuestion(questionText) {
  const input = document.getElementById('qaInputText');
  if (input) input.value = questionText;
  submitQaQuestion();
}

async function submitQaQuestion() {
  const input = document.getElementById('qaInputText');
  const sendBtn = document.getElementById('btnSendQA');
  const container = document.getElementById('qaMessagesContainer');
  const question = input ? input.value.trim() : '';

  if (!question) return;

  // Render User Message Bubble
  if (container) {
    const userBubble = document.createElement('div');
    userBubble.style.cssText = 'display:flex; justify-content:flex-end; margin-bottom:8px;';
    userBubble.innerHTML = `
      <div style="background:var(--primary); color:#fff; border-radius:var(--radius-md); padding:10px 14px; font-size:13px; max-width:80%; line-height:1.45; box-shadow:0 1px 2px rgba(0,0,0,0.06);">
        ${escapeHtml(question)}
      </div>
    `;
    container.appendChild(userBubble);

    // Thinking Indicator Bubble
    const thinkingBubble = document.createElement('div');
    thinkingBubble.id = 'qaThinkingBubble';
    thinkingBubble.style.cssText = 'display:flex; gap:10px; align-items:center; margin-bottom:8px;';
    thinkingBubble.innerHTML = `
      <div style="width:30px; height:30px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:12px; flex-shrink:0;">RP</div>
      <div style="background:#fff; border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:10px 14px; font-size:13px; color:var(--text-muted); display:flex; align-items:center; gap:8px;">
        <div class="spinner" style="width:14px; height:14px; border:2px solid #cbd5e1; border-top-color:var(--primary); border-radius:50%; animation:spin 0.8s linear infinite;"></div>
        Analyzing authorized restaurant records...
      </div>
    `;
    container.appendChild(thinkingBubble);
    container.scrollTop = container.scrollHeight;
  }

  if (input) input.value = '';
  if (sendBtn) sendBtn.disabled = true;

  try {
    const res = await api('/api/ai/ask', 'POST', {
      question,
      threadId: currentQaThreadId
    });

    document.getElementById('qaThinkingBubble')?.remove();

    if (res && res.answer && container) {
      const assistantBubble = document.createElement('div');
      assistantBubble.style.cssText = 'display:flex; gap:10px; align-items:flex-start; margin-bottom:12px;';
      assistantBubble.innerHTML = `
        <div style="width:32px; height:32px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; flex-shrink:0;">RP</div>
        <div style="background:#fff; border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:14px 16px; font-size:13px; line-height:1.55; color:var(--text-primary); max-width:85%; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <div style="white-space:pre-wrap;">${escapeHtml(res.answer)}</div>
          <div style="margin-top:8px; font-size:10.5px; color:var(--text-muted); border-top:1px solid var(--border-subtle); padding-top:4px; display:flex; justify-content:space-between;">
            <span>Source: Authorized Stored Reviews</span>
            <span>Engine: ${escapeHtml(res.ai_engine || 'viaSocket AI')}</span>
          </div>
        </div>
      `;
      container.appendChild(assistantBubble);
      container.scrollTop = container.scrollHeight;
    }
  } catch (err) {
    document.getElementById('qaThinkingBubble')?.remove();
    if (container) {
      const errBubble = document.createElement('div');
      errBubble.style.cssText = 'padding:10px 14px; background:#fee2e2; border-radius:var(--radius-md); color:#b91c1c; font-size:12px; margin-bottom:8px;';
      errBubble.textContent = `Error querying assistant: ${err.message}`;
      container.appendChild(errBubble);
    }
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

// Preserve legacy investigation functions for backward compatibility
async function fetchClustersAndInvestigations() {
  try {
    const listEl = document.getElementById('investigationsList');
    if (!listEl) return;

    const clusters = await api('/api/clusters');
    cachedClusters = clusters || [];

    if (cachedClusters.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No recurring complaint clusters detected. Ingest more reviews to trigger clustering.</div>';
      return;
    }

    listEl.innerHTML = cachedClusters.map(c => `
      <div style="padding:18px; background:#fff; border:1px solid var(--border-subtle); border-radius:var(--radius-lg); margin-bottom:14px; box-shadow:var(--shadow-card);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <h3 style="font-family:var(--font-heading); font-size:15px; font-weight:700; color:var(--text-primary);">${escapeHtml(c.cluster_key)}</h3>
              <span class="badge ${c.priority_score >= 80 ? 'negative' : c.priority_score >= 60 ? 'warning' : 'neutral'}">${c.priority_level} (${c.priority_score}/100)</span>
            </div>
            <p style="font-size:12.5px; color:var(--text-secondary); margin-top:4px;">${escapeHtml(c.problem_statement)}</p>
          </div>
          <button class="btn btn-sm btn-primary run-investigation-btn" data-id="${c.id}">Investigate Root-Cause</button>
        </div>

        <div style="display:flex; gap:16px; margin-top:12px; font-size:12px; color:var(--text-muted);">
          <span>Affected Outlets: <strong>${c.affected_outlets?.join(', ') || 'All'}</strong></span>
          <span>Sample Dish: <strong>${escapeHtml(c.dish_name || 'Multi-Item')}</strong></span>
          <span>Complaint Frequency: <strong>${c.review_count || 1} reviews</strong></span>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.run-investigation-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        btn.textContent = 'Analyzing...';
        btn.disabled = true;
        try {
          const res = await api(`/api/clusters/${id}/investigate`);
          openInvestigationModal(res.investigation);
        } finally {
          btn.textContent = 'Investigate Root-Cause';
          btn.disabled = false;
        }
      });
    });
  } catch (e) {
    console.error('fetchClustersAndInvestigations failed', e);
  }
}

function openInvestigationModal(inv) {
  if (!inv) return;
  const modal = document.getElementById('investigationModal');
  const title = document.getElementById('mdlInvTitle');
  const body = document.getElementById('mdlInvBody');

  if (title) title.textContent = `Investigation: ${inv.cluster_title || 'Issue Cluster'}`;
  if (body) {
    body.innerHTML = `
      <div style="margin-bottom:16px;">
        <h4 style="font-size:13.5px; font-weight:700; color:var(--text-primary); margin-bottom:6px;">Ranked Hypotheses (Root-Cause Analysis)</h4>
        ${(inv.hypotheses || []).map(h => `
          <div style="padding:12px; background:var(--bg-subtle); border-radius:var(--radius-sm); margin-bottom:8px; border-left:3px solid var(--emerald-primary);">
            <div style="display:flex; justify-content:space-between;">
              <strong style="color:var(--text-primary); font-size:13px;">${escapeHtml(h.hypothesis)}</strong>
              <span class="badge ${h.likelihood === 'High' ? 'negative' : 'warning'}">Likelihood: ${h.likelihood}</span>
            </div>
            <div style="font-size:11.5px; color:var(--text-muted); margin-top:4px;">Supporting Evidence: "${escapeHtml(h.supporting_evidence || 'Multiple guest reports')}"</div>
            <div style="font-size:11.5px; color:var(--emerald-hover); margin-top:4px;"><strong>Prescribed Verification:</strong> ${escapeHtml(h.verification_sop || 'Audit kitchen station.')}</div>
          </div>
        `).join('')}
      </div>

      <div style="margin-top:16px;">
        <h4 style="font-size:13.5px; font-weight:700; color:var(--text-primary); margin-bottom:6px;">Supporting Customer Review Quotes</h4>
        <div style="max-height:160px; overflow-y:auto; font-size:12px; color:var(--text-secondary);">
          ${(inv.review_quotes || []).map(q => `<div style="padding:4px 0; border-bottom:1px dashed var(--border-subtle);">• "${escapeHtml(q)}"</div>`).join('')}
        </div>
      </div>
    `;
  }
  if (modal) modal.classList.remove('hidden');
}

// ============================================================================
// 8. Action Center (/action-center)
// ============================================================================

async function fetchTasks() {
  try {
    const listEl = document.getElementById('tasksList');
    if (!listEl) return;

    const tasks = await api('/api/tasks');
    cachedTasks = tasks || [];

    if (cachedTasks.length === 0) {
      listEl.innerHTML = '<div class="empty-state">No active improvement tasks. Great job!</div>';
      return;
    }

    listEl.innerHTML = cachedTasks.map(t => {
      const isResolved = t.status === 'resolved';
      return `
        <div style="padding:16px; background:#fff; border:1px solid var(--border-subtle); border-radius:var(--radius-lg); margin-bottom:14px; box-shadow:var(--shadow-card);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <h3 style="font-family:var(--font-heading); font-size:14.5px; font-weight:700; color:var(--text-primary);">${escapeHtml(t.title)}</h3>
                <span class="badge ${t.priority_level === 'Critical Review Required' ? 'critical' : t.priority_level === 'High' ? 'negative' : 'warning'}">${t.priority_level}</span>
              </div>
              <p style="font-size:12.5px; color:var(--text-secondary); margin-top:4px;">${escapeHtml(t.description)}</p>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <select class="select-input task-status-select" data-id="${t.id}" style="width:130px;">
                <option value="open" ${t.status === 'open' ? 'selected' : ''}>Open</option>
                <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                <option value="resolved" ${t.status === 'resolved' ? 'selected' : ''}>Resolved</option>
              </select>
              ${!isResolved ? `<button class="btn btn-xs btn-primary record-outcome-btn" data-id="${t.id}">Record Outcome</button>` : '<span class="badge positive">Closed-Loop Verified</span>'}
            </div>
          </div>

          <div style="margin-top:12px; padding:10px 14px; background:var(--bg-subtle); border-radius:var(--radius-md); font-size:12px;">
            <div style="font-weight:700; color:var(--text-primary); margin-bottom:4px;">Verification Checklist:</div>
            ${(t.checklist || []).map(c => `<div>☐ ${escapeHtml(c)}</div>`).join('')}
          </div>

          ${t.outcome_result ? `
            <div style="margin-top:10px; padding:8px 12px; background:var(--emerald-subtle); border:1px solid var(--emerald-border); border-radius:var(--radius-sm); font-size:12px; color:#065f46;">
              <strong>Verified Outcome:</strong> ${escapeHtml(t.outcome_result)} (Post-Intervention: <strong>${t.after_rating}★</strong>)
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // Listeners
    document.querySelectorAll('.task-status-select').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const id = sel.getAttribute('data-id');
        await api(`/api/tasks/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: e.target.value })
        });
        showToast('Task status updated successfully!');
        await fetchTasks();
      });
    });

    document.querySelectorAll('.record-outcome-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTaskForOutcome = btn.getAttribute('data-id');
        document.getElementById('outcomeModal')?.classList.remove('hidden');
      });
    });
  } catch (e) {
    console.error('fetchTasks failed', e);
  }
}

// ============================================================================
// 9. Analytics & Benchmarking (/analytics)
// ============================================================================

async function fetchOutletsComparison() {
  try {
    const tbody = document.getElementById('outletsTableBody');
    if (!tbody) return;

    const outlets = await api('/api/reports/outlets');
    tbody.innerHTML = outlets.map(o => `
      <tr>
        <td><strong>${escapeHtml(o.outlet_name)}</strong></td>
        <td>${o.total_reviews}</td>
        <td><strong style="color:${o.average_rating >= 4 ? 'var(--emerald-primary)' : 'var(--rose-primary)'};">${o.average_rating}★</strong></td>
        <td><span class="badge positive">${o.positive_percentage}</span></td>
        <td><span class="badge negative">${o.negative_percentage}</span></td>
        <td><strong style="color:${o.safety_incidents > 0 ? 'var(--rose-primary)' : 'var(--text-dim)'};">${o.safety_incidents}</strong></td>
        <td>${o.packaging_complaints}</td>
        <td><span class="badge neutral">${o.open_tasks} open</span></td>
      </tr>
    `).join('');
  } catch (e) {
    console.error('fetchOutletsComparison failed', e);
  }
}

async function fetchMenuRevenue() {
  try {
    const grid = document.getElementById('menuIntelligenceGrid');
    if (!grid) return;

    const data = await api('/api/menu-intelligence');
    const quads = data.quadrants || {};

    grid.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div style="padding:14px; background:var(--emerald-subtle); border:1px solid var(--emerald-border); border-radius:var(--radius-md);">
          <div style="font-weight:700; color:#065f46; font-size:13px; margin-bottom:2px;">★ Stars (High Sales, High Ratings)</div>
          <p style="font-size:11px; color:#047857; margin-bottom:8px;">Core brand anchors.</p>
          <div style="display:flex; flex-wrap:wrap; gap:4px;">
            ${(quads.stars || []).map(d => `<span class="badge positive">${escapeHtml(d)}</span>`).join('') || '<span style="font-size:11px; color:#047857;">None</span>'}
          </div>
        </div>

        <div style="padding:14px; background:var(--rose-subtle); border:1px solid var(--rose-border); border-radius:var(--radius-md);">
          <div style="font-weight:700; color:#9f1239; font-size:13px; margin-bottom:2px;">⚠️ At-Risk Cash Cows (High Sales, Low Ratings)</div>
          <p style="font-size:11px; color:#be123c; margin-bottom:8px;">Critical revenue threats.</p>
          <div style="display:flex; flex-wrap:wrap; gap:4px;">
            ${(quads.cash_cows || []).map(d => `<span class="badge negative">${escapeHtml(d)}</span>`).join('') || '<span style="font-size:11px; color:#be123c;">None</span>'}
          </div>
        </div>

        <div style="padding:14px; background:var(--blue-subtle); border:1px solid var(--blue-border); border-radius:var(--radius-md);">
          <div style="font-weight:700; color:#1e40af; font-size:13px; margin-bottom:2px;">💎 Hidden Gems</div>
          <p style="font-size:11px; color:#1d4ed8; margin-bottom:8px;">High guest appreciation.</p>
          <div style="display:flex; flex-wrap:wrap; gap:4px;">
            ${(quads.hidden_gems || []).map(d => `<span class="badge blue">${escapeHtml(d)}</span>`).join('') || '<span style="font-size:11px; color:#1d4ed8;">None</span>'}
          </div>
        </div>

        <div style="padding:14px; background:var(--bg-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
          <div style="font-weight:700; color:var(--text-secondary); font-size:13px; margin-bottom:2px;">❓ Underperformers</div>
          <p style="font-size:11px; color:var(--text-muted); margin-bottom:8px;">Recipe overhaul candidates.</p>
          <div style="display:flex; flex-wrap:wrap; gap:4px;">
            ${(quads.underperformers || []).map(d => `<span class="badge neutral">${escapeHtml(d)}</span>`).join('') || '<span style="font-size:11px; color:var(--text-muted);">None</span>'}
          </div>
        </div>
      </div>
    `;
  } catch (e) {
    console.error('fetchMenuRevenue failed', e);
  }
}

async function fetchCompetitors() {
  try {
    const box = document.getElementById('competitorComparisonBox');
    if (!box) return;

    const data = await api('/api/competitor');
    const my = data.my_restaurant || {};
    const comps = data.competitors || [];

    box.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(${comps.length + 1}, 1fr); gap:12px;">
        <div style="padding:14px; background:#f0fdf4; border:2px solid var(--emerald-primary); border-radius:var(--radius-md);">
          <div style="font-weight:700; font-size:13px; color:#065f46;">Royal Spice (You)</div>
          <div style="font-size:22px; font-weight:800; color:var(--text-primary); margin:4px 0;">${my.average_rating || 2.8}★</div>
          <div style="font-size:11px; color:var(--text-muted);">${my.total_reviews} verified reviews</div>
        </div>

        ${comps.map(c => `
          <div style="padding:14px; background:#fff; border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
            <div style="font-weight:700; font-size:13px; color:var(--text-primary);">${escapeHtml(c.name)}</div>
            <div style="font-size:22px; font-weight:800; color:var(--text-primary); margin:4px 0;">${c.average_rating}★</div>
            <div style="font-size:11px; color:var(--text-muted);">${c.total_reviews} reviews</div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (e) {
    console.error('fetchCompetitors failed', e);
  }
}

async function fetchReports() {
  try {
    const container = document.getElementById('weeklyReportContainer');
    if (!container) return;

    const data = await api(`/api/reports/weekly?outlet=${encodeURIComponent(currentOutlet)}`);
    container.innerHTML = `
      <div style="padding:16px; background:var(--bg-subtle); border-radius:var(--radius-md); font-size:12.5px; line-height:1.6;">
        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
          <strong>Executive Weekly Summary</strong>
          <span style="color:var(--text-muted); font-size:11px;">Reporting Period: ${data.week_period || 'Last 7 Days'}</span>
        </div>
        <p style="color:var(--text-secondary); margin-bottom:8px;">${escapeHtml(data.executive_summary || 'Weekly review telemetry indicates key improvements in dining room service pacing alongside targeted packaging corrective actions.')}</p>
        <div style="display:flex; gap:16px; font-size:12px;">
          <span>Net Promoter Delta: <strong style="color:var(--emerald-primary);">+12 pts</strong></span>
          <span>Open Safety Tasks: <strong style="color:var(--rose-primary);">0</strong></span>
        </div>
      </div>
    `;
  } catch (e) {
    console.error('fetchReports failed', e);
  }
}

// ============================================================================
// 10. viaSocket Connectors (/integrations)
// ============================================================================

let viasocketEmbedTokenCache = null;
let viasocketServiceIdsCache = null;
let activeConnectingApp = null; // { slug, name, serviceId }
let currentConfiguringSlug = null;

// Preload the embed token and service IDs upfront so click triggers open popup without async latency
async function preloadViasocketConnect() {
  try {
    const res = await api('/api/viasocket/token');
    if (res && res.token) {
      viasocketEmbedTokenCache = res.token;
      viasocketServiceIdsCache = res.serviceIds || {};
    }
  } catch (err) {
    console.warn('Preloading viaSocket token notice:', err.message);
  }
}

// Global window message listener for viaSocket connect popup callbacks
window.addEventListener('message', async (event) => {
  const payload = event?.data;
  if (!payload || typeof payload !== 'object') return;

  if (payload.type === 'viasocket_connection_success') {
    const connData = payload.data || {};
    const authId = connData.id || payload.authId || payload.id;
    const servId = payload.serviceId || activeConnectingApp?.serviceId;
    const slug = Object.keys(viasocketServiceIdsCache || {}).find(k => viasocketServiceIdsCache[k] === servId) || activeConnectingApp?.slug;

    if (authId && slug) {
      await saveViasocketConnection(slug, authId, servId, activeConnectingApp?.name || slug);
      closeModal('viasocketConnectModal');
    }
  } else if (payload.type === 'viasocket_connection_error') {
    const errMsg = payload.error?.message || 'viaSocket connection failed';
    console.warn('viaSocket message error:', errMsg);
    showToast(errMsg, 'error');
  }
});

async function saveViasocketConnection(slug, authId, serviceId, appName) {
  try {
    await api('/api/viasocket/connected', {
      method: 'POST',
      body: JSON.stringify({
        app_name: slug,
        authId: authId,
        serviceId: serviceId
      })
    });
    showToast(`✓ Connected ${appName || slug} via viaSocket!`);
    await fetchIntegrations();
  } catch (err) {
    showToast(`Failed to persist connection: ${err.message}`, 'error');
  }
}

function triggerViasocketPopup(slug, name, serviceId) {
  activeConnectingApp = { slug, name, serviceId };

  if (typeof window.openViasocketConnection !== 'function') {
    openManualConnectFallbackModal(slug, name, serviceId);
    return;
  }

  const token = viasocketEmbedTokenCache;
  if (!token) {
    // If cache not yet ready, fetch then open helper modal
    preloadViasocketConnect().then(() => {
      openManualConnectFallbackModal(slug, name, serviceId);
    });
    return;
  }

  try {
    // Canonically call openViasocketConnection(embedToken, serviceId, extraOptions)
    const promise = window.openViasocketConnection(token, serviceId, {
      embedToken: token,
      serviceId: serviceId,
      skipActionSelection: true,
      onSuccess: async (payload) => {
        const authId = payload?.data?.id || payload?.authId || payload?.id;
        if (authId) {
          await saveViasocketConnection(slug, authId, serviceId, name);
          closeModal('viasocketConnectModal');
        }
      },
      onError: (payload) => {
        const msg = payload?.error?.message || 'Connection error';
        console.warn('viaSocket onError callback:', payload);
        if (msg.includes('blocked') || msg.includes('Popup was blocked')) {
          showToast('Browser blocked the popup. Click below to open authorization.', 'warning');
          openManualConnectFallbackModal(slug, name, serviceId);
        } else {
          showToast(msg, 'error');
        }
      },
      onClose: () => {
        console.log(`viaSocket popup closed for ${slug}`);
      }
    });

    if (promise && typeof promise.then === 'function') {
      promise.then(async (payload) => {
        if (payload?.status === 'success') {
          const authId = payload?.data?.id || payload?.authId || payload?.id;
          if (authId) {
            await saveViasocketConnection(slug, authId, serviceId, name);
            closeModal('viasocketConnectModal');
          }
        } else if (payload?.status === 'error') {
          if (payload?.error?.message?.includes('Popup was blocked') || payload?.error?.message?.includes('blocked')) {
            openManualConnectFallbackModal(slug, name, serviceId);
          }
        }
      }).catch(err => {
        console.warn('viaSocket connect promise error:', err);
      });
    }
  } catch (err) {
    console.error('Call to openViasocketConnection failed:', err);
    openManualConnectFallbackModal(slug, name, serviceId);
  }
}

function openManualConnectFallbackModal(slug, name, serviceId) {
  activeConnectingApp = { slug, name, serviceId };
  const title = document.getElementById('connectModalTitle');
  const subtitle = document.getElementById('connectModalSubtitle');
  const nameDisplay = document.getElementById('connectAppNameDisplay');
  const descDisplay = document.getElementById('connectAppDescDisplay');
  const input = document.getElementById('manualAuthIdInput');

  if (title) title.textContent = `Connect ${name} via viaSocket`;
  if (subtitle) subtitle.textContent = `Service ID: ${serviceId}`;
  if (nameDisplay) nameDisplay.textContent = `${name} (${serviceId})`;
  if (descDisplay) descDisplay.textContent = `Authorize ReviewPilot AI to read reviews and dispatch operational alerts through your ${name} account via viaSocket.`;
  if (input) input.value = '';

  openModal('viasocketConnectModal');
}

async function fetchIntegrations() {
  try {
    const grid = document.getElementById('integrationsGrid');
    if (!grid) return;

    // Preload token in background
    if (!viasocketEmbedTokenCache) {
      preloadViasocketConnect();
    }

    const data = await api('/api/integrations/catalog');
    const integrations = data.integrations || [];

    function renderActiveConfigSummary(item) {
      const cfg = item.config || {};
      const isConn = item.status === 'Connected';

      if (item.app_slug === 'google-sheets') {
        const sheetName = cfg.sheet_name || cfg.spreadsheet_name || 'Reviews';
        const tabName = cfg.worksheet_tab || 'Sheet1';
        return `
          <div class="active-config-box" style="background:var(--bg-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:10px 12px; margin-bottom:12px; font-size:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
              <span style="color:var(--text-dim); font-size:11.5px;">📄 Active Spreadsheet:</span>
              <strong style="color:var(--text-primary); font-size:12px;">${escapeHtml(sheetName)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
              <span style="color:var(--text-dim); font-size:11.5px;">📑 Worksheet Tab:</span>
              <span style="font-family:monospace; background:rgba(0,0,0,0.06); padding:1px 7px; border-radius:3px; font-weight:600; color:var(--text-secondary);">${escapeHtml(tabName)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--text-dim); font-size:11.5px;">🔄 Ingest Pipeline:</span>
              <span style="color:${isConn ? 'var(--emerald-primary)' : 'var(--text-muted)'}; font-weight:600; font-size:11px;">
                ${isConn ? '● Live via viaSocket (Auto-Ingest Ready)' : '○ Configured (Connect to Activate)'}
              </span>
            </div>
          </div>
        `;
      }

      if (item.app_slug === 'gmail') {
        const recipient = cfg.recipient_email || 'owner@royalspice.com';
        const formatLabel = cfg.report_format ? cfg.report_format.split('(')[0].trim() : 'Executive Operations Brief';
        const freqLabel = cfg.frequency === 'daily' ? 'Daily Digest (9:00 PM)' : cfg.frequency === 'weekly' ? 'Weekly Brief (Mon 8 AM)' : 'Real-Time on Critical Spikes';
        return `
          <div class="active-config-box" style="background:var(--bg-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:10px 12px; margin-bottom:12px; font-size:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
              <span style="color:var(--text-dim); font-size:11.5px;">✉️ Alert Recipient:</span>
              <strong style="color:var(--text-primary); font-size:12px; word-break:break-all;">${escapeHtml(recipient)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
              <span style="color:var(--text-dim); font-size:11.5px;">📋 Report Format:</span>
              <span style="color:var(--text-secondary); font-size:11.5px;">${escapeHtml(formatLabel)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--text-dim); font-size:11.5px;">⏰ Alert Frequency:</span>
              <span style="color:${isConn ? 'var(--emerald-primary)' : 'var(--text-muted)'}; font-weight:600; font-size:11px;">
                ${escapeHtml(freqLabel)}
              </span>
            </div>
          </div>
        `;
      }

      if (item.app_slug === 'slack') {
        const channel = cfg.channel || '#kitchen-alerts';
        return `
          <div class="active-config-box" style="background:var(--bg-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:10px 12px; margin-bottom:12px; font-size:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
              <span style="color:var(--text-dim); font-size:11.5px;">💬 Alert Channel:</span>
              <strong style="color:var(--text-primary); font-family:monospace; font-size:12px;">${escapeHtml(channel)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--text-dim); font-size:11.5px;">⚡ Trigger Filters:</span>
              <span style="color:${isConn ? 'var(--emerald-primary)' : 'var(--text-muted)'}; font-weight:600; font-size:11px;">
                Food Safety, 1★/2★ Spikes
              </span>
            </div>
          </div>
        `;
      }

      if (item.app_slug === 'google-business-profile') {
        const loc = cfg.location_name || 'Downtown Flagship';
        return `
          <div class="active-config-box" style="background:var(--bg-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:10px 12px; margin-bottom:12px; font-size:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
              <span style="color:var(--text-dim); font-size:11.5px;">📍 Google Location:</span>
              <strong style="color:var(--text-primary); font-size:12px;">${escapeHtml(loc)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--text-dim); font-size:11.5px;">🤖 AI Response Mode:</span>
              <span style="color:${isConn ? 'var(--emerald-primary)' : 'var(--text-muted)'}; font-weight:600; font-size:11px;">
                Manager 1-Click Approval
              </span>
            </div>
          </div>
        `;
      }

      if (item.app_slug === 'square') {
        const term = cfg.terminal_name ? cfg.terminal_name.split('(')[0].trim() : 'Downtown Flagship - Terminal 1';
        return `
          <div class="active-config-box" style="background:var(--bg-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:10px 12px; margin-bottom:12px; font-size:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
              <span style="color:var(--text-dim); font-size:11.5px;">💳 POS Terminal:</span>
              <strong style="color:var(--text-primary); font-size:12px;">${escapeHtml(term)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="color:var(--text-dim); font-size:11.5px;">🛒 Sync Engine:</span>
              <span style="color:${isConn ? 'var(--emerald-primary)' : 'var(--text-muted)'}; font-weight:600; font-size:11px;">
                Orders, Refunds & Ratings
              </span>
            </div>
          </div>
        `;
      }

      return '';
    }

    grid.innerHTML = integrations.map(item => {
      const isConnected = item.status === 'Connected';
      return `
        <div class="card" style="margin-bottom:0; display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
              <div>
                <div style="font-family:var(--font-heading); font-size:15px; font-weight:700;">${escapeHtml(item.name)}</div>
                <div style="font-size:11px; color:var(--text-dim); margin-top:2px;">Service ID: <code>${item.service_id}</code></div>
              </div>
              <span class="badge ${isConnected ? 'positive' : 'neutral'}">${item.status}</span>
            </div>
            <p style="font-size:12px; color:var(--text-muted); margin-bottom:12px; line-height:1.45;">${escapeHtml(item.description)}</p>
            ${renderActiveConfigSummary(item)}
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-subtle); padding-top:12px; margin-top:4px; flex-wrap:wrap; gap:8px;">
            ${isConnected ? `
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <button class="btn btn-sm btn-outline btn-configure-app" data-slug="${item.app_slug}" data-name="${item.name}" data-auth="${item.auth_id || ''}" style="font-weight:600;">⚙️ Configure / Edit</button>
                ${(item.app_slug === 'google-sheets' || item.app_slug === 'google-business-profile' || item.app_slug === 'square') ? `
                  <button class="btn btn-sm btn-success btn-fetch-app-reviews" data-slug="${item.app_slug}">📥 Fetch Reviews</button>
                ` : ''}
                ${item.app_slug === 'gmail' ? `
                  <button class="btn btn-sm btn-outline btn-send-test-alert" data-target-app="gmail" data-type="email" data-original-text="✉️ Send Test Email" data-recipient="${escapeHtml(item.config?.recipient_email || 'vyash5580@gmail.com')}" data-format="${escapeHtml(item.config?.report_format || 'Executive Operations Brief')}" title="Send test executive operations brief">✉️ Send Test Email</button>
                ` : ''}
                ${item.app_slug === 'slack' ? `
                  <button class="btn btn-sm btn-outline btn-send-test-alert" data-target-app="slack" data-type="slack" data-channel="${escapeHtml(item.config?.channel || '#kitchen-alerts')}" data-original-text="💬 Send Test Slack" title="Send test kitchen Slack alert">💬 Send Test Slack</button>
                ` : ''}
              </div>
              <button class="btn btn-xs btn-ghost btn-disconnect-app" data-slug="${item.app_slug}" style="color:var(--rose-primary);">Disconnect</button>
            ` : `
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <button class="btn btn-sm btn-primary btn-connect-viasocket" data-slug="${item.app_slug}" data-name="${item.name}" data-service="${item.service_id}">Connect via viaSocket</button>
                <button class="btn btn-sm btn-outline btn-configure-app" data-slug="${item.app_slug}" data-name="${item.name}" data-auth="" style="font-weight:600;">⚙️ Configure / Edit</button>
              </div>
              <button class="btn btn-xs btn-ghost btn-connect-options" data-slug="${item.app_slug}" data-name="${item.name}" data-service="${item.service_id}" title="Manual auth_id / Sandbox options">🔑 Auth</button>
            `}
          </div>
        </div>
      `;
    }).join('');

    // Connect direct click listener
    document.querySelectorAll('.btn-connect-viasocket').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const slug = btn.getAttribute('data-slug');
        const name = btn.getAttribute('data-name');
        const serviceId = btn.getAttribute('data-service') || viasocketServiceIdsCache?.[slug] || 'rowr707oknl4';
        triggerViasocketPopup(slug, name, serviceId);
      });
    });

    // Connection options helper listener
    document.querySelectorAll('.btn-connect-options').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const slug = btn.getAttribute('data-slug');
        const name = btn.getAttribute('data-name');
        const serviceId = btn.getAttribute('data-service') || viasocketServiceIdsCache?.[slug] || 'rowr707oknl4';
        openManualConnectFallbackModal(slug, name, serviceId);
      });
    });

    // Fetch reviews listener
    document.querySelectorAll('.btn-fetch-app-reviews').forEach(btn => {
      btn.addEventListener('click', async () => {
        const slug = btn.getAttribute('data-slug');
        btn.textContent = 'Fetching...';
        btn.disabled = true;
        try {
          const res = await api(`/api/integrations/${slug}/fetch`, { method: 'POST' });
          showToast(res.message || 'Reviews fetched and analyzed!');
          await fetchReviews();
          await fetchOverview();
          await fetchIntegrations();
        } catch (err) {
          showToast(`Fetch error: ${err.message}`, 'error');
        } finally {
          btn.textContent = '📥 Fetch Reviews';
          btn.disabled = false;
        }
      });
    });

    // Test Alert Dispatch Listener directly from card (for Gmail and Slack)
    document.querySelectorAll('.btn-send-test-alert').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const slug = btn.getAttribute('data-target-app') || btn.getAttribute('data-slug') || 'gmail';
        const defaultText = btn.getAttribute('data-original-text') || (slug === 'gmail' ? '✉️ Send Test Email' : '💬 Send Test Slack');
        const recipient = btn.getAttribute('data-recipient') || 'vyash5580@gmail.com';
        const format = btn.getAttribute('data-format') || 'Executive Operations Brief';
        const channel = btn.getAttribute('data-channel') || '#kitchen-alerts';

        btn.textContent = 'Sending...';
        btn.disabled = true;

        try {
          const payload = slug === 'gmail'
            ? { channel: 'Gmail', target_app: 'gmail', recipient_email: recipient, format: format, alert_title: 'Executive Brief Test Alert', alert_message: 'Real-time dining telemetry & task digest from ReviewPilot AI via viaSocket.', severity: 'normal' }
            : { channel: channel, target_app: 'slack', alert_title: 'High-Severity Food Quality Spike Test', alert_message: 'Urgent: Table 14 reported undercooked chicken tikka. Action task created for Kitchen Manager.', severity: 'critical' };
          
          const res = await api('/api/integrations/dispatch-alert', {
            method: 'POST',
            body: JSON.stringify(payload)
          });

          if (res.error || res.success === false) {
            throw new Error(res.error || 'Dispatch returned an error');
          }

          if (slug === 'gmail') {
            const mode = res.live_dispatched ? '● Live Email Sent' : '✓ Email Dispatched';
            showToast(`${mode} to ${res.recipient_email || recipient}!`);
          } else {
            const mode = res.live_dispatched ? '● Live Slack Delivered' : '✓ Alert Dispatched';
            showToast(`${mode} to ${res.dispatched_to || channel}!`);
          }

          btn.textContent = slug === 'gmail' ? '✓ Email Sent!' : '✓ Alert Sent!';
          btn.style.borderColor = 'var(--emerald-primary)';
          btn.style.color = 'var(--emerald-hover)';
          setTimeout(() => {
            btn.textContent = defaultText;
            btn.style.borderColor = '';
            btn.style.color = '';
            btn.disabled = false;
          }, 2500);
        } catch (err) {
          showToast(`Dispatch failed: ${err.message}`, 'error');
          btn.textContent = '⚠️ Send Failed';
          btn.style.borderColor = 'var(--rose-primary)';
          btn.style.color = 'var(--rose-primary)';
          setTimeout(() => {
            btn.textContent = defaultText;
            btn.style.borderColor = '';
            btn.style.color = '';
            btn.disabled = false;
          }, 2500);
        }
      });
    });

    // Disconnect listener
    document.querySelectorAll('.btn-disconnect-app').forEach(btn => {
      btn.addEventListener('click', async () => {
        const slug = btn.getAttribute('data-slug');
        if (confirm(`Disconnect ${slug}?`)) {
          await api('/api/viasocket/disconnect', {
            method: 'POST',
            body: JSON.stringify({ app_name: slug })
          });
          showToast(`Disconnected ${slug}`);
          await fetchIntegrations();
        }
      });
    });

    // Configure listener
    document.querySelectorAll('.btn-configure-app').forEach(btn => {
      btn.addEventListener('click', () => {
        const slug = btn.getAttribute('data-slug');
        const name = btn.getAttribute('data-name');
        const auth = btn.getAttribute('data-auth');
        openIntegrationConfigModal(slug, name, auth);
      });
    });

    // Also load Phase 6 AI Automation Workflows
    await fetchAutomations();
  } catch (e) {
    console.error('fetchIntegrations failed', e);
  }
}

async function openIntegrationConfigModal(slug, name, authId) {
  currentConfiguringSlug = slug;
  openModal('integrationConfigModal');

  const title = document.getElementById('cfgModalTitle');
  const subtitle = document.getElementById('cfgModalSubtitle');
  const authDisplay = document.getElementById('cfgAuthIdDisplay');
  const loading = document.getElementById('cfgLoadingNotice');
  const content = document.getElementById('cfgFormContent');

  if (title) title.textContent = `Configure ${name}`;
  if (subtitle) {
    if (slug === 'google-sheets') {
      subtitle.textContent = 'Select target Google Spreadsheet, choose worksheet tab, and review column mapping.';
    } else if (slug === 'gmail') {
      subtitle.textContent = 'Set recipient email address, choose operations brief format, and configure alert triggers.';
    } else if (slug === 'slack') {
      subtitle.textContent = 'Select kitchen alert channel, set trigger filters, and test notifications.';
    } else if (slug === 'google-business-profile') {
      subtitle.textContent = 'Map restaurant location outlets and select AI review reply automation policy.';
    } else if (slug === 'square') {
      subtitle.textContent = 'Select POS terminal, configure order sync, and checkout review collection.';
    } else {
      subtitle.textContent = 'Customize integration mapping and parameters.';
    }
  }

  if (authDisplay) authDisplay.textContent = authId ? `Auth ID: ${authId}` : 'Status: Ready to configure';
  if (loading) loading.style.display = 'block';
  if (content) {
    content.style.display = 'none';
    content.innerHTML = '';
  }

  try {
    const data = await api(`/api/integrations/${slug}/options?auth_id=${encodeURIComponent(authId || '')}`);
    if (loading) loading.style.display = 'none';
    if (!content) return;
    content.style.display = 'block';

    const cfg = data.current_config || {};

    if (slug === 'google-sheets') {
      const sheets = data.spreadsheets || [];
      const tabs = data.sheets_tabs || [{ id: '0', name: 'Sheet1' }];
      const currentSheetName = cfg.sheet_name || cfg.spreadsheet_name || 'Reviews';
      const currentTabName = cfg.worksheet_tab || 'Sheet1';

      content.innerHTML = `
        <div style="background:var(--emerald-subtle); border:1px solid var(--emerald-border); border-radius:var(--radius-sm); padding:10px 14px; margin-bottom:16px;">
          <div style="font-size:12.5px; font-weight:700; color:var(--emerald-hover); margin-bottom:2px;">
            📊 Google Sheets viaSocket Connection Active
          </div>
          <div style="font-size:11.5px; color:var(--text-secondary);">
            Choose which spreadsheet and sheet tab ReviewPilot AI reads customer reviews from and exports action trackers to.
          </div>
        </div>

        <div class="form-group" style="margin-bottom:14px;">
          <label class="form-label" style="font-size:12px; font-weight:700;">1. Target Google Spreadsheet</label>
          <select id="cfgSheetSelect" class="form-input" style="font-weight:600;">
            ${sheets.map(s => {
              const isSelected = (currentSheetName === s.name || (!cfg.sheet_name && s.is_default));
              const label = `${s.name}${s.total_rows ? ` (${s.total_rows} rows)` : ''}${s.is_default ? ' [Default]' : ''}`;
              return `<option value="${escapeHtml(s.name)}" data-id="${escapeHtml(s.id)}" ${isSelected ? 'selected' : ''}>${escapeHtml(label)}</option>`;
            }).join('')}
          </select>
        </div>

        <div id="cfgCustomSheetGroup" class="form-group" style="margin-bottom:14px; display:${currentSheetName && !sheets.some(s => s.name === currentSheetName && !s.is_custom) ? 'block' : 'none'};">
          <label class="form-label" style="font-size:12px; font-weight:700;">Custom Spreadsheet Name or Google Sheet URL</label>
          <input type="text" id="cfgCustomSheetInput" class="form-input" placeholder="e.g. https://docs.google.com/spreadsheets/d/1Y8tL_01... or Reviews" value="${escapeHtml(cfg.spreadsheet_name || '')}">
          <div style="font-size:11px; color:var(--text-dim); margin-top:3px;">You can paste any Google Sheet link or name. viaSocket will automatically resolve the ID.</div>
        </div>

        <div class="form-group" style="margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <label class="form-label" style="font-size:12px; font-weight:700; margin-bottom:0;">2. Worksheet Tab (Sheet)</label>
            <span id="cfgTabsLoading" style="display:none; font-size:11px; color:var(--emerald-primary);">↻ Refreshing tabs...</span>
          </div>
          <select id="cfgTabSelect" class="form-input" style="font-weight:600;">
            ${tabs.map(t => `<option value="${escapeHtml(t.name)}" ${(currentTabName === t.name || t.name === 'Sheet1') ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
            <option value="__custom_tab__">+ Enter Custom Sheet Tab Name</option>
          </select>
        </div>

        <div id="cfgCustomTabGroup" class="form-group" style="margin-bottom:14px; display:none;">
          <label class="form-label" style="font-size:12px; font-weight:700;">Custom Sheet Tab Name</label>
          <input type="text" id="cfgCustomTabInput" class="form-input" placeholder="e.g. Customer Reviews or Sheet2" value="${escapeHtml(currentTabName)}">
        </div>

        <div style="background:var(--bg-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:12px; margin-bottom:14px;">
          <div style="font-size:12px; font-weight:700; color:var(--text-primary); margin-bottom:6px;">3. Automatic Column Mapping Preview</div>
          <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:6px; font-size:11px; color:var(--text-secondary);">
            <div style="background:#fff; border:1px solid var(--border-subtle); padding:4px 6px; border-radius:3px;"><strong>Col A:</strong> Outlet Name</div>
            <div style="background:#fff; border:1px solid var(--border-subtle); padding:4px 6px; border-radius:3px;"><strong>Col B:</strong> Review Source</div>
            <div style="background:#fff; border:1px solid var(--border-subtle); padding:4px 6px; border-radius:3px;"><strong>Col C:</strong> Customer Name</div>
            <div style="background:#fff; border:1px solid var(--border-subtle); padding:4px 6px; border-radius:3px;"><strong>Col D:</strong> Star Rating (1-5)</div>
            <div style="background:#fff; border:1px solid var(--border-subtle); padding:4px 6px; border-radius:3px;"><strong>Col E:</strong> Review Text</div>
            <div style="background:#fff; border:1px solid var(--border-subtle); padding:4px 6px; border-radius:3px;"><strong>Col F:</strong> Review Date</div>
          </div>
        </div>

        <div style="border-top:1px dashed var(--border-subtle); padding-top:12px;">
          <button type="button" id="btnModalTestFetchSheet" class="btn btn-sm btn-outline" style="width:100%; justify-content:center; padding:9px;">
            📥 Test Ingest / Read Rows From This Sheet Now
          </button>
          <div id="sheetTestFeedback" style="display:none; font-size:12px; margin-top:8px; padding:8px 12px; border-radius:var(--radius-sm);"></div>
        </div>
      `;

      // Dynamic Tab Loader on Spreadsheet Select Change
      const sheetSelect = document.getElementById('cfgSheetSelect');
      const customSheetGroup = document.getElementById('cfgCustomSheetGroup');
      const tabSelect = document.getElementById('cfgTabSelect');
      const customTabGroup = document.getElementById('cfgCustomTabGroup');
      const tabsLoading = document.getElementById('cfgTabsLoading');

      if (sheetSelect) {
        sheetSelect.addEventListener('change', async () => {
          const selectedOption = sheetSelect.options[sheetSelect.selectedIndex];
          const selectedId = selectedOption?.getAttribute('data-id');
          const isCustom = selectedOption?.value?.includes('Custom') || selectedId === 'custom';

          if (customSheetGroup) {
            customSheetGroup.style.display = isCustom ? 'block' : 'none';
          }

          if (selectedId && !isCustom && tabSelect) {
            try {
              if (tabsLoading) tabsLoading.style.display = 'inline';
              const res = await api(`/api/integrations/google-sheets/tabs?spreadsheet_id=${encodeURIComponent(selectedId)}`);
              if (res.tabs && res.tabs.length > 0) {
                tabSelect.innerHTML = res.tabs.map(t => `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</option>`).join('') + '<option value="__custom_tab__">+ Enter Custom Sheet Tab Name</option>';
              }
            } catch (tabErr) {
              console.warn('Failed to load tabs dynamically:', tabErr);
            } finally {
              if (tabsLoading) tabsLoading.style.display = 'none';
            }
          }
        });
      }

      if (tabSelect) {
        tabSelect.addEventListener('change', () => {
          if (customTabGroup) {
            customTabGroup.style.display = tabSelect.value === '__custom_tab__' ? 'block' : 'none';
          }
        });
      }

      // Live Test Ingest Button Listener inside Modal
      const testBtn = document.getElementById('btnModalTestFetchSheet');
      const feedback = document.getElementById('sheetTestFeedback');
      if (testBtn) {
        testBtn.addEventListener('click', async () => {
          testBtn.textContent = 'Reading rows from Google Sheets via viaSocket...';
          testBtn.disabled = true;
          try {
            const res = await api('/api/integrations/google-sheets/fetch', { method: 'POST' });
            if (feedback) {
              feedback.style.display = 'block';
              feedback.style.background = 'var(--emerald-subtle)';
              feedback.style.border = '1px solid var(--emerald-border)';
              feedback.style.color = 'var(--emerald-hover)';
              feedback.innerHTML = `<strong>✓ Success:</strong> ${escapeHtml(res.message || 'Synced and analyzed reviews from Google Sheet!')}`;
            }
            await fetchReviews();
            await fetchOverview();
          } catch (err) {
            if (feedback) {
              feedback.style.display = 'block';
              feedback.style.background = 'var(--rose-subtle)';
              feedback.style.border = '1px solid var(--rose-border)';
              feedback.style.color = 'var(--rose-primary)';
              feedback.innerHTML = `<strong>Fetch notice:</strong> ${escapeHtml(err.message)}`;
            }
          } finally {
            testBtn.textContent = '📥 Test Ingest / Read Rows From This Sheet Now';
            testBtn.disabled = false;
          }
        });
      }

    } else if (slug === 'gmail') {
      const formats = data.formats || [
        { id: 'executive_brief', label: 'Executive Operations Brief (Summary + Issues + Tasks)' },
        { id: 'urgent_alert', label: 'Real-Time Incident Alert (Immediate on Food Safety & 1-2★)' },
        { id: 'weekly_digest', label: 'Weekly CX & Revenue Intelligence Scorecard' }
      ];
      const frequencies = data.frequencies || [
        { id: 'realtime', label: 'Real-Time Alerts (Instant on high-severity reviews & food safety)' },
        { id: 'daily', label: 'Daily Evening Operations Digest (9:00 PM)' },
        { id: 'weekly', label: 'Weekly Executive Brief (Mondays 8:00 AM)' }
      ];

      const recipient = cfg.recipient_email || data.default_recipient || 'owner@royalspice.com';
      const curFormat = cfg.report_format || 'Executive Operations Brief (Summary + Issues + Tasks)';
      const curFreq = cfg.frequency || 'realtime';
      const curSubject = cfg.subject_prefix || '[ReviewPilot Alert] Royal Spice Kitchen';

      content.innerHTML = `
        <div style="background:var(--blue-subtle); border:1px solid var(--blue-border); border-radius:var(--radius-sm); padding:10px 14px; margin-bottom:16px;">
          <div style="font-size:12.5px; font-weight:700; color:var(--blue-primary); margin-bottom:2px;">
            ✉️ Gmail viaSocket Action (rowogelpy0h6) Active
          </div>
          <div style="font-size:11.5px; color:var(--text-secondary);">
            Automate executive reports, food safety alerts, and weekly CX intelligence dispatches directly to restaurant owners and general managers.
          </div>
        </div>

        <div class="form-group" style="margin-bottom:14px;">
          <label class="form-label" style="font-size:12px; font-weight:700;">1. Notification Recipient Email Address</label>
          <input type="email" id="cfgGmailRecipient" class="form-input" style="font-weight:600;" value="${escapeHtml(recipient)}" placeholder="e.g. owner@royalspice.com">
          <div style="font-size:11px; color:var(--text-dim); margin-top:3px;">Reports and urgent alerts will be sent directly to this address.</div>
        </div>

        <div class="form-group" style="margin-bottom:14px;">
          <label class="form-label" style="font-size:12px; font-weight:700;">2. Executive Operations Report Format</label>
          <select id="cfgGmailFormat" class="form-input">
            ${formats.map(f => `<option value="${escapeHtml(f.label)}" ${curFormat === f.label || curFormat.startsWith(f.id) ? 'selected' : ''}>${escapeHtml(f.label)}</option>`).join('')}
          </select>
        </div>

        <div class="form-group" style="margin-bottom:14px;">
          <label class="form-label" style="font-size:12px; font-weight:700;">3. Delivery Frequency & Alert Policy</label>
          <select id="cfgGmailFrequency" class="form-input">
            ${frequencies.map(f => `<option value="${escapeHtml(f.id)}" ${curFreq === f.id ? 'selected' : ''}>${escapeHtml(f.label)}</option>`).join('')}
          </select>
        </div>

        <div class="form-group" style="margin-bottom:14px;">
          <label class="form-label" style="font-size:12px; font-weight:700;">4. Subject Line Prefix</label>
          <input type="text" id="cfgGmailSubject" class="form-input" value="${escapeHtml(curSubject)}" placeholder="e.g. [ReviewPilot Alert] Royal Spice Kitchen">
        </div>

        <div style="border-top:1px dashed var(--border-subtle); padding-top:12px;">
          <button type="button" id="btnModalSendTestEmail" class="btn btn-sm btn-outline" style="width:100%; justify-content:center; padding:9px;">
            ✉️ Send Test Executive Operations Brief to this Email Address Now
          </button>
          <div id="gmailTestFeedback" style="display:none; font-size:12px; margin-top:8px; padding:8px 12px; border-radius:var(--radius-sm);"></div>
        </div>
      `;

      const testEmailBtn = document.getElementById('btnModalSendTestEmail');
      const emailFeedback = document.getElementById('gmailTestFeedback');
      if (testEmailBtn) {
        testEmailBtn.addEventListener('click', async () => {
          const targetEmail = document.getElementById('cfgGmailRecipient')?.value?.trim() || recipient;
          const targetFormat = document.getElementById('cfgGmailFormat')?.value || curFormat;
          const targetSubject = document.getElementById('cfgGmailSubject')?.value?.trim() || curSubject;
          testEmailBtn.textContent = 'Sending test email via viaSocket...';
          testEmailBtn.disabled = true;
          try {
            const res = await api('/api/integrations/dispatch-alert', {
              method: 'POST',
              body: JSON.stringify({
                channel: 'Gmail',
                recipient_email: targetEmail,
                format: targetFormat,
                alert_title: `${targetSubject}: Executive Operations Brief`,
                alert_message: `ReviewPilot AI weekly summary: 20 customer dining reviews analyzed, 85% positive sentiment. Critical items: 1 cold chain packaging SOP alert assigned to Kitchen Manager.`,
                severity: 'normal'
              })
            });

            if (res.error || res.success === false) {
              throw new Error(res.error || 'Failed to dispatch test email');
            }

            if (emailFeedback) {
              emailFeedback.style.display = 'block';
              emailFeedback.style.background = 'var(--emerald-subtle)';
              emailFeedback.style.border = '1px solid var(--emerald-border)';
              emailFeedback.style.color = 'var(--emerald-hover)';
              emailFeedback.innerHTML = `<strong>✓ Email Dispatched:</strong> Test operations brief sent to <strong>${escapeHtml(res.recipient_email || targetEmail)}</strong> via viaSocket action <code>rowogelpy0h6</code>! (Status: ${escapeHtml(res.status || 'Delivered')})`;
            }
            showToast(`✓ Test executive brief dispatched to ${res.recipient_email || targetEmail}!`);
            testEmailBtn.textContent = '✓ Test Email Dispatched!';
            setTimeout(() => {
              testEmailBtn.textContent = '✉️ Send Test Executive Operations Brief to this Email Address Now';
              testEmailBtn.disabled = false;
            }, 2500);
          } catch (err) {
            if (emailFeedback) {
              emailFeedback.style.display = 'block';
              emailFeedback.style.background = 'var(--rose-subtle)';
              emailFeedback.style.border = '1px solid var(--rose-border)';
              emailFeedback.style.color = 'var(--rose-primary)';
              emailFeedback.innerHTML = `<strong>Dispatch failed:</strong> ${escapeHtml(err.message)}`;
            }
            showToast(`Dispatch failed: ${err.message}`, 'error');
            testEmailBtn.textContent = '✉️ Send Test Executive Operations Brief to this Email Address Now';
            testEmailBtn.disabled = false;
          }
        });
      }

    } else if (slug === 'slack') {
      const channels = (data.channels || []).filter(c => c.id !== 'custom' && !c.name.includes('Custom Channel'));
      const isLive = data.is_live || channels.some(c => c.is_live);
      const wsName = data.workspace_name ? ` (${escapeHtml(data.workspace_name)})` : '';
      const curChannel = cfg.channel || (channels.length > 0 ? channels[0].name : '#kitchen-alerts');

      content.innerHTML = `
        <div style="background:${isLive ? 'var(--emerald-subtle)' : 'var(--bg-subtle)'}; border:1px solid ${isLive ? 'var(--emerald-border)' : 'var(--border-subtle)'}; border-radius:var(--radius-sm); padding:10px 14px; margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:12.5px; font-weight:700; color:${isLive ? 'var(--emerald-hover)' : 'var(--text-primary)'}; margin-bottom:2px;">
              💬 Slack Channel Integration (row1jrbor)${wsName}
            </div>
            ${isLive ? '<span class="badge positive" style="font-size:10.5px; padding:2px 8px;">● Live Workspace Synced</span>' : '<span class="badge neutral" style="font-size:10.5px; padding:2px 8px;">○ Default Presets</span>'}
          </div>
          <div style="font-size:11.5px; color:var(--text-secondary); margin-top:3px;">
            ${isLive 
              ? `Connected live to your Slack workspace. Select target channels fetched directly from your Slack account.`
              : `Instantly alert kitchen staff and restaurant managers when customers mention food safety, foreign objects, or post 1★/2★ reviews.`}
          </div>
        </div>

        <div class="form-group" style="margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <label class="form-label" style="font-size:12px; font-weight:700; margin-bottom:0;">1. Target Kitchen / Operations Channel</label>
            <span style="font-size:11px; color:${isLive ? 'var(--emerald-primary)' : 'var(--text-dim)'}; font-weight:600;">
              ${isLive ? `✓ ${channels.length} live channels fetched` : `${channels.length} preset channels`}
            </span>
          </div>
          <select id="cfgSlackChannel" class="form-input" style="font-weight:600;">
            ${channels.map(c => `<option value="${escapeHtml(c.name)}" ${curChannel === c.name ? 'selected' : ''}>${escapeHtml(c.name)} ${c.purpose ? `— ${escapeHtml(c.purpose)}` : ''}</option>`).join('')}
            ${curChannel && !channels.some(c => c.name === curChannel) && curChannel !== '__custom_channel__' ? `<option value="${escapeHtml(curChannel)}" selected>${escapeHtml(curChannel)} (Saved Channel)</option>` : ''}
            <option value="__custom_channel__">+ Enter Custom Channel Name</option>
          </select>
        </div>

        <div id="cfgCustomChannelGroup" class="form-group" style="margin-bottom:14px; display:${curChannel === '__custom_channel__' ? 'block' : 'none'};">
          <label class="form-label" style="font-size:12px; font-weight:700;">Custom Channel Name</label>
          <input type="text" id="cfgSlackCustomChannel" class="form-input" placeholder="e.g. #kitchen-alerts or #chef-duty-room" value="${escapeHtml(curChannel !== '__custom_channel__' ? curChannel : '')}">
        </div>

        <div style="margin-bottom:14px;">
          <div style="font-size:12px; margin-bottom:8px; font-weight:700;">2. Automated Notification Triggers:</div>
          <div style="display:flex; flex-direction:column; gap:8px; font-size:12.5px; color:var(--text-secondary);">
            <label style="display:flex; align-items:center; gap:8px;">
              <input type="checkbox" id="cfgAlertFoodSafety" ${cfg.alert_food_safety !== false ? 'checked' : ''}>
              <span>Critical food safety, foreign object, and raw cooking alerts (Immediate)</span>
            </label>
            <label style="display:flex; align-items:center; gap:8px;">
              <input type="checkbox" id="cfgAlertNegative" ${cfg.alert_negative !== false ? 'checked' : ''}>
              <span>1★ and 2★ negative review spikes across all outlets (Immediate)</span>
            </label>
            <label style="display:flex; align-items:center; gap:8px;">
              <input type="checkbox" id="cfgAlertSummary" ${cfg.alert_summary ? 'checked' : ''}>
              <span>Daily executive operations brief and open task summary (9:00 PM)</span>
            </label>
          </div>
        </div>

        <div style="border-top:1px dashed var(--border-subtle); padding-top:12px;">
          <button type="button" id="btnModalSendTestSlack" class="btn btn-sm btn-outline" style="width:100%; justify-content:center; padding:9px;">
            💬 Send Test Alert to Kitchen Slack Channel Now
          </button>
          <div id="slackTestFeedback" style="display:none; font-size:12px; margin-top:8px; padding:8px 12px; border-radius:var(--radius-sm);"></div>
        </div>
      `;

      const slackChanSelect = document.getElementById('cfgSlackChannel');
      const customChanGroup = document.getElementById('cfgCustomChannelGroup');
      if (slackChanSelect && customChanGroup) {
        slackChanSelect.addEventListener('change', () => {
          customChanGroup.style.display = slackChanSelect.value === '__custom_channel__' ? 'block' : 'none';
        });
      }

      const testSlackBtn = document.getElementById('btnModalSendTestSlack');
      const slackFeedback = document.getElementById('slackTestFeedback');
      if (testSlackBtn) {
        testSlackBtn.addEventListener('click', async () => {
          const chan = slackChanSelect?.value === '__custom_channel__'
            ? (document.getElementById('cfgSlackCustomChannel')?.value || '#kitchen-alerts')
            : (slackChanSelect?.value || '#kitchen-alerts');
          testSlackBtn.textContent = 'Dispatching test Slack alert...';
          testSlackBtn.disabled = true;
          try {
            const res = await api('/api/integrations/dispatch-alert', {
              method: 'POST',
              body: JSON.stringify({
                target_app: 'slack',
                channel: chan,
                alert_title: '🚨 Kitchen Quality Alert: Undercooked Prawns (Table 14)',
                alert_message: 'Customer feedback submitted 5m ago: "Prawn curry had raw center." Task #task-01 opened for Head Chef audit.',
                severity: 'urgent'
              })
            });

            if (res.error || res.success === false) {
              throw new Error(res.error || 'Failed to dispatch test alert');
            }

            if (slackFeedback) {
              slackFeedback.style.display = 'block';
              slackFeedback.style.background = 'var(--emerald-subtle)';
              slackFeedback.style.border = '1px solid var(--emerald-border)';
              slackFeedback.style.color = 'var(--emerald-hover)';
              const badge = res.live_dispatched ? '● Live Slack Delivered' : '✓ Alert Delivered';
              slackFeedback.innerHTML = `<strong>${badge}:</strong> Test notification sent to <strong>${escapeHtml(res.dispatched_to || chan)}</strong> via viaSocket action <code>row1jrbor</code>!`;
            }
            const toastMode = res.live_dispatched ? '● Live Slack Delivered' : '✓ Test alert dispatched';
            showToast(`${toastMode} to ${res.dispatched_to || chan}!`);
            testSlackBtn.textContent = '✓ Alert Dispatched!';
            setTimeout(() => {
              testSlackBtn.textContent = '💬 Send Test Alert to Kitchen Slack Channel Now';
              testSlackBtn.disabled = false;
            }, 2500);
          } catch (err) {
            if (slackFeedback) {
              slackFeedback.style.display = 'block';
              slackFeedback.style.background = 'var(--rose-subtle)';
              slackFeedback.style.border = '1px solid var(--rose-border)';
              slackFeedback.style.color = 'var(--rose-primary)';
              slackFeedback.innerHTML = `<strong>Dispatch failed:</strong> ${escapeHtml(err.message)}`;
            }
            showToast(`Dispatch failed: ${err.message}`, 'error');
            testSlackBtn.textContent = '💬 Send Test Alert to Kitchen Slack Channel Now';
            testSlackBtn.disabled = false;
          }
        });
      }

    } else if (slug === 'google-business-profile') {
      const locations = data.locations || [
        { id: 'loc_1', name: 'Downtown Flagship', outlet_name: 'Downtown Flagship' },
        { id: 'loc_2', name: 'Cyber City Cloud Kitchen', outlet_name: 'Cyber City Cloud Kitchen' },
        { id: 'loc_3', name: 'Westend Mall', outlet_name: 'Westend Mall' }
      ];
      const curLoc = cfg.location_name || 'Downtown Flagship';
      const curMode = cfg.reply_mode || 'draft_approval';

      content.innerHTML = `
        <div style="background:var(--emerald-subtle); border:1px solid var(--emerald-border); border-radius:var(--radius-sm); padding:10px 14px; margin-bottom:16px;">
          <div style="font-size:12.5px; font-weight:700; color:var(--emerald-hover); margin-bottom:2px;">
            📍 Google Business Profile viaSocket Sync Active
          </div>
          <div style="font-size:11.5px; color:var(--text-secondary);">
            Sync customer reviews and draft AI responses with 1-click manager approval safeguards.
          </div>
        </div>

        <div class="form-group" style="margin-bottom:14px;">
          <label class="form-label" style="font-size:12px; font-weight:700;">1. Target Restaurant Location</label>
          <select id="cfgGbpLocation" class="form-input" style="font-weight:600;">
            ${locations.map(l => `<option value="${escapeHtml(l.outlet_name || l.name)}" ${curLoc === (l.outlet_name || l.name) ? 'selected' : ''}>${escapeHtml(l.name)}</option>`).join('')}
            <option value="All Outlets" ${curLoc === 'All Outlets' ? 'selected' : ''}>All Locations (Multi-Outlet Sync)</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom:14px;">
          <label class="form-label" style="font-size:12px; font-weight:700;">2. AI Response Approval Policy</label>
          <select id="cfgGbpReplyMode" class="form-input">
            <option value="draft_approval" ${curMode === 'draft_approval' ? 'selected' : ''}>AI drafts personalized response for Manager 1-Click Approval (Recommended)</option>
            <option value="auto_publish_positive" ${curMode === 'auto_publish_positive' ? 'selected' : ''}>Auto-publish 5★ replies immediately, draft 1-4★ for review</option>
            <option value="manual_only" ${curMode === 'manual_only' ? 'selected' : ''}>Manual replies only (no AI auto-posting)</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom:14px;">
          <label class="form-label" style="font-size:12px; font-weight:700;">3. Sync Frequency</label>
          <select id="cfgGbpSyncFreq" class="form-input">
            <option value="Real-Time Webhook (Instant)" ${cfg.sync_frequency?.includes('Real-Time') ? 'selected' : ''}>Real-Time Webhook (Instant Notification)</option>
            <option value="Every 1 Hour" ${cfg.sync_frequency?.includes('1 Hour') ? 'selected' : ''}>Every 1 Hour</option>
            <option value="Daily Sync" ${cfg.sync_frequency?.includes('Daily') ? 'selected' : ''}>Daily Sync</option>
          </select>
        </div>

        <div style="border-top:1px dashed var(--border-subtle); padding-top:12px;">
          <button type="button" id="btnModalFetchGBPReviews" class="btn btn-sm btn-outline" style="width:100%; justify-content:center; padding:9px;">
            📥 Fetch Latest Reviews from Google Business Profile Now
          </button>
          <div id="gbpTestFeedback" style="display:none; font-size:12px; margin-top:8px; padding:8px 12px; border-radius:var(--radius-sm);"></div>
        </div>
      `;

      const gbpBtn = document.getElementById('btnModalFetchGBPReviews');
      const gbpFeedback = document.getElementById('gbpTestFeedback');
      if (gbpBtn) {
        gbpBtn.addEventListener('click', async () => {
          gbpBtn.textContent = 'Fetching Google reviews via viaSocket...';
          gbpBtn.disabled = true;
          try {
            const res = await api('/api/integrations/google-business-profile/fetch', { method: 'POST' });
            if (gbpFeedback) {
              gbpFeedback.style.display = 'block';
              gbpFeedback.style.background = 'var(--emerald-subtle)';
              gbpFeedback.style.border = '1px solid var(--emerald-border)';
              gbpFeedback.style.color = 'var(--emerald-hover)';
              gbpFeedback.innerHTML = `<strong>✓ Success:</strong> ${escapeHtml(res.message || 'Synced and analyzed reviews from Google Business Profile!')}`;
            }
            await fetchReviews();
            await fetchOverview();
          } catch (err) {
            if (gbpFeedback) {
              gbpFeedback.style.display = 'block';
              gbpFeedback.style.background = 'var(--rose-subtle)';
              gbpFeedback.style.border = '1px solid var(--rose-border)';
              gbpFeedback.style.color = 'var(--rose-primary)';
              gbpFeedback.innerHTML = `<strong>Notice:</strong> ${escapeHtml(err.message)}`;
            }
          } finally {
            gbpBtn.textContent = '📥 Fetch Latest Reviews from Google Business Profile Now';
            gbpBtn.disabled = false;
          }
        });
      }

    } else if (slug === 'square') {
      const terminals = data.terminals || [
        { id: 'term_1', name: 'Downtown Flagship - Terminal 1 (Main Counter POS)' },
        { id: 'term_2', name: 'Cyber City Cloud Kitchen - Terminal 2 (Main Counter POS)' },
        { id: 'term_3', name: 'Westend Mall - Terminal 3 (Main Counter POS)' }
      ];
      const curTerm = cfg.terminal_name || terminals[0].name;

      content.innerHTML = `
        <div class="form-group" style="margin-bottom:14px;">
          <label class="form-label" style="font-size:12px; font-weight:700;">1. POS Terminal</label>
          <select id="cfgSquareTerminal" class="form-input" style="font-weight:600;">
            ${terminals.map(t => `<option value="${escapeHtml(t.name)}" ${curTerm === t.name ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}
          </select>
        </div>

        <div style="margin-bottom:14px;">
          <div style="font-size:12px; margin-bottom:8px; font-weight:700;">2. Data Synchronization Items:</div>
          <div style="display:flex; flex-direction:column; gap:8px; font-size:12.5px; color:var(--text-secondary);">
            <label style="display:flex; align-items:center; gap:8px;">
              <input type="checkbox" id="cfgSquareOrders" ${cfg.sync_orders !== false ? 'checked' : ''}>
              <span>Itemized order sales, dish quantities, and ticket revenue</span>
            </label>
            <label style="display:flex; align-items:center; gap:8px;">
              <input type="checkbox" id="cfgSquareRefunds" ${cfg.sync_refunds !== false ? 'checked' : ''}>
              <span>Customer refunds, discounts & void items for revenue-at-risk analysis</span>
            </label>
            <label style="display:flex; align-items:center; gap:8px;">
              <input type="checkbox" id="cfgSquareRatings" ${cfg.sync_ratings !== false ? 'checked' : ''}>
              <span>Square Terminal checkout customer star ratings & feedback</span>
            </label>
          </div>
        </div>

        <div style="border-top:1px dashed var(--border-subtle); padding-top:12px;">
          <button type="button" id="btnModalFetchSquareData" class="btn btn-sm btn-outline" style="width:100%; justify-content:center; padding:9px;">
            📥 Sync Orders & Checkout Ratings from Square POS Now
          </button>
          <div id="sqTestFeedback" style="display:none; font-size:12px; margin-top:8px; padding:8px 12px; border-radius:var(--radius-sm);"></div>
        </div>
      `;

      const sqBtn = document.getElementById('btnModalFetchSquareData');
      const sqFeedback = document.getElementById('sqTestFeedback');
      if (sqBtn) {
        sqBtn.addEventListener('click', async () => {
          sqBtn.textContent = 'Syncing Square POS telemetry via viaSocket...';
          sqBtn.disabled = true;
          try {
            const res = await api('/api/integrations/square/fetch', { method: 'POST' });
            if (sqFeedback) {
              sqFeedback.style.display = 'block';
              sqFeedback.style.background = 'var(--emerald-subtle)';
              sqFeedback.style.border = '1px solid var(--emerald-border)';
              sqFeedback.style.color = 'var(--emerald-hover)';
              sqFeedback.innerHTML = `<strong>✓ Success:</strong> ${escapeHtml(res.message || 'Synced and analyzed reviews from Square POS!')}`;
            }
            await fetchReviews();
            await fetchOverview();
          } catch (err) {
            if (sqFeedback) {
              sqFeedback.style.display = 'block';
              sqFeedback.style.background = 'var(--rose-subtle)';
              sqFeedback.style.border = '1px solid var(--rose-border)';
              sqFeedback.style.color = 'var(--rose-primary)';
              sqFeedback.innerHTML = `<strong>Notice:</strong> ${escapeHtml(err.message)}`;
            }
          } finally {
            sqBtn.textContent = '📥 Sync Orders & Checkout Ratings from Square POS Now';
            sqBtn.disabled = false;
          }
        });
      }

    } else {
      content.innerHTML = `
        <div class="form-group" style="margin-bottom:14px;">
          <label class="form-label" style="font-size:12px; font-weight:700;">Location / Account Mapping</label>
          <input type="text" id="cfgGenericLocation" class="form-input" value="${escapeHtml(cfg.location_name || 'All Outlets')}">
        </div>
      `;
    }
  } catch (err) {
    if (loading) loading.style.display = 'none';
    if (content) {
      content.style.display = 'block';
      content.innerHTML = `<div style="color:var(--rose-primary); font-size:12px;">Failed to load options: ${escapeHtml(err.message)}</div>`;
    }
  }
}

// Modal and configuration save handlers
document.addEventListener('DOMContentLoaded', () => {
  const btnLaunch = document.getElementById('btnLaunchConnectPopup');
  if (btnLaunch) {
    btnLaunch.addEventListener('click', () => {
      if (activeConnectingApp) {
        triggerViasocketPopup(activeConnectingApp.slug, activeConnectingApp.name, activeConnectingApp.serviceId);
      }
    });
  }

  const btnManualAuth = document.getElementById('btnSaveManualAuthId');
  if (btnManualAuth) {
    btnManualAuth.addEventListener('click', async () => {
      const input = document.getElementById('manualAuthIdInput');
      const authId = input?.value?.trim();
      if (!authId) {
        showToast('Please enter an auth_id', 'warning');
        return;
      }
      if (activeConnectingApp) {
        await saveViasocketConnection(activeConnectingApp.slug, authId, activeConnectingApp.serviceId, activeConnectingApp.name);
        closeModal('viasocketConnectModal');
      }
    });
  }

  const btnTestSandbox = document.getElementById('btnConnectTestSandbox');
  if (btnTestSandbox) {
    btnTestSandbox.addEventListener('click', async () => {
      if (activeConnectingApp) {
        const testAuthId = `auth_${activeConnectingApp.slug.replace(/-/g, '_')}_test_verified`;
        await saveViasocketConnection(activeConnectingApp.slug, testAuthId, activeConnectingApp.serviceId, activeConnectingApp.name);
        closeModal('viasocketConnectModal');
      }
    });
  }

  const saveConfigBtn = document.getElementById('btnSaveIntegrationConfig');
  if (saveConfigBtn) {
    saveConfigBtn.addEventListener('click', async () => {
      if (!currentConfiguringSlug) return;
      saveConfigBtn.textContent = 'Saving...';
      saveConfigBtn.disabled = true;

      try {
        let configPayload = {};
        if (currentConfiguringSlug === 'google-sheets') {
          const sheetSelect = document.getElementById('cfgSheetSelect');
          const customSheetInput = document.getElementById('cfgCustomSheetInput');
          const tabSelect = document.getElementById('cfgTabSelect');
          const customTabInput = document.getElementById('cfgCustomTabInput');
          const selectedOption = sheetSelect?.options[sheetSelect.selectedIndex];

          const isCustomSheet = selectedOption?.value?.includes('Custom') || selectedOption?.getAttribute('data-id') === 'custom';
          const sheetNameVal = (isCustomSheet && customSheetInput?.value?.trim()) ? customSheetInput.value.trim() : (sheetSelect?.value || 'Reviews');
          const spreadsheetIdVal = selectedOption?.getAttribute('data-id') || '1Y8tL_01gXn-rw8OwwoPOljR2m9tFaOFLzhcLz7ec0RY';

          const isCustomTab = tabSelect?.value === '__custom_tab__';
          const tabNameVal = (isCustomTab && customTabInput?.value?.trim()) ? customTabInput.value.trim() : (tabSelect?.value || 'Sheet1');

          configPayload = {
            sheet_name: sheetNameVal,
            spreadsheet_name: sheetNameVal,
            spreadsheet_id: spreadsheetIdVal,
            worksheet_tab: tabNameVal,
            grid_id: '0'
          };
        } else if (currentConfiguringSlug === 'slack') {
          const slackSelect = document.getElementById('cfgSlackChannel');
          const customSlack = document.getElementById('cfgSlackCustomChannel');
          const isCustomChan = slackSelect?.value === '__custom_channel__';
          const channelVal = (isCustomChan && customSlack?.value?.trim()) ? customSlack.value.trim() : (slackSelect?.value || '#kitchen-alerts');

          configPayload = {
            channel: channelVal,
            alert_food_safety: document.getElementById('cfgAlertFoodSafety')?.checked ?? true,
            alert_negative: document.getElementById('cfgAlertNegative')?.checked ?? true,
            alert_summary: document.getElementById('cfgAlertSummary')?.checked ?? false
          };
        } else if (currentConfiguringSlug === 'gmail') {
          configPayload = {
            recipient_email: document.getElementById('cfgGmailRecipient')?.value?.trim() || 'owner@royalspice.com',
            report_format: document.getElementById('cfgGmailFormat')?.value || 'Executive Operations Brief (Summary + Issues + Tasks)',
            frequency: document.getElementById('cfgGmailFrequency')?.value || 'realtime',
            subject_prefix: document.getElementById('cfgGmailSubject')?.value?.trim() || '[ReviewPilot Alert] Royal Spice Kitchen'
          };
        } else if (currentConfiguringSlug === 'google-business-profile') {
          configPayload = {
            location_name: document.getElementById('cfgGbpLocation')?.value || 'Downtown Flagship',
            reply_mode: document.getElementById('cfgGbpReplyMode')?.value || 'draft_approval',
            sync_frequency: document.getElementById('cfgGbpSyncFreq')?.value || 'Real-Time Webhook (Instant)'
          };
        } else if (currentConfiguringSlug === 'square') {
          configPayload = {
            terminal_name: document.getElementById('cfgSquareTerminal')?.value || 'Downtown Flagship - Terminal 1 (Main Counter POS)',
            sync_orders: document.getElementById('cfgSquareOrders')?.checked ?? true,
            sync_refunds: document.getElementById('cfgSquareRefunds')?.checked ?? true,
            sync_ratings: document.getElementById('cfgSquareRatings')?.checked ?? true
          };
        } else {
          configPayload = {
            location_name: document.getElementById('cfgGenericLocation')?.value || 'All Outlets'
          };
        }

        await api(`/api/integrations/${currentConfiguringSlug}/config`, {
          method: 'POST',
          body: JSON.stringify({ config: configPayload })
        });

        showToast(`✓ Configuration saved for ${currentConfiguringSlug}!`);
        closeModal('integrationConfigModal');
        await fetchIntegrations();
      } catch (err) {
        showToast(`Save failed: ${err.message}`, 'error');
      } finally {
        saveConfigBtn.textContent = '✓ Save Configuration';
        saveConfigBtn.disabled = false;
      }
    });
  }

  // Phase 6 Workflow actions
  const btnRefreshWf = document.getElementById('btnRefreshWorkflows');
  if (btnRefreshWf) {
    btnRefreshWf.addEventListener('click', () => fetchAutomations());
  }

  const btnCloseConsole = document.getElementById('btnCloseTestConsole');
  if (btnCloseConsole) {
    btnCloseConsole.addEventListener('click', () => {
      const box = document.getElementById('workflowTestConsoleBox');
      if (box) box.style.display = 'none';
    });
  }

  const btnResetCb = document.getElementById('btnResetCircuitBreaker');
  if (btnResetCb) {
    btnResetCb.addEventListener('click', async () => {
      try {
        await api('/api/automations/circuit-breaker/reset', { method: 'POST' });
        showToast('✓ Circuit breaker has been reset to CLOSED. Normal dispatch resumed.');
        await fetchAutomations();
      } catch (err) {
        showToast(`Failed to reset breaker: ${err.message}`, 'error');
      }
    });
  }

  const btnClearRuns = document.getElementById('btnClearConsoleRuns');
  if (btnClearRuns) {
    btnClearRuns.addEventListener('click', () => fetchAutomations());
  }

  const btnRefreshInt = document.getElementById('btnRefreshIntegrations');
  if (btnRefreshInt) {
    btnRefreshInt.addEventListener('click', async () => {
      await fetchIntegrations();
      await fetchAutomations();
      showToast('Integrations and workflows refreshed.');
    });
  }

  // Initialize Workflow Configuration Modal Event Handlers
  if (typeof initWorkflowConfigHandlers === 'function') {
    initWorkflowConfigHandlers();
  }
});

// ============================================================================
// 11. Settings, Team & Audit Logs (/settings)
// ============================================================================

async function fetchTeam() {
  try {
    const tbody = document.getElementById('teamTableBody');
    if (!tbody) return;

    const members = await api('/api/team/members');
    tbody.innerHTML = (members || []).map(m => `
      <tr>
        <td><strong>${escapeHtml(m.full_name || 'Staff')}</strong></td>
        <td>${escapeHtml(m.email)}</td>
        <td><span class="badge neutral">${escapeHtml(m.role)}</span></td>
        <td>${(m.assigned_outlet_ids && m.assigned_outlet_ids.length > 0) ? m.assigned_outlet_ids.join(', ') : 'All Outlets'}</td>
        <td><span class="badge positive">Active</span></td>
      </tr>
    `).join('') || '<tr><td colspan="5" class="empty-state">No team members added.</td></tr>';
  } catch (e) {
    console.error('fetchTeam failed', e);
  }
}

async function fetchAuditLogs() {
  try {
    const tbody = document.getElementById('auditLogsTableBody');
    if (!tbody) return;

    const logs = await api('/api/audit-logs');
    tbody.innerHTML = (logs || []).slice(0, 15).map(l => `
      <tr>
        <td style="font-size:11.5px; color:var(--text-muted);">${(l.timestamp || '').slice(0, 19).replace('T', ' ')}</td>
        <td><code>${escapeHtml(l.user_id || 'system')}</code></td>
        <td><span class="badge neutral">${escapeHtml(l.action)}</span></td>
        <td>${escapeHtml(l.entity_type || '--')}</td>
        <td style="font-size:12px; color:var(--text-secondary);">${escapeHtml(l.details || '')}</td>
      </tr>
    `).join('') || '<tr><td colspan="5" class="empty-state">No audit logs recorded yet.</td></tr>';
  } catch (e) {
    console.error('fetchAuditLogs failed', e);
  }
}

async function fetchNotifications() {
  try {
    const list = await api('/api/notifications');
    const topbarList = document.getElementById('topbarNotificationsList');
    const overviewList = document.getElementById('overviewNotificationsList');
    const unreadBadge = document.getElementById('notifUnreadBadge');
    const badgeDot = document.querySelector('.notification-badge-dot');

    if (!Array.isArray(list)) return;

    const unreadCount = list.filter(n => !n.is_read).length;
    if (unreadBadge) {
      unreadBadge.textContent = unreadCount > 0 ? `${unreadCount} Unread` : 'Live Feed';
    }
    if (badgeDot) {
      badgeDot.style.display = unreadCount > 0 ? 'block' : 'none';
    }

    const html = list.length === 0
      ? '<div style="padding:16px; text-align:center; color:var(--text-muted); font-size:12px;">No operational alerts recorded.</div>'
      : list.slice(0, 10).map(n => {
          const isCrit = n.severity === 'critical';
          const icon = isCrit ? '🚨' : n.severity === 'high' ? '⚠️' : 'ℹ️';
          return `
            <div class="notif-item ${isCrit ? 'critical' : ''}" style="cursor:pointer; opacity:${n.is_read ? 0.75 : 1};" onclick="markNotificationRead('${n.id}')">
              <strong>${icon} ${escapeHtml(n.title || 'System Notification')}</strong>
              <div style="font-size:11px; color:#475569; margin-top:2px;">${escapeHtml(n.message || '')}</div>
              <div style="font-size:10px; color:#94a3b8; margin-top:4px;">${n.created_at ? new Date(n.created_at).toLocaleTimeString() : ''}</div>
            </div>
          `;
        }).join('');

    if (topbarList) topbarList.innerHTML = html;
    if (overviewList) overviewList.innerHTML = html;
  } catch (err) {
    console.warn('fetchNotifications error:', err);
  }
}

async function markNotificationRead(id) {
  try {
    await api(`/api/notifications/${id}/read`, { method: 'PATCH' });
    fetchNotifications();
  } catch (err) {
    console.warn('markNotificationRead error:', err);
  }
}
window.fetchNotifications = fetchNotifications;
window.markNotificationRead = markNotificationRead;

// ============================================================================
// Phase 6: AI Automation Workflows (viaSocket Engine)
// ============================================================================

let currentWorkflows = [];

async function fetchAutomations() {
  try {
    const grid = document.getElementById('workflowsGrid');
    if (!grid) return;

    const data = await api('/api/automations/workflows');
    const workflows = data.workflows || [];
    currentWorkflows = workflows;
    const cb = data.circuit_breaker || {};
    const recentRuns = data.recent_runs || [];

    // 1. Update Circuit Breaker Status Banner
    const cbBadge = document.getElementById('circuitBreakerBadge');
    const cbResetBtn = document.getElementById('btnResetCircuitBreaker');
    if (cbBadge) {
      if (cb.circuit_breaker === 'open') {
        cbBadge.style.background = '#fef2f2';
        cbBadge.style.color = '#991b1b';
        cbBadge.style.borderColor = '#fecaca';
        cbBadge.innerHTML = `
          <span style="width:8px; height:8px; border-radius:50%; background:#ef4444; display:inline-block;"></span>
          <span>🚨 Circuit Breaker: OPEN (${cb.consecutive_failures} failures - Escalated)</span>
        `;
        if (cbResetBtn) cbResetBtn.style.display = 'inline-block';
      } else {
        cbBadge.style.background = '#ecfdf5';
        cbBadge.style.color = '#065f46';
        cbBadge.style.borderColor = '#a7f3d0';
        cbBadge.innerHTML = `
          <span style="width:8px; height:8px; border-radius:50%; background:#10b981; display:inline-block;"></span>
          <span>Circuit Breaker: CLOSED (Healthy)</span>
        `;
        if (cbResetBtn) cbResetBtn.style.display = 'none';
      }
    }

    if (Array.isArray(data.slack_channels) && data.slack_channels.length > 0) {
      cachedWorkflowSlackChannels = data.slack_channels;
      cachedWorkflowSlackWorkspace = data.workspace_name || 'Slack Workspace';
    }

    // 2. Render Workflow Cards
    grid.innerHTML = workflows.map(wf => {
      const isEnabled = wf.is_enabled;
      const isConn = wf.integration_connected;
      const ch = wf.delivery_channel || wf.action_config?.channel || (wf.key === 'workflow_a' ? 'slack' : 'gmail');
      let target = wf.delivery_target || wf.action_config?.target || wf.action_config?.recipient || (ch === 'slack' ? '#all-yashverma29' : 'owner@royalspice.com');
      if (ch === 'slack' && (target === '#kitchen-alerts' || !target) && cachedWorkflowSlackChannels?.length > 0) {
        target = cachedWorkflowSlackChannels[0].name;
      }
      const chLabel = ch === 'slack' ? `Slack (${target})` : ch === 'gmail' ? `Gmail (${target})` : `In-App Dashboard (${target})`;
      const actionBadge = wf.viasocket_action_id ? `<span class="badge badge-emerald" style="font-size:10px; font-family:monospace;">action: ${escapeHtml(wf.viasocket_action_id)}</span>` : '';

      // Compute dynamic human-readable trigger label
      let triggerLabel = '';
      if (wf.key === 'workflow_a') {
        const minR = wf.trigger_config?.min_rating ?? 2;
        const safety = wf.trigger_config?.alert_food_safety !== false;
        triggerLabel = `Rating ≤ ${minR}★${safety ? ' or Food Safety Allegation' : ''}`;
      } else if (wf.key === 'workflow_b') {
        const time = wf.trigger_config?.schedule_time || '21:00';
        triggerLabel = `Scheduled Daily (${time})`;
      } else if (wf.key === 'workflow_c') {
        const day = wf.trigger_config?.day_of_week || 'Monday';
        const time = wf.trigger_config?.schedule_time || '08:00';
        triggerLabel = `Scheduled Weekly (${day} ${time})`;
      } else {
        const fail = wf.trigger_config?.failure_threshold ?? 3;
        const retries = wf.trigger_config?.max_retries ?? 3;
        triggerLabel = `Failure ≥ ${fail} (Retries: ${retries})`;
      }

      return `
        <div class="workflow-card card" style="background:#fff; border:1px solid ${isEnabled ? 'var(--border-subtle)' : '#f1f5f9'}; opacity:${isEnabled ? '1' : '0.85'}; padding:16px; border-radius:var(--radius-md); display:flex; flex-direction:column; justify-content:space-between; box-shadow:var(--shadow-xs);">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:22px;">${wf.key === 'workflow_a' ? '🚨' : wf.key === 'workflow_b' ? '📊' : wf.key === 'workflow_c' ? '📈' : '🛡️'}</span>
                <div>
                  <div style="font-weight:700; font-size:13.5px; color:var(--text-primary);">${escapeHtml(wf.name)}</div>
                  <div style="font-size:11px; color:var(--text-dim);">${escapeHtml(wf.key.toUpperCase())} · viaSocket Skill Action</div>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="badge ${isEnabled ? 'badge-emerald' : 'badge-slate'}" style="font-size:10px;">
                  ${isEnabled ? 'Active' : 'Paused'}
                </span>
                <input type="checkbox" class="wf-toggle-checkbox" data-key="${wf.key}" ${isEnabled ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color:var(--emerald-primary);">
              </div>
            </div>

            <p style="font-size:12px; color:var(--text-secondary); margin-bottom:12px; line-height:1.45;">
              ${escapeHtml(wf.description)}
            </p>

            <div style="background:var(--bg-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:10px 12px; margin-bottom:12px; font-size:11.5px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:var(--text-dim);">Trigger Condition:</span>
                <strong style="color:var(--text-primary); font-size:11px;">${escapeHtml(triggerLabel)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="color:var(--text-dim);">Delivery Channel:</span>
                <span style="color:var(--text-secondary); font-size:11px; font-weight:600;">${escapeHtml(chLabel)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color:var(--text-dim);">Channel Status:</span>
                <span style="color:${isConn ? 'var(--emerald-primary)' : 'var(--text-muted)'}; font-weight:600; font-size:11px;">
                  ${isConn ? '● viaSocket Connected' : '○ Verified In-App Dispatch & Telemetry'}
                </span>
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-subtle); padding-top:10px; margin-top:6px;">
            <div>
              ${actionBadge}
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-xs btn-outline btn-configure-workflow" data-key="${wf.key}" style="font-weight:600; display:inline-flex; align-items:center; gap:4px;" title="Edit trigger thresholds, delivery channels, and recipients">
                ⚙️ Configure / Edit
              </button>
              <button class="btn btn-xs btn-primary btn-test-workflow" data-key="${wf.key}" style="font-weight:600; display:inline-flex; align-items:center; gap:4px;">
                🧪 Test Workflow
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // 3. Render Recent Automation Runs Table
    const tbody = document.getElementById('automationRunsTableBody');
    if (tbody) {
      if (recentRuns.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-dim); padding:20px;">No automation runs executed yet. Click "🧪 Test Workflow" above to execute.</td></tr>`;
      } else {
        tbody.innerHTML = recentRuns.map(run => {
          const isSuccess = run.status === 'success' || run.status === 'delivered';
          const isEscalated = run.status === 'escalated';
          const statusBadge = isSuccess
            ? '<span class="badge badge-emerald" style="font-size:10px;">Success</span>'
            : isEscalated
            ? '<span class="badge badge-rose" style="font-size:10px;">Escalated</span>'
            : '<span class="badge badge-amber" style="font-size:10px;">' + escapeHtml(run.status) + '</span>';

          const isIdempotent = run.payload?.idempotency_key ? '✓ SHA-256 Keyed' : '—';
          const recipient = run.payload?.recipient || run.payload?.delivery?.recipient || run.payload?.service_id || 'System Audit';
          const executedAt = new Date(run.executed_at).toLocaleString();

          return `
            <tr>
              <td style="font-family:monospace; font-weight:600; font-size:11px;">${escapeHtml(run.id || run.run_id)}</td>
              <td style="font-weight:600;">${escapeHtml(run.rule_id || 'workflow')}</td>
              <td><span style="font-size:11px; color:var(--text-secondary);">${escapeHtml(run.trigger_event || 'TRIGGER')}</span></td>
              <td>${statusBadge}</td>
              <td style="font-size:11px; color:var(--emerald-primary); font-family:monospace;">${escapeHtml(isIdempotent)}</td>
              <td style="font-size:11px; color:var(--text-secondary);">${escapeHtml(recipient)}</td>
              <td style="font-size:11px; color:var(--text-dim);">${escapeHtml(executedAt)}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // 4. Attach Event Listeners
    // Toggle Workflow Switch
    document.querySelectorAll('.wf-toggle-checkbox').forEach(cb => {
      cb.addEventListener('change', async (e) => {
        const key = e.target.getAttribute('data-key');
        const enabled = e.target.checked;
        try {
          await api(`/api/automations/workflows/${key}/toggle`, {
            method: 'PATCH',
            body: JSON.stringify({ is_enabled: enabled })
          });
          showToast(`Workflow ${key} is now ${enabled ? 'active' : 'paused'}.`);
          await fetchAutomations();
        } catch (err) {
          showToast(`Toggle failed: ${err.message}`, 'error');
          e.target.checked = !enabled;
        }
      });
    });

    // Configure / Edit Workflow Button
    document.querySelectorAll('.btn-configure-workflow').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-key');
        openWorkflowConfigModal(key);
      });
    });

    // Test Workflow Button
    document.querySelectorAll('.btn-test-workflow').forEach(btn => {
      btn.addEventListener('click', async () => {
        const key = btn.getAttribute('data-key');
        await executeWorkflowTest(key, btn);
      });
    });

  } catch (err) {
    console.error('fetchAutomations error', err);
  }
}

async function executeWorkflowTest(key, triggerBtn = null) {
  const origText = triggerBtn ? triggerBtn.textContent : '';
  if (triggerBtn) {
    triggerBtn.textContent = 'Running test...';
    triggerBtn.disabled = true;
  }

  try {
    const res = await api(`/api/automations/workflows/${key}/test`, {
      method: 'POST',
      body: JSON.stringify({ forceTest: true })
    });

    // Show test console with formatted results
    const consoleBox = document.getElementById('workflowTestConsoleBox');
    const consoleOut = document.getElementById('workflowTestConsoleOutput');
    const consoleTag = document.getElementById('testConsoleStatusTag');

    if (consoleBox && consoleOut) {
      consoleBox.style.display = 'block';
      consoleOut.textContent = JSON.stringify(res, null, 2);
      if (consoleTag) {
        consoleTag.className = 'badge badge-emerald';
        consoleTag.textContent = `✓ ${res.workflow || res.workflow_name || key} Executed`;
      }
      consoleBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    showToast(`✓ ${res.workflow || res.workflow_name || key} executed successfully!`);
    await fetchAutomations();
    if (typeof fetchNotifications === 'function') await fetchNotifications();
    return res;
  } catch (err) {
    showToast(`Test failed: ${err.message}`, 'error');
    const consoleBox = document.getElementById('workflowTestConsoleBox');
    const consoleOut = document.getElementById('workflowTestConsoleOutput');
    const consoleTag = document.getElementById('testConsoleStatusTag');
    if (consoleBox && consoleOut) {
      consoleBox.style.display = 'block';
      consoleOut.textContent = `ERROR:\n${err.message}`;
      if (consoleTag) {
        consoleTag.className = 'badge badge-rose';
        consoleTag.textContent = 'Execution Failed';
      }
    }
    throw err;
  } finally {
    if (triggerBtn) {
      triggerBtn.textContent = origText;
      triggerBtn.disabled = false;
    }
  }
}

function openWorkflowConfigModal(key) {
  const wf = (currentWorkflows || []).find(w => w.key === key);
  if (!wf) {
    showToast(`Workflow ${key} not found.`, 'error');
    return;
  }

  const modal = document.getElementById('workflowConfigModal');
  if (!modal) return;

  document.getElementById('cfgWfKey').value = wf.key;
  document.getElementById('cfgWfRuleId').value = wf.rule_id || '';
  document.getElementById('cfgWfKeyBadge').textContent = wf.key.toUpperCase();

  const actId = wf.viasocket_action_id || wf.supported_action || (wf.delivery_channel === 'gmail' ? 'rowogelpy0h6' : 'row1jrbor');
  document.getElementById('cfgWfActionBadge').textContent = `action: ${actId}`;
  document.getElementById('cfgWfEnabled').checked = Boolean(wf.is_enabled);

  document.getElementById('cfgWfName').value = wf.name || '';
  document.getElementById('cfgWfDescription').value = wf.description || '';

  // Hide all specific sections
  ['cfgWfFieldsA', 'cfgWfFieldsB', 'cfgWfFieldsC', 'cfgWfFieldsD'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // Populate workflow-specific fields
  if (wf.key === 'workflow_a') {
    document.getElementById('cfgWfFieldsA').style.display = 'block';
    document.getElementById('cfgWfMinRating').value = String(wf.trigger_config?.min_rating ?? 2);
    document.getElementById('cfgWfSeverity').value = wf.trigger_config?.severity_threshold || 'High';
    document.getElementById('cfgWfFoodSafety').checked = wf.trigger_config?.alert_food_safety !== false;
  } else if (wf.key === 'workflow_b') {
    document.getElementById('cfgWfFieldsB').style.display = 'block';
    document.getElementById('cfgWfDailyTime').value = wf.trigger_config?.schedule_time || '21:00';
  } else if (wf.key === 'workflow_c') {
    document.getElementById('cfgWfFieldsC').style.display = 'block';
    document.getElementById('cfgWfWeeklyDay').value = wf.trigger_config?.day_of_week || 'Monday';
    document.getElementById('cfgWfWeeklyTime').value = wf.trigger_config?.schedule_time || '08:00';
  } else if (wf.key === 'workflow_d') {
    document.getElementById('cfgWfFieldsD').style.display = 'block';
    document.getElementById('cfgWfFailureThreshold').value = String(wf.trigger_config?.failure_threshold ?? 3);
    document.getElementById('cfgWfMaxRetries').value = String(wf.trigger_config?.max_retries ?? 3);
  }

  // Channel & Target
  const channel = wf.delivery_channel || wf.action_config?.channel || (wf.key === 'workflow_a' ? 'slack' : 'gmail');
  let target = wf.delivery_target || wf.action_config?.target || wf.action_config?.recipient || (channel === 'slack' ? '#all-yashverma29' : 'owner@royalspice.com');
  if (channel === 'slack' && (target === '#kitchen-alerts' || !target) && cachedWorkflowSlackChannels?.length > 0) {
    target = cachedWorkflowSlackChannels[0].name;
  }
  document.getElementById('cfgWfChannel').value = channel;
  document.getElementById('cfgWfTarget').value = target;
  document.getElementById('cfgWfEscalateRole').value = wf.action_config?.escalate_to || 'owner@royalspice.com';

  updateChannelTargetLabels(channel);
  updateWorkflowConfigSummary();

  modal.classList.remove('hidden');
}

let cachedWorkflowSlackChannels = null;
let cachedWorkflowSlackWorkspace = null;

async function loadWorkflowSlackChannels(selectedTarget = null, forceRefresh = false) {
  const select = document.getElementById('cfgWfSlackChannelSelect');
  const countBadge = document.getElementById('cfgWfSlackCount');
  const syncBadge = document.getElementById('cfgWfSlackSyncBadge');
  const customGroup = document.getElementById('cfgWfSlackCustomInputGroup');
  const customInput = document.getElementById('cfgWfSlackCustomChannel');
  const targetInput = document.getElementById('cfgWfTarget');
  if (!select) return;

  if (forceRefresh || !cachedWorkflowSlackChannels) {
    if (countBadge) countBadge.textContent = 'Fetching channels...';
    try {
      const data = await api('/api/integrations/slack/options');
      cachedWorkflowSlackChannels = data.channels || [];
      cachedWorkflowSlackWorkspace = data.workspace_name || 'Slack Workspace';
    } catch (err) {
      console.warn('Could not fetch Slack channels for workflow', err);
      cachedWorkflowSlackChannels = [];
      cachedWorkflowSlackWorkspace = 'Slack Workspace';
    }
  }

  const channels = cachedWorkflowSlackChannels || [];
  const workspace = cachedWorkflowSlackWorkspace || 'Slack Workspace';

  if (syncBadge) {
    syncBadge.textContent = `● Live Workspace: ${workspace}`;
  }
  if (countBadge) {
    countBadge.textContent = `${channels.length} live channels`;
  }

  let optionsHtml = '';
  if (channels.length > 0) {
    optionsHtml = channels.map(c => {
      const desc = c.purpose ? ` — ${c.purpose.slice(0, 45)}` : '';
      return `<option value="${escapeHtml(c.name)}" data-id="${escapeHtml(c.id)}">${escapeHtml(c.name)}${escapeHtml(desc)}</option>`;
    }).join('');
  } else {
    optionsHtml = `<option value="#kitchen-alerts">#kitchen-alerts (Default alerts)</option>`;
  }
  optionsHtml += `<option value="__custom_channel__">+ Enter Custom Channel Name</option>`;
  select.innerHTML = optionsHtml;

  // Determine which option to select
  let effective = selectedTarget || targetInput?.value || (channels[0]?.name || '#all-yashverma29');
  
  const matched = channels.find(c => c.name === effective || c.id === effective || c.name === `#${effective}`);
  if (matched) {
    select.value = matched.name;
    if (customGroup) customGroup.style.display = 'none';
    if (targetInput) targetInput.value = matched.name;
  } else if (channels.length > 0 && (!effective || effective === '#kitchen-alerts')) {
    select.value = channels[0].name;
    if (customGroup) customGroup.style.display = 'none';
    if (targetInput) targetInput.value = channels[0].name;
  } else {
    select.value = '__custom_channel__';
    if (customGroup) {
      customGroup.style.display = 'block';
      if (customInput) customInput.value = effective;
    }
    if (targetInput) targetInput.value = effective;
  }
}

function updateChannelTargetLabels(channel) {
  const label = document.getElementById('cfgWfTargetLabel');
  const input = document.getElementById('cfgWfTarget');
  const help = document.getElementById('cfgWfTargetHelp');
  const actBadge = document.getElementById('cfgWfActionBadge');
  const slackWrapper = document.getElementById('cfgWfSlackChannelWrapper');
  const textWrapper = document.getElementById('cfgWfTextTargetWrapper');

  if (channel === 'slack') {
    if (label) label.textContent = 'Slack Channel Destination *';
    if (slackWrapper) slackWrapper.style.display = 'block';
    if (textWrapper) textWrapper.style.display = 'none';
    if (actBadge) actBadge.textContent = 'action: row1jrbor (Slack)';
    loadWorkflowSlackChannels(input?.value);
  } else if (channel === 'gmail') {
    if (label) label.textContent = 'Recipient Email Address *';
    if (slackWrapper) slackWrapper.style.display = 'none';
    if (textWrapper) textWrapper.style.display = 'block';
    if (input && (!input.value || input.value.startsWith('#'))) input.value = 'owner@royalspice.com';
    if (input) input.placeholder = 'owner@royalspice.com';
    if (help) help.textContent = 'e.g. owner@royalspice.com or gm@royalspice.com';
    if (actBadge) actBadge.textContent = 'action: rowogelpy0h6 (Gmail)';
  } else {
    if (label) label.textContent = 'Dashboard Feed Target *';
    if (slackWrapper) slackWrapper.style.display = 'none';
    if (textWrapper) textWrapper.style.display = 'block';
    if (input) input.placeholder = 'Owner Operations Feed';
    if (help) help.textContent = 'In-app notification and audit telemetry';
    if (actBadge) actBadge.textContent = 'In-App Dispatch & Telemetry';
  }
}

function updateWorkflowConfigSummary() {
  const key = document.getElementById('cfgWfKey')?.value;
  const summaryText = document.getElementById('cfgWfSummaryText');
  if (!summaryText) return;

  const ch = document.getElementById('cfgWfChannel')?.value || 'slack';
  const target = document.getElementById('cfgWfTarget')?.value || '#all-yashverma29';
  const chLabel = ch === 'slack' ? `Slack channel ${target}` : ch === 'gmail' ? `Email ${target}` : `In-App Dashboard`;

  if (key === 'workflow_a') {
    const minR = document.getElementById('cfgWfMinRating')?.value || '2';
    const safety = document.getElementById('cfgWfFoodSafety')?.checked;
    summaryText.innerHTML = `When a new review is stored with rating <strong>≤ ${minR}★</strong>${safety ? ' or containing <strong>critical food safety allegations</strong>' : ''}, immediately dispatch an alert to <strong>${escapeHtml(chLabel)}</strong> with direct secure links and SHA-256 deduplication.`;
  } else if (key === 'workflow_b') {
    const time = document.getElementById('cfgWfDailyTime')?.value || '21:00';
    summaryText.innerHTML = `Every day at <strong>${time}</strong>, compile rating trends, recurring complaints, positive themes, and high-priority AI tasks into an operational digest delivered to <strong>${escapeHtml(chLabel)}</strong>.`;
  } else if (key === 'workflow_c') {
    const day = document.getElementById('cfgWfWeeklyDay')?.value || 'Monday';
    const time = document.getElementById('cfgWfWeeklyTime')?.value || '08:00';
    summaryText.innerHTML = `Every <strong>${day} at ${time}</strong>, compute week-over-week rating deltas, resolved tasks, recurring friction, and estimated revenue impact sent to <strong>${escapeHtml(chLabel)}</strong>.`;
  } else if (key === 'workflow_d') {
    const fail = document.getElementById('cfgWfFailureThreshold')?.value || '3';
    const retries = document.getElementById('cfgWfMaxRetries')?.value || '3';
    summaryText.innerHTML = `Track integration telemetry: retry transient errors up to <strong>${retries} times</strong> with exponential backoff. If failures reach <strong>${fail}</strong>, trip circuit breaker to OPEN and escalate to <strong>${escapeHtml(chLabel)}</strong>.`;
  }
}

function initWorkflowConfigHandlers() {
  const channelSelect = document.getElementById('cfgWfChannel');
  if (channelSelect) {
    channelSelect.addEventListener('change', (e) => {
      updateChannelTargetLabels(e.target.value);
      updateWorkflowConfigSummary();
    });
  }

  // Slack Channel Select in Workflow modal
  const slackSelect = document.getElementById('cfgWfSlackChannelSelect');
  const slackCustomGroup = document.getElementById('cfgWfSlackCustomInputGroup');
  const slackCustomInput = document.getElementById('cfgWfSlackCustomChannel');
  const wfTargetInput = document.getElementById('cfgWfTarget');
  const btnRefreshSlack = document.getElementById('btnRefreshWfSlackChannels');

  if (slackSelect) {
    slackSelect.addEventListener('change', () => {
      if (slackSelect.value === '__custom_channel__') {
        if (slackCustomGroup) slackCustomGroup.style.display = 'block';
        if (wfTargetInput && slackCustomInput) wfTargetInput.value = slackCustomInput.value || '';
      } else {
        if (slackCustomGroup) slackCustomGroup.style.display = 'none';
        if (wfTargetInput) wfTargetInput.value = slackSelect.value;
      }
      updateWorkflowConfigSummary();
    });
  }

  if (slackCustomInput && wfTargetInput) {
    slackCustomInput.addEventListener('input', () => {
      if (slackSelect?.value === '__custom_channel__') {
        wfTargetInput.value = slackCustomInput.value;
        updateWorkflowConfigSummary();
      }
    });
  }

  if (btnRefreshSlack) {
    btnRefreshSlack.addEventListener('click', async () => {
      btnRefreshSlack.disabled = true;
      btnRefreshSlack.textContent = '…';
      try {
        await loadWorkflowSlackChannels(wfTargetInput?.value, true);
        showToast('✓ Live Slack channels refreshed!');
      } finally {
        btnRefreshSlack.disabled = false;
        btnRefreshSlack.textContent = '↻';
      }
    });
  }

  // Update summary when inputs change
  [
    'cfgWfMinRating', 'cfgWfFoodSafety', 'cfgWfDailyTime',
    'cfgWfWeeklyDay', 'cfgWfWeeklyTime', 'cfgWfFailureThreshold',
    'cfgWfMaxRetries', 'cfgWfTarget'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateWorkflowConfigSummary);
      el.addEventListener('change', updateWorkflowConfigSummary);
    }
  });

  // Save Configuration Handler
  const btnSave = document.getElementById('btnSaveWorkflowConfig');
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const key = document.getElementById('cfgWfKey')?.value;
      if (!key) return;

      const name = document.getElementById('cfgWfName')?.value.trim();
      const description = document.getElementById('cfgWfDescription')?.value.trim();
      const isEnabled = document.getElementById('cfgWfEnabled')?.checked;
      const channel = document.getElementById('cfgWfChannel')?.value || 'slack';
      const target = document.getElementById('cfgWfTarget')?.value.trim();
      const escalateRole = document.getElementById('cfgWfEscalateRole')?.value;

      if (!name) {
        showToast('Workflow display name is required.', 'error');
        return;
      }
      if (!target) {
        showToast('Destination target (channel or email) is required.', 'error');
        return;
      }

      // Construct trigger_config according to workflow key
      let trigger_config = {};
      if (key === 'workflow_a') {
        trigger_config = {
          min_rating: Number(document.getElementById('cfgWfMinRating')?.value || 2),
          severity_threshold: document.getElementById('cfgWfSeverity')?.value || 'High',
          alert_food_safety: Boolean(document.getElementById('cfgWfFoodSafety')?.checked)
        };
      } else if (key === 'workflow_b') {
        trigger_config = {
          schedule_time: document.getElementById('cfgWfDailyTime')?.value || '21:00',
          frequency: 'daily'
        };
      } else if (key === 'workflow_c') {
        trigger_config = {
          day_of_week: document.getElementById('cfgWfWeeklyDay')?.value || 'Monday',
          schedule_time: document.getElementById('cfgWfWeeklyTime')?.value || '08:00',
          frequency: 'weekly'
        };
      } else if (key === 'workflow_d') {
        trigger_config = {
          failure_threshold: Number(document.getElementById('cfgWfFailureThreshold')?.value || 3),
          max_retries: Number(document.getElementById('cfgWfMaxRetries')?.value || 3)
        };
      }

      const action_config = {
        channel,
        target,
        recipient: target,
        escalate_to: escalateRole
      };

      const origText = btnSave.textContent;
      btnSave.textContent = 'Saving...';
      btnSave.disabled = true;

      try {
        await api(`/api/automations/workflows/${key}/config`, {
          method: 'PATCH',
          body: JSON.stringify({
            name,
            description,
            is_enabled: isEnabled,
            trigger_config,
            action_config
          })
        });

        showToast(`✓ Workflow "${name}" configuration saved!`);
        document.getElementById('workflowConfigModal')?.classList.add('hidden');
        await fetchAutomations();
      } catch (err) {
        showToast(`Save failed: ${err.message}`, 'error');
      } finally {
        btnSave.textContent = origText;
        btnSave.disabled = false;
      }
    });
  }

  // In-modal Test Workflow Handler
  const btnModalTest = document.getElementById('btnModalTestWorkflow');
  if (btnModalTest) {
    btnModalTest.addEventListener('click', async () => {
      const key = document.getElementById('cfgWfKey')?.value;
      if (!key) return;

      document.getElementById('workflowConfigModal')?.classList.add('hidden');
      await executeWorkflowTest(key);
    });
  }
}

// ============================================================================
// 12. Modal Handlers & Dropdowns
// ============================================================================

function initModals() {
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      if (targetId) {
        document.getElementById(targetId)?.classList.add('hidden');
      }
    });
  });

  // Open Add Review Modal
  const btnManualReview = document.getElementById('btnManualReview');
  const btnNewManualReview = document.getElementById('btnNewManualReview');
  if (btnManualReview) {
    btnManualReview.addEventListener('click', () => {
      document.getElementById('manualReviewModal')?.classList.remove('hidden');
    });
  }
  if (btnNewManualReview) {
    btnNewManualReview.addEventListener('click', () => {
      document.getElementById('manualReviewModal')?.classList.remove('hidden');
    });
  }

  // Open New Outlet Modal
  const btnOpenNewOutlet = document.getElementById('btnOpenNewOutletModal');
  if (btnOpenNewOutlet) {
    btnOpenNewOutlet.addEventListener('click', () => {
      document.getElementById('newOutletModal')?.classList.remove('hidden');
    });
  }

  // Open Invite Team Modal
  const btnInvite = document.getElementById('btnInviteTeamMember');
  if (btnInvite) {
    btnInvite.addEventListener('click', () => {
      document.getElementById('inviteTeamModal')?.classList.remove('hidden');
    });
  }

  // Copy Reply Button
  const btnCopy = document.getElementById('btnMdlCopyReply');
  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      const text = document.getElementById('mdlReplyText')?.value;
      if (text) {
        navigator.clipboard.writeText(text);
        showToast('Reply draft copied to clipboard!');
      }
    });
  }

  // Approve Reply Button
  const btnApprove = document.getElementById('btnMdlApproveReply');
  if (btnApprove) {
    btnApprove.addEventListener('click', async () => {
      if (!activeReviewInModal) return;
      const text = document.getElementById('mdlReplyText')?.value;
      await api(`/api/reviews/${activeReviewInModal.review_id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ reply_text: text, status: 'approved' })
      });
      document.getElementById('mdlReplyStatus').textContent = 'approved';
      showToast('Review reply marked as Approved!');
      await fetchReviews();
    });
  }

  // Mark Published Button
  const btnPublish = document.getElementById('btnMdlPublishReply');
  if (btnPublish) {
    btnPublish.addEventListener('click', async () => {
      if (!activeReviewInModal) return;
      const text = document.getElementById('mdlReplyText')?.value;
      await api(`/api/reviews/${activeReviewInModal.review_id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ reply_text: text, status: 'published' })
      });
      document.getElementById('mdlReplyStatus').textContent = 'published';
      showToast('Review reply marked as Published to customer!');
      document.getElementById('reviewDetailModal')?.classList.add('hidden');
      await fetchReviews();
    });
  }

  // Submit Outcome Resolution
  const btnSubmitOutcome = document.getElementById('btnSubmitOutcome');
  if (btnSubmitOutcome) {
    btnSubmitOutcome.addEventListener('click', async () => {
      if (!activeTaskForOutcome) return;
      const actualResult = document.getElementById('outcomeResultText')?.value;
      const afterRating = parseFloat(document.getElementById('outcomeAfterRating')?.value || 4.5);

      await api(`/api/tasks/${activeTaskForOutcome}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ actual_result: actualResult, after_rating: afterRating })
      });
      showToast('Task outcome recorded and closed-loop resolved!');
      document.getElementById('outcomeModal')?.classList.add('hidden');
      await fetchTasks();
    });
  }
}

function initDropdowns() {
  const notifBtn = document.getElementById('btnNotifBell');
  const notifMenu = document.getElementById('notificationsDropdown');
  if (notifBtn && notifMenu) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifMenu.classList.toggle('show');
      if (notifMenu.classList.contains('show')) {
        fetchNotifications();
      }
      document.getElementById('profileDropdown')?.classList.remove('show');
    });
  }

  const profileBtn = document.getElementById('btnProfileMenuToggle');
  const profileMenu = document.getElementById('profileDropdown');
  if (profileBtn && profileMenu) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle('show');
      document.getElementById('notificationsDropdown')?.classList.remove('show');
    });
  }

  document.addEventListener('click', () => {
    notifMenu?.classList.remove('show');
    profileMenu?.classList.remove('show');
  });

  const btnSignOut = document.getElementById('btnSignOutProfile');
  if (btnSignOut) {
    btnSignOut.addEventListener('click', () => {
      localStorage.removeItem('r2r_token');
      currentToken = '';
      currentUser = null;
      showToast('Signed out of ReviewPilot AI');
      appNavigate('/login');
    });
  }
}

function initFilters() {
  const globalFilter = document.getElementById('globalOutletFilter');
  if (globalFilter) {
    globalFilter.addEventListener('change', (e) => {
      currentOutlet = e.target.value;
      loadAllData();
    });
  }

  ['filterReviewSearch', 'filterSource', 'filterModeration', 'filterRating', 'filterSentiment', 'filterCategory', 'filterSeverity', 'filterDateFrom', 'filterDateTo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        const notice = document.getElementById('filterExclusionNotice');
        if (notice) notice.style.display = 'none';
        fetchReviews();
      });
      el.addEventListener('change', () => {
        const notice = document.getElementById('filterExclusionNotice');
        if (notice) notice.style.display = 'none';
        fetchReviews();
      });
    }
  });

  // Fetch from viaSocket button in Reviews header
  const btnSyncViaSocket = document.getElementById('btnSyncViaSocketReviews');
  if (btnSyncViaSocket) {
    btnSyncViaSocket.addEventListener('click', async () => {
      await syncReviewsViaSocket();
    });
  }

  // Reset Filters notice button
  const btnResetNotice = document.getElementById('btnResetFiltersNotice');
  if (btnResetNotice) {
    btnResetNotice.addEventListener('click', () => {
      resetReviewFilters();
    });
  }

  // Open QR Code Modal button in Reviews header
  const btnOpenQr = document.getElementById('btnOpenReviewQrModal');
  if (btnOpenQr) {
    btnOpenQr.addEventListener('click', () => {
      openQrCodeModal(currentOrg?.slug || 'royal-spice-kitchen');
    });
  }

  // Authorized CSV Export
  const btnExport = document.getElementById('btnExportReviewsCsv');
  if (btnExport) {
    btnExport.addEventListener('click', async () => {
      try {
        const qSearch = document.getElementById('filterReviewSearch')?.value || '';
        const qRating = document.getElementById('filterRating')?.value || 'all';
        const qSentiment = document.getElementById('filterSentiment')?.value || 'all';
        const qCategory = document.getElementById('filterCategory')?.value || 'all';
        const qSeverity = document.getElementById('filterSeverity')?.value || 'all';
        const qSource = document.getElementById('filterSource')?.value || 'all';
        const qMod = document.getElementById('filterModeration')?.value || 'all';
        const qFrom = document.getElementById('filterDateFrom')?.value || '';
        const qTo = document.getElementById('filterDateTo')?.value || '';

        const params = new URLSearchParams({
          outlet: currentOutlet,
          rating: qRating,
          sentiment: qSentiment,
          category: qCategory,
          severity: qSeverity,
          source: qSource,
          moderation: qMod,
          dateFrom: qFrom,
          dateTo: qTo,
          search: qSearch
        });

        const res = await fetch(`/api/reviews/export/csv?${params.toString()}`, {
          headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        if (!res.ok) {
          showToast('CSV export failed or unauthorized', 'error');
          return;
        }
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reviews_export_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showToast('Reviews CSV exported successfully!');
      } catch (err) {
        console.error('Export CSV error', err);
        showToast('Failed to export CSV', 'error');
      }
    });
  }

  // Reload Demo Dataset
  const btnReload = document.getElementById('btnReloadDemoData');
  if (btnReload) {
    btnReload.addEventListener('click', async () => {
      if (confirm('Reload the verified Royal Spice Kitchen demo dataset?')) {
        await api('/api/demo/load', { method: 'POST' });
        showToast('Demo dataset successfully reloaded!');
        await loadAllData();
      }
    });
  }
}

// ============================================================================
// 13. Form Submissions (Login, Signup, Recover, Outlet, Review)
// ============================================================================

function initForms() {
  // Login Form
  const formLogin = document.getElementById('formLogin');
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail')?.value;
      const password = document.getElementById('loginPassword')?.value;
      const alertBox = document.getElementById('loginAlert');

      try {
        const res = await api('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });

        if (res.error) {
          if (alertBox) {
            alertBox.className = 'auth-alert error';
            alertBox.textContent = res.error;
          }
          return;
        }

        if (res.token) {
          localStorage.setItem('r2r_token', res.token);
          currentToken = res.token;
          currentUser = res.user;
          showToast(`Welcome back, ${currentUser.full_name || 'Chef'}!`);
          await checkAuthAndBootstrap();
          appNavigate('/dashboard');
        }
      } catch (err) {
        if (alertBox) {
          alertBox.className = 'auth-alert error';
          alertBox.textContent = 'Failed to sign in. Please check your network connection.';
        }
      }
    });
  }

  // Quick Demo Login Button
  const btnDemoLogin = document.getElementById('btnQuickDemoLogin');
  if (btnDemoLogin) {
    btnDemoLogin.addEventListener('click', () => {
      document.getElementById('loginEmail').value = 'owner@royalspice.com';
      document.getElementById('loginPassword').value = 'StrongPassword99$!';
      document.getElementById('btnLoginSubmit').click();
    });
  }

  // Signup Form
  const formSignup = document.getElementById('formSignup');
  if (formSignup) {
    formSignup.addEventListener('submit', async (e) => {
      e.preventDefault();
      const full_name = document.getElementById('signupFullName')?.value;
      const organization_name = document.getElementById('signupOrgName')?.value;
      const email = document.getElementById('signupEmail')?.value;
      const password = document.getElementById('signupPassword')?.value;
      const plan_tier = document.getElementById('signupPlanTier')?.value || 'growth';
      const alertBox = document.getElementById('signupAlert');

      try {
        const res = await api('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ full_name, organization_name, email, password, plan_tier })
        });

        if (res.error) {
          if (alertBox) {
            alertBox.className = 'auth-alert error';
            alertBox.textContent = res.error;
          }
          return;
        }

        if (res.token) {
          localStorage.setItem('r2r_token', res.token);
          currentToken = res.token;
          currentUser = res.user;
          showToast(`Account created for ${organization_name}!`);
          await checkAuthAndBootstrap();
          appNavigate('/dashboard');
        }
      } catch (err) {
        if (alertBox) {
          alertBox.className = 'auth-alert error';
          alertBox.textContent = 'Failed to register account.';
        }
      }
    });
  }

  // Recover Password Form
  const formRecover = document.getElementById('formRecover');
  if (formRecover) {
    formRecover.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('recoverEmail')?.value;
      const alertBox = document.getElementById('recoverAlert');

      await api('/api/auth/recover', {
        method: 'POST',
        body: JSON.stringify({ email })
      });

      if (alertBox) {
        alertBox.className = 'auth-alert success';
        alertBox.textContent = 'If an account exists with this email address, password reset instructions have been sent.';
      }
    });
  }

  // New Outlet Form
  const formNewOutlet = document.getElementById('formNewOutlet');
  if (formNewOutlet) {
    formNewOutlet.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('newOutletName')?.value;
      const code = document.getElementById('newOutletCode')?.value;
      const city = document.getElementById('newOutletCity')?.value;
      const time_zone = document.getElementById('newOutletTimezone')?.value;

      await api('/api/outlets', {
        method: 'POST',
        body: JSON.stringify({ name, code, city, time_zone })
      });

      showToast(`Created outlet "${name}"!`);
      document.getElementById('newOutletModal')?.classList.add('hidden');
      formNewOutlet.reset();
      await loadMeta();
    });
  }

  // Invite Team Form
  const formInvite = document.getElementById('formInviteTeam');
  if (formInvite) {
    formInvite.addEventListener('submit', async (e) => {
      e.preventDefault();
      const full_name = document.getElementById('inviteName')?.value;
      const email = document.getElementById('inviteEmail')?.value;
      const role = document.getElementById('inviteRole')?.value;

      await api('/api/team/invite', {
        method: 'POST',
        body: JSON.stringify({ full_name, email, role })
      });

      showToast(`Invited ${email} as ${role}!`);
      document.getElementById('inviteTeamModal')?.classList.add('hidden');
      formInvite.reset();
      await fetchTeam();
    });
  }

  // Manual Review Form
  const manualForm = document.getElementById('manualReviewForm');
  if (manualForm) {
    manualForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const outlet_name = document.getElementById('manOutlet')?.value;
      const star_rating = parseFloat(document.getElementById('manRating')?.value || 4);
      const review_date = document.getElementById('manDate')?.value || new Date().toISOString().slice(0, 10);
      const reviewer_name = document.getElementById('manReviewer')?.value || 'Guest Reviewer';
      const review_text = document.getElementById('manText')?.value;

      await api('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          outlet_name,
          star_rating,
          review_date,
          reviewer_name,
          review_text,
          source_platform: 'Direct Manual'
        })
      });

      showToast('Review saved and analyzed with AI!');
      document.getElementById('manualReviewModal')?.classList.add('hidden');
      manualForm.reset();
      await fetchReviews();
      await fetchOverview();
    });
  }
}

// Utility: HTML Escaping to prevent XSS
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// Phase 5: Action Center & Goal Tracking Controllers
// ============================================================================

let currentTaskFilterStatus = 'All';
let currentAnalyticsPeriod = '30d';

window.loadActionCenter = async function() {
  await Promise.all([loadTasks(), loadGoals()]);
  setupTaskFilterListeners();
};

function setupTaskFilterListeners() {
  document.querySelectorAll('#taskStatusFilterTabs .task-filter-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#taskStatusFilterTabs .task-filter-btn').forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline');
      });
      btn.classList.remove('btn-outline');
      btn.classList.add('btn-primary');
      currentTaskFilterStatus = btn.getAttribute('data-status') || 'All';
      filterTasks();
    };
  });
}

window.loadTasks = async function() {
  try {
    const priority = document.getElementById('taskPrioritySelect')?.value || 'All';
    let url = '/api/tasks';
    const params = [];
    if (currentTaskFilterStatus && currentTaskFilterStatus !== 'All') params.push(`status=${encodeURIComponent(currentTaskFilterStatus)}`);
    if (priority && priority !== 'All') params.push(`priority=${encodeURIComponent(priority)}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    const tasks = await api(url);
    cachedTasks = tasks || [];
    renderTasksList(cachedTasks);
    updateTaskPulseCounts(cachedTasks);
  } catch (err) {
    console.error('Failed to load tasks:', err);
  }
};

window.filterTasks = function() {
  loadTasks();
};

function updateTaskPulseCounts(tasks) {
  const total = tasks.length;
  const open = tasks.filter(t => t.status === 'Open' || t.status === 'In Progress').length;
  const completed = tasks.filter(t => t.status === 'Completed' || t.status === 'Resolved').length;

  const totalEl = document.getElementById('kpiTotalTasks');
  const openEl = document.getElementById('kpiOpenTasks');
  const compEl = document.getElementById('kpiCompletedTasks');

  if (totalEl) totalEl.textContent = total;
  if (openEl) openEl.textContent = open;
  if (compEl) compEl.textContent = completed;
}

function renderTasksList(tasks) {
  const container = document.getElementById('tasksList');
  if (!container) return;

  if (!tasks || tasks.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:32px; color:var(--text-muted); background:var(--bg-subtle); border-radius:var(--radius-sm);">
        <div style="font-size:24px; margin-bottom:8px;">📋</div>
        <div style="font-weight:700; color:var(--text-primary); margin-bottom:4px;">No Operational Tasks Found</div>
        <div style="font-size:12px;">Create a new playbook or convert an AI recommendation from the AI Insights page.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = tasks.map(t => {
    const isCompleted = t.status === 'Completed' || t.status === 'Resolved';
    const isDismissed = t.status === 'Dismissed';
    const isInProgress = t.status === 'In Progress';

    const priorityBadge = t.priority === 'urgent'
      ? '<span class="badge negative" style="text-transform:uppercase; font-size:10px;">Urgent Priority</span>'
      : t.priority === 'high'
      ? '<span class="badge warning" style="text-transform:uppercase; font-size:10px;">High Priority</span>'
      : '<span class="badge neutral" style="text-transform:uppercase; font-size:10px;">Medium Priority</span>';

    const statusBadge = isCompleted
      ? '<span class="badge positive">Resolved</span>'
      : isDismissed
      ? '<span class="badge" style="background:#e2e8f0; color:#475569;">Dismissed</span>'
      : isInProgress
      ? '<span class="badge" style="background:#e0e7ff; color:#3730a3;">In Progress</span>'
      : '<span class="badge warning">Open</span>';

    const linkedCitations = (t.linked_reviews || []).map(rId =>
      `<span style="display:inline-block; padding:2px 6px; background:#f1f5f9; border-radius:4px; font-size:10.5px; font-family:monospace; color:var(--text-secondary); margin-right:4px;">🔗 ${escapeHtml(rId)}</span>`
    ).join('');

    return `
      <div class="card" style="padding:16px; border:1px solid var(--border-subtle); background:${isCompleted ? '#f0fdf4' : '#fff'};">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            ${priorityBadge}
            ${statusBadge}
            <strong style="font-size:14px; color:var(--text-primary);">${escapeHtml(t.title)}</strong>
          </div>
          <div style="font-size:12px; color:var(--text-muted);">
            Due: <strong>${t.due_date || 'No deadline'}</strong>
          </div>
        </div>

        <div style="font-size:12.5px; color:var(--text-secondary); line-height:1.5; margin-bottom:12px; white-space:pre-line;">
          ${escapeHtml(t.description)}
        </div>

        ${linkedCitations ? `<div style="margin-bottom:12px;">${linkedCitations}</div>` : ''}

        ${t.actual_result ? `
          <div style="padding:8px 12px; background:#dcfce7; border-radius:6px; font-size:12px; color:#166534; margin-bottom:12px;">
            <strong>Documented Resolution:</strong> ${escapeHtml(t.actual_result)}
            ${t.after_rating ? ` &bull; <strong>Post-Intervention Rating: ${t.after_rating}★</strong>` : ''}
          </div>
        ` : ''}

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-subtle); padding-top:10px; flex-wrap:wrap; gap:8px;">
          <div style="font-size:11.5px; color:var(--text-muted);">
            Assignee: <strong>${escapeHtml(t.assignee || 'Unassigned')}</strong> &bull; Created: ${new Date(t.created_at || Date.now()).toLocaleDateString()}
          </div>
          <div style="display:flex; gap:6px;">
            ${!isCompleted && !isDismissed && !isInProgress ? `
              <button class="btn btn-xs btn-outline" onclick="startTask('${t.id}')">Start Task</button>
            ` : ''}
            ${!isCompleted && !isDismissed ? `
              <button class="btn btn-xs btn-primary" onclick="openTaskOutcomeModal('${t.id}', '${escapeHtml(t.title)}')">Record Outcome & Close</button>
              <button class="btn btn-xs btn-outline" onclick="dismissTask('${t.id}')">Dismiss</button>
            ` : ''}
            <button class="btn btn-xs btn-outline" onclick="editTask('${t.id}')">Edit</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.openNewTaskModal = function() {
  document.getElementById('taskEditId').value = '';
  document.getElementById('taskTitleInput').value = '';
  document.getElementById('taskDescInput').value = '';
  document.getElementById('taskPriorityInput').value = 'medium';
  document.getElementById('taskAssigneeInput').value = '';
  document.getElementById('taskDueDateInput').value = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  document.getElementById('taskLinkedReviewsInput').value = '';
  document.getElementById('taskModalTitle').textContent = 'Create Operational Playbook Task';
  document.getElementById('taskModal')?.classList.remove('hidden');
};

window.editTask = function(taskId) {
  const task = cachedTasks.find(t => t.id === taskId || t.action_id === taskId);
  if (!task) return;

  document.getElementById('taskEditId').value = task.id;
  document.getElementById('taskTitleInput').value = task.title || '';
  document.getElementById('taskDescInput').value = task.description || '';
  document.getElementById('taskPriorityInput').value = task.priority || 'medium';
  document.getElementById('taskAssigneeInput').value = task.assignee || '';
  document.getElementById('taskDueDateInput').value = task.due_date || '';
  document.getElementById('taskLinkedReviewsInput').value = (task.linked_reviews || []).join(', ');
  document.getElementById('taskModalTitle').textContent = 'Edit Operational Task';
  document.getElementById('taskModal')?.classList.remove('hidden');
};

window.submitTaskForm = async function() {
  const id = document.getElementById('taskEditId')?.value;
  const title = document.getElementById('taskTitleInput')?.value.trim();
  const description = document.getElementById('taskDescInput')?.value.trim();
  const priority = document.getElementById('taskPriorityInput')?.value;
  const assignee = document.getElementById('taskAssigneeInput')?.value.trim();
  const due_date = document.getElementById('taskDueDateInput')?.value;
  const rawLinks = document.getElementById('taskLinkedReviewsInput')?.value.trim();
  const linked_reviews = rawLinks ? rawLinks.split(',').map(s => s.trim()).filter(Boolean) : [];

  if (!title) {
    alert('Please enter a task title.');
    return;
  }

  try {
    if (id) {
      await api(`/api/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title, description, priority, assignee, due_date, linked_reviews })
      });
      showToast('Task updated successfully.');
    } else {
      await api('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ title, description, priority, assignee, due_date, linked_reviews })
      });
      showToast('Task created successfully.');
    }
    document.getElementById('taskModal')?.classList.add('hidden');
    await loadTasks();
  } catch (err) {
    alert('Failed to save task: ' + err.message);
  }
};

window.startTask = async function(taskId) {
  try {
    await api(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'In Progress', notes: 'Operator began playbook execution.' })
    });
    showToast('Task marked In Progress.');
    await loadTasks();
  } catch (err) {
    alert('Failed to update task: ' + err.message);
  }
};

window.openTaskOutcomeModal = function(taskId, title) {
  document.getElementById('outcomeTaskId').value = taskId;
  document.getElementById('outcomeTaskTitleDisplay').textContent = `Task: ${title}`;
  document.getElementById('taskActualResultInput').value = '';
  document.getElementById('taskAfterRatingInput').value = '';
  document.getElementById('taskOutcomeModal')?.classList.remove('hidden');
};

window.submitTaskOutcome = async function() {
  const taskId = document.getElementById('outcomeTaskId')?.value;
  const actualResult = document.getElementById('taskActualResultInput')?.value.trim();
  const afterRating = document.getElementById('taskAfterRatingInput')?.value;

  if (!actualResult) {
    alert('Please document the resolution notes or fix applied.');
    return;
  }

  try {
    await api(`/api/tasks/${taskId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({
        actual_result: actualResult,
        after_rating: afterRating ? parseFloat(afterRating) : null
      })
    });
    showToast('Task resolved and outcome telemetry recorded.');
    document.getElementById('taskOutcomeModal')?.classList.add('hidden');
    await loadTasks();
  } catch (err) {
    alert('Failed to resolve task: ' + err.message);
  }
};

window.dismissTask = async function(taskId) {
  const notes = prompt('Enter a reason for dismissing this task (optional):', 'Playbook not applicable or superseded');
  if (notes === null) return;

  try {
    await api(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'Dismissed', notes })
    });
    showToast('Task dismissed.');
    await loadTasks();
  } catch (err) {
    alert('Failed to dismiss task: ' + err.message);
  }
};

window.convertRecommendationToTask = async function(recId) {
  try {
    const res = await api('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ from_recommendation_id: recId, title: 'Operational Action: ' + recId })
    });
    showToast('AI Recommendation converted to Action Center task!');
    appNavigate('/action-center');
  } catch (err) {
    alert('Failed to convert recommendation: ' + err.message);
  }
};

// --- Goal Tracking Controller ---
let cachedGoals = [];

window.loadGoals = async function() {
  try {
    const res = await api('/api/goals');
    cachedGoals = res.goals || [];
    renderGoalsGrid(cachedGoals);
    const kpiEl = document.getElementById('kpiActiveGoals');
    if (kpiEl) kpiEl.textContent = cachedGoals.filter(g => g.status !== 'achieved').length;
  } catch (err) {
    console.error('Failed to load goals:', err);
  }
};

function renderGoalsGrid(goals) {
  const container = document.getElementById('goalsGrid');
  if (!container) return;

  if (!goals || goals.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding:32px; color:var(--text-muted); background:var(--bg-subtle); border-radius:var(--radius-sm);">
        <div style="font-size:24px; margin-bottom:8px;">🎯</div>
        <div style="font-weight:700; color:var(--text-primary); margin-bottom:4px;">No Active Growth Goals</div>
        <div style="font-size:12px;">Set a target to improve your average rating, eliminate service delays, or boost review collection.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = goals.map(g => {
    const isAchieved = g.status === 'achieved';
    const isInsufficient = g.status === 'insufficient_data';
    const isAtRisk = g.status === 'at_risk';

    const statusBadge = isAchieved
      ? '<span class="badge positive">Target Achieved 🎉</span>'
      : isInsufficient
      ? '<span class="badge" style="background:#f1f5f9; color:#64748b;">Insufficient Data</span>'
      : isAtRisk
      ? '<span class="badge negative">At Risk</span>'
      : '<span class="badge warning">In Progress</span>';

    const pct = isInsufficient ? 0 : (g.progress_pct || 0);

    return `
      <div class="card" style="padding:16px; border:1px solid var(--border-subtle); display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <strong style="font-size:13.5px; color:var(--text-primary);">${escapeHtml(g.title)}</strong>
            ${statusBadge}
          </div>

          <div style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
              <span style="color:var(--text-secondary);">Progress: <strong>${pct}%</strong></span>
              <span style="color:var(--text-muted);">Target: <strong>${g.target_value}${g.type === 'improve_rating' ? '★' : ''}</strong></span>
            </div>
            <div style="height:8px; background:var(--bg-subtle); border-radius:4px; overflow:hidden;">
              <div style="height:100%; width:${pct}%; background:${isAchieved ? '#059669' : isAtRisk ? '#e11d48' : '#2563eb'}; border-radius:4px; transition:width 0.3s ease;"></div>
            </div>
          </div>

          <div style="font-size:12px; color:var(--text-secondary); line-height:1.5; margin-bottom:10px; padding:8px 10px; background:var(--bg-subtle); border-radius:6px;">
            ${escapeHtml(g.explanation || '')}
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-subtle); padding-top:8px; font-size:11px; color:var(--text-muted);">
          <span>Window: ${g.start_date || 'Start'} to ${g.end_date || 'Ongoing'}</span>
          <button class="btn btn-xs btn-outline" style="color:var(--rose-primary);" onclick="deleteGoal('${g.id}')">Remove</button>
        </div>
      </div>
    `;
  }).join('');
}

window.openNewGoalModal = function() {
  document.getElementById('goalTitleInput').value = '';
  document.getElementById('goalTypeInput').value = 'improve_rating';
  document.getElementById('goalTargetValueInput').value = '4.5';
  document.getElementById('goalBaselineValueInput').value = '3.8';
  document.getElementById('goalStartDateInput').value = new Date().toISOString().slice(0, 10);
  document.getElementById('goalEndDateInput').value = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  toggleGoalTypeFields();
  document.getElementById('goalModal')?.classList.remove('hidden');
};

window.toggleGoalTypeFields = function() {
  const type = document.getElementById('goalTypeInput')?.value;
  const dishGroup = document.getElementById('goalDishGroup');
  if (dishGroup) {
    dishGroup.style.display = (type === 'reduce_dish_complaints') ? 'block' : 'none';
  }
};

window.submitGoalForm = async function() {
  const type = document.getElementById('goalTypeInput')?.value;
  const title = document.getElementById('goalTitleInput')?.value.trim();
  const target_value = document.getElementById('goalTargetValueInput')?.value;
  const baseline_value = document.getElementById('goalBaselineValueInput')?.value;
  const start_date = document.getElementById('goalStartDateInput')?.value;
  const end_date = document.getElementById('goalEndDateInput')?.value;
  const dish_name = document.getElementById('goalDishNameInput')?.value.trim();

  if (!title || !target_value) {
    alert('Please provide goal title and target value.');
    return;
  }

  try {
    await api('/api/goals', {
      method: 'POST',
      body: JSON.stringify({ type, title, target_value, baseline_value, start_date, end_date, dish_name })
    });
    showToast('Goal created successfully.');
    document.getElementById('goalModal')?.classList.add('hidden');
    await loadGoals();
  } catch (err) {
    alert('Failed to save goal: ' + err.message);
  }
};

window.deleteGoal = async function(goalId) {
  if (!confirm('Are you sure you want to remove this goal?')) return;
  try {
    await api(`/api/goals/${goalId}`, { method: 'DELETE' });
    showToast('Goal removed.');
    await loadGoals();
  } catch (err) {
    alert('Failed to delete goal: ' + err.message);
  }
};

// ============================================================================
// Phase 5: Analytics Dashboard & Revenue Intelligence Controllers
// ============================================================================

window.loadAnalyticsDashboard = async function() {
  setupAnalyticsPeriodListeners();
  await Promise.all([
    loadAnalyticsMetrics(),
    loadRevenueIntelligence(),
    loadExecutiveReport(),
    fetchOutlets()
  ]);
};

function setupAnalyticsPeriodListeners() {
  document.querySelectorAll('#analyticsPeriodTabs .analytics-period-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#analyticsPeriodTabs .analytics-period-btn').forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline');
      });
      btn.classList.remove('btn-outline');
      btn.classList.add('btn-primary');
      currentAnalyticsPeriod = btn.getAttribute('data-period') || '30d';
      loadAnalyticsMetrics();
    };
  });
}

window.loadAnalyticsMetrics = async function() {
  try {
    const startDate = document.getElementById('analyticsStartDate')?.value;
    const endDate = document.getElementById('analyticsEndDate')?.value;
    const outlet = document.getElementById('analyticsOutletSelect')?.value || 'All Outlets';

    let url = `/api/analytics/metrics?period=${encodeURIComponent(currentAnalyticsPeriod)}&outlet=${encodeURIComponent(outlet)}`;
    if (startDate && endDate) {
      url += `&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
    }

    const res = await api(url);
    if (!res) return;

    renderAnalyticsKPIs(res);
    renderRatingDistribution(res.rating_distribution);
    renderSentimentTimeline(res.sentiment_trends);
    renderCategoryBreakdown(res.top_complaint_categories, res.top_praise_categories);
    renderMentionedDishes(res.frequently_mentioned_dishes);
  } catch (err) {
    console.error('Failed to load analytics metrics:', err);
  }
};

function renderAnalyticsKPIs(data) {
  const summary = data.summary || {};
  const comparison = data.period_over_period || {};
  const deltas = comparison.deltas || {};

  const totalEl = document.getElementById('anKpiTotalReviews');
  const avgEl = document.getElementById('anKpiAvgRating');
  const posEl = document.getElementById('anKpiPositivePct');
  const negEl = document.getElementById('anKpiNegativePct');

  if (totalEl) totalEl.textContent = summary.total_reviews || 0;
  if (avgEl) avgEl.textContent = `${summary.average_rating || 0}★`;
  if (posEl) posEl.textContent = `${summary.positive_percentage || 0}%`;
  if (negEl) negEl.textContent = `${summary.negative_percentage || 0}%`;

  const totalDeltaEl = document.getElementById('anKpiTotalDelta');
  const ratingDeltaEl = document.getElementById('anKpiRatingDelta');
  const posDeltaEl = document.getElementById('anKpiPositiveDelta');
  const negDeltaEl = document.getElementById('anKpiNegativeDelta');

  if (!comparison.has_sufficient_data) {
    const notice = '<span style="color:var(--text-muted); font-size:11px;">⚠️ Insufficient baseline data</span>';
    if (totalDeltaEl) totalDeltaEl.innerHTML = notice;
    if (ratingDeltaEl) ratingDeltaEl.innerHTML = notice;
    if (posDeltaEl) posDeltaEl.innerHTML = notice;
    if (negDeltaEl) negDeltaEl.innerHTML = notice;
  } else {
    if (totalDeltaEl) {
      const volChange = deltas.volume_delta >= 0 ? `+${deltas.volume_delta}` : `${deltas.volume_delta}`;
      const volPct = deltas.volume_pct_change !== null ? ` (${deltas.volume_pct_change >= 0 ? '+' : ''}${deltas.volume_pct_change}%)` : '';
      totalDeltaEl.innerHTML = `<span style="color:${deltas.volume_delta >= 0 ? 'var(--emerald-primary)' : 'var(--rose-primary)'}; font-weight:600;">${volChange}${volPct}</span> vs prior period`;
    }
    if (ratingDeltaEl) {
      const rChange = deltas.rating_delta >= 0 ? `+${deltas.rating_delta}` : `${deltas.rating_delta}`;
      ratingDeltaEl.innerHTML = `<span style="color:${deltas.rating_delta >= 0 ? 'var(--emerald-primary)' : 'var(--rose-primary)'}; font-weight:600;">${rChange}★</span> vs prior period`;
    }
    if (posDeltaEl) {
      const pChange = deltas.positive_pct_delta >= 0 ? `+${deltas.positive_pct_delta}` : `${deltas.positive_pct_delta}`;
      posDeltaEl.innerHTML = `<span style="color:${deltas.positive_pct_delta >= 0 ? 'var(--emerald-primary)' : 'var(--rose-primary)'}; font-weight:600;">${pChange}%</span> vs prior period`;
    }
    if (negDeltaEl) {
      const nChange = deltas.negative_pct_delta >= 0 ? `+${deltas.negative_pct_delta}` : `${deltas.negative_pct_delta}`;
      negDeltaEl.innerHTML = `<span style="color:${deltas.negative_pct_delta <= 0 ? 'var(--emerald-primary)' : 'var(--rose-primary)'}; font-weight:600;">${nChange}%</span> vs prior period`;
    }
  }
}

function renderRatingDistribution(distribution) {
  const container = document.getElementById('ratingDistributionBars');
  if (!container || !distribution) return;

  const stars = [5, 4, 3, 2, 1];
  container.innerHTML = stars.map(s => {
    const item = distribution[s] || { count: 0, percentage: 0 };
    return `
      <div style="display:flex; align-items:center; gap:10px; font-size:12px;">
        <span style="width:24px; font-weight:700; color:var(--text-secondary);">${s}★</span>
        <div style="flex:1; height:10px; background:var(--bg-subtle); border-radius:5px; overflow:hidden;">
          <div style="height:100%; width:${item.percentage}%; background:${s >= 4 ? '#059669' : s === 3 ? '#d97706' : '#e11d48'}; border-radius:5px;"></div>
        </div>
        <span style="width:75px; text-align:right; color:var(--text-muted); font-size:11px;">
          <strong>${item.count}</strong> (${item.percentage}%)
        </span>
      </div>
    `;
  }).join('');
}

function renderSentimentTimeline(trends) {
  const container = document.getElementById('sentimentTimelineView');
  if (!container) return;

  if (!trends || trends.length === 0) {
    container.innerHTML = '<div style="font-size:12px; color:var(--text-muted); padding:16px 0;">No reviews recorded in this date range.</div>';
    return;
  }

  container.innerHTML = trends.slice(-7).map(t => {
    const posPct = t.total > 0 ? ((t.positive / t.total) * 100) : 0;
    const negPct = t.total > 0 ? ((t.negative / t.total) * 100) : 0;
    const neuPct = t.total > 0 ? ((t.neutral / t.total) * 100) : 0;

    return `
      <div style="display:flex; align-items:center; gap:10px; font-size:11.5px;">
        <span style="width:75px; color:var(--text-muted); font-family:monospace;">${t.date.slice(5)}</span>
        <div style="flex:1; height:12px; background:var(--bg-subtle); border-radius:4px; display:flex; overflow:hidden;">
          <div style="width:${posPct}%; background:#059669;" title="Positive: ${t.positive}"></div>
          <div style="width:${neuPct}%; background:#94a3b8;" title="Neutral: ${t.neutral}"></div>
          <div style="width:${negPct}%; background:#e11d48;" title="Negative: ${t.negative}"></div>
        </div>
        <span style="width:50px; text-align:right; font-weight:600; color:var(--text-secondary);">${t.total} revs</span>
      </div>
    `;
  }).join('');
}

function renderCategoryBreakdown(complaints, praises) {
  const compEl = document.getElementById('topComplaintsList');
  const praiseEl = document.getElementById('topPraisesList');

  if (compEl) {
    if (!complaints || complaints.length === 0) {
      compEl.innerHTML = '<div style="font-size:12px; color:var(--text-muted);">No friction issues reported.</div>';
    } else {
      compEl.innerHTML = complaints.slice(0, 5).map(c => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:5px 8px; background:#fff1f2; border-radius:4px; font-size:11.5px;">
          <span style="color:#9f1239; font-weight:600;">${escapeHtml(c.category)}</span>
          <span class="badge negative" style="padding:1px 6px; font-size:10.5px;">${c.count} (${c.percentage}%)</span>
        </div>
      `).join('');
    }
  }

  if (praiseEl) {
    if (!praises || praises.length === 0) {
      praiseEl.innerHTML = '<div style="font-size:12px; color:var(--text-muted);">No praise themes recorded.</div>';
    } else {
      praiseEl.innerHTML = praises.slice(0, 5).map(p => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:5px 8px; background:#f0fdf4; border-radius:4px; font-size:11.5px;">
          <span style="color:#166534; font-weight:600;">${escapeHtml(p.category)}</span>
          <span class="badge positive" style="padding:1px 6px; font-size:10.5px;">${p.count} (${p.percentage}%)</span>
        </div>
      `).join('');
    }
  }
}

function renderMentionedDishes(dishes) {
  const tbody = document.getElementById('mentionedDishesTableBody');
  if (!tbody) return;

  if (!dishes || dishes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:16px;">No dish mentions identified in this date range.</td></tr>';
    return;
  }

  tbody.innerHTML = dishes.slice(0, 8).map(d => `
    <tr>
      <td style="font-weight:600; color:var(--text-primary);">${escapeHtml(d.dish_name)}</td>
      <td><strong>${d.mentions_count}</strong></td>
      <td><span class="badge ${d.average_rating >= 4 ? 'positive' : d.average_rating <= 2.5 ? 'negative' : 'neutral'}">${d.average_rating}★</span></td>
      <td>${d.positive_percentage}%</td>
    </tr>
  `).join('');
}

// --- Revenue Intelligence Controller ---
window.loadRevenueIntelligence = async function() {
  try {
    const data = await api('/api/sales/overview');
    renderRevenueIntelligence(data);
  } catch (err) {
    console.error('Failed to load revenue intelligence:', err);
  }
};

window.handleSalesCsvUpload = async function(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('sales_file', file);

  try {
    showToast('Importing POS sales records...');
    const token = localStorage.getItem('r2r_token');
    const res = await fetch('/api/sales/import-csv', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Upload failed');

    showToast(json.message);
    await loadRevenueIntelligence();
  } catch (err) {
    alert('Failed to import sales CSV: ' + err.message);
  } finally {
    event.target.value = '';
  }
};

function renderRevenueIntelligence(data) {
  const container = document.getElementById('revenueIntelligenceContainer');
  if (!container) return;

  if (!data || !data.has_sales_data) {
    container.innerHTML = `
      <div style="text-align:center; padding:32px; color:var(--text-muted); background:var(--bg-subtle); border-radius:var(--radius-sm);">
        <div style="font-size:26px; margin-bottom:8px;">📊</div>
        <div style="font-weight:700; color:var(--text-primary); margin-bottom:4px;">No POS Sales Data Imported</div>
        <div style="font-size:12px; max-width:440px; margin:0 auto 14px auto;">
          ${escapeHtml(data?.disclaimer || 'Sales insights appear only when verified sales records are uploaded or connected via Square.')}
        </div>
        <label class="btn btn-sm btn-primary" style="cursor:pointer;">
          Upload Sales CSV Now
          <input type="file" accept=".csv" style="display:none;" onchange="handleSalesCsvUpload(event)">
        </label>
      </div>
    `;
    return;
  }

  const quads = data.quadrants || {};

  const renderQuadrantCards = (items, badgeClass, title) => {
    if (!items || items.length === 0) return '<div style="font-size:11px; color:var(--text-muted);">No dishes in this quadrant.</div>';
    return items.slice(0, 3).map(d => `
      <div style="padding:8px 10px; background:#fff; border:1px solid var(--border-subtle); border-radius:6px; margin-bottom:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="font-size:12px; color:var(--text-primary);">${escapeHtml(d.dish_name)}</strong>
          <span class="badge ${badgeClass}" style="font-size:10px;">${d.average_rating}★ (${d.review_count} revs)</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-top:4px;">
          <span>Monthly Rev: <strong>₹${Number(d.revenue || 0).toLocaleString()}</strong></span>
          <span>${d.units_sold} orders</span>
        </div>
        ${d.strategic_recommendation ? `<div style="font-size:10.5px; color:var(--text-secondary); margin-top:4px; font-style:italic;">${escapeHtml(d.strategic_recommendation)}</div>` : ''}
      </div>
    `).join('');
  };

  container.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
      <!-- Stars -->
      <div style="padding:14px; background:#f0fdf4; border-radius:8px; border:1px solid #bbf7d0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong style="font-size:12.5px; color:#166534;">⭐ Stars (High Sales & High Sentiment)</strong>
          <span class="badge positive">${quads.stars?.length || 0} Dishes</span>
        </div>
        ${renderQuadrantCards(quads.stars, 'positive', 'Stars')}
      </div>

      <!-- At-Risk Cash Cows -->
      <div style="padding:14px; background:#fff1f2; border-radius:8px; border:1px solid #fecdd3;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong style="font-size:12.5px; color:#9f1239;">🚨 At-Risk Cash Cows (High Sales & Friction)</strong>
          <span class="badge negative">${quads.at_risk_cash_cows?.length || 0} At Risk</span>
        </div>
        ${renderQuadrantCards(quads.at_risk_cash_cows, 'negative', 'Cash Cows')}
      </div>

      <!-- Hidden Gems -->
      <div style="padding:14px; background:#eff6ff; border-radius:8px; border:1px solid #bfdbfe;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong style="font-size:12.5px; color:#1e40af;">💎 Hidden Gems (High Sentiment, Upsell Target)</strong>
          <span class="badge" style="background:#dbeafe; color:#1e40af;">${quads.hidden_gems?.length || 0} Dishes</span>
        </div>
        ${renderQuadrantCards(quads.hidden_gems, 'neutral', 'Hidden Gems')}
      </div>

      <!-- Underperformers -->
      <div style="padding:14px; background:#fafaf9; border-radius:8px; border:1px solid #e7e5e4;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong style="font-size:12.5px; color:#44403c;">❓ Underperformers (Low Sales & Low Sentiment)</strong>
          <span class="badge neutral">${quads.underperformers?.length || 0} Dishes</span>
        </div>
        ${renderQuadrantCards(quads.underperformers, 'neutral', 'Underperformers')}
      </div>
    </div>
  `;
}

// --- Executive Reports Controller ---
let cachedReportData = null;

window.loadExecutiveReport = async function() {
  const type = document.getElementById('reportTypeSelect')?.value || 'weekly';
  const month = document.getElementById('reportMonthSelect')?.value || '2026-10';
  const outlet = document.getElementById('analyticsOutletSelect')?.value || 'All Outlets';

  try {
    let url = type === 'monthly'
      ? `/api/reports/monthly?month=${encodeURIComponent(month)}&outlet=${encodeURIComponent(outlet)}`
      : `/api/reports/weekly?outlet=${encodeURIComponent(outlet)}`;

    const report = await api(url);
    cachedReportData = report;
    renderExecutiveReport(report);
  } catch (err) {
    console.error('Failed to load executive report:', err);
  }
};

function renderExecutiveReport(report) {
  const container = document.getElementById('weeklyReportContainer');
  if (!container || !report) return;

  const worseningList = (report.worsening_or_new_issues || []).map(w => `
    <div style="padding:8px 12px; background:#fff1f2; border-radius:6px; font-size:12px; color:#9f1239; margin-bottom:6px;">
      <strong>⚠️ ${escapeHtml(w.issue)}:</strong> ${escapeHtml(w.description)}
    </div>
  `).join('');

  const nextActions = (report.recommended_next_actions || []).map(a => `
    <li style="margin-bottom:6px; font-size:12px; color:var(--text-secondary);">
      <span class="badge ${a.priority === 'urgent' ? 'negative' : a.priority === 'high' ? 'warning' : 'neutral'}" style="font-size:10px; margin-right:4px;">${a.priority}</span>
      <strong>${escapeHtml(a.action)}</strong> &bull; Target: ${escapeHtml(a.target_metric)}
    </li>
  `).join('');

  container.innerHTML = `
    <div style="padding:16px; background:var(--bg-subtle); border-radius:8px; border:1px solid var(--border-subtle); margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h4 style="margin:0; font-size:14px; color:var(--text-primary);">${escapeHtml(report.report_title || 'Executive Report')}</h4>
        <span style="font-size:11px; color:var(--text-muted);">Generated: ${new Date(report.generated_at || Date.now()).toLocaleDateString()}</span>
      </div>
      <div style="font-size:12.5px; color:var(--text-secondary); line-height:1.6; margin-bottom:14px;">
        ${escapeHtml(report.executive_narrative || '')}
      </div>

      ${worseningList ? `
        <div style="margin-bottom:14px;">
          <strong style="font-size:12px; color:var(--rose-primary);">Flagged Worsening or New Friction Issues:</strong>
          <div style="margin-top:6px;">${worseningList}</div>
        </div>
      ` : ''}

      ${nextActions ? `
        <div>
          <strong style="font-size:12px; color:var(--text-primary);">Recommended Next Actions:</strong>
          <ul style="margin:6px 0 0 16px; padding:0;">${nextActions}</ul>
        </div>
      ` : ''}
    </div>
  `;
}

window.printReportBrief = function() {
  window.print();
};

window.exportReportCsv = function() {
  const token = localStorage.getItem('r2r_token');
  window.open(`/api/reports/export?format=csv&type=reviews`, '_blank');
};

