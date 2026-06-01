const burgerButton = document.querySelector('.burger-button');
const menuPanel = document.querySelector('.menu-panel');
const menuBackdrop = document.querySelector('.menu-backdrop');
const menuCloseButton = document.querySelector('.menu-close');
const menuLinks = Array.from(document.querySelectorAll('.menu-link[href], .menu-link[data-menu-title], .menu-brand, .menu-access, .menu-status a'));
const promoTitle = document.querySelector('.menu-promo h2');
const promoCopy = document.querySelector('.menu-promo p');
const registrationButton = document.querySelector('.registration-button');
const loginPage = document.querySelector('[data-login-page]');
const codePage = document.querySelector('[data-code-page]');
const loginSubmit = document.querySelector('.login-submit');
const loginMagic = document.querySelector('.login-magic');
const codeLinks = Array.from(document.querySelectorAll('[data-code-link]'));
const loginError = document.querySelector('[data-login-error]');
const loginErrorCloseButtons = Array.from(document.querySelectorAll('[data-login-error-close], [data-login-error-retry]'));
const loginErrorRegister = document.querySelector('[data-login-error-register]');
const magicPanel = document.querySelector('[data-magic-panel]');
const magicCloseButtons = Array.from(document.querySelectorAll('[data-magic-close]'));
const magicRegisterButtons = Array.from(document.querySelectorAll('[data-magic-register]'));
const codeCloseButtons = Array.from(document.querySelectorAll('[data-code-close]'));
const codeInputs = Array.from(document.querySelectorAll('[data-code-inputs] input'));
const codeProgress = document.querySelector('[data-code-progress]');
const signupPage = document.querySelector('[data-signup-page]');
const signupRoot = document.querySelector('[data-signup]');
const signupSuccess = document.querySelector('[data-signup-success]');
const signupSuccessNumber = document.querySelector('[data-success-number]');
const signupSuccessEmail = document.querySelector('[data-success-email]');
const signupSuccessHome = document.querySelector('[data-success-home]');
const signupSteps = Array.from(document.querySelectorAll('[data-signup-step]'));
const scrollRevealSections = Array.from(document.querySelectorAll('.page > section'));
const questSection = document.querySelector('.quest-section');
const questPanel = document.querySelector('.quest-panel');
const questList = document.querySelector('.quest-list');
const questToggles = Array.from(document.querySelectorAll('.quest-toggle'));
const reviewsGrid = document.querySelector('.reviews-grid');
const reviewCards = Array.from(document.querySelectorAll('.review-card'));
const reviewArrows = Array.from(document.querySelectorAll('.reviews-arrow'));
const reviewsDotsContainer = document.querySelector('.reviews-dots');
const reviewDots = Array.from(document.querySelectorAll('.reviews-dots span'));
const mobileReviewsQuery = window.matchMedia('(max-width: 720px)');
let anchorHighlightTimer;
let activeSignupStep = 1;
let maxVisitedSignupStep = 0;
let signupFlowOpened = false;
let signupAttemptId = null;
let signupAttemptStatus = 'in_progress';
let signupCreatePromise = null;
let signupSaveTimer;
let menuHideTimer;
let activeReviewsPage = 0;

const pabloCountdown = document.querySelector('[data-pablo-countdown]');
const pabloWindowStart = pabloCountdown?.dataset.pabloWindowStart ? new Date(pabloCountdown.dataset.pabloWindowStart) : null;
const pabloDeadline = pabloCountdown?.dataset.pabloDeadline ? new Date(pabloCountdown.dataset.pabloDeadline) : null;
const pabloCountdownParts = {
  days: pabloCountdown?.querySelector('[data-pablo-days]'),
  hours: pabloCountdown?.querySelector('[data-pablo-hours]'),
  minutes: pabloCountdown?.querySelector('[data-pablo-minutes]'),
  seconds: pabloCountdown?.querySelector('[data-pablo-seconds]'),
};
const pabloCard = document.querySelector('.pablo-card');
const pabloCardHeaderStatus = pabloCard?.querySelector('.pablo-card__header strong');
const pabloCardFooterStatus = pabloCard?.querySelector('.pablo-card__footer span:first-child');
const pabloSlots = Array.from(document.querySelectorAll('.pablo-slot'));
const communityParticipantNumbers = Array.from(document.querySelectorAll('[data-community-participants]'));
const communityParticipantText = Array.from(document.querySelectorAll('[data-community-participants-text]'));
const communityFounderText = Array.from(document.querySelectorAll('[data-community-founders-text]'));
const communityCardNumbers = Array.from(document.querySelectorAll('[data-community-card-offset]'));
const COMMUNITY_BASE_PARTICIPANTS = 267;
const COMMUNITY_BASE_CARD_NUMBER = 268;
const PABLO_TOTAL_SLOTS = 12;
const PABLO_SLOTS_PER_WEEK = 3;
const PABLO_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PABLO_COUNTDOWN_PARTS = {
  day: 24 * 60 * 60 * 1000,
  hour: 60 * 60 * 1000,
  minute: 60 * 1000,
};
let pabloCountdownTimer = null;

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

const UTM_STORAGE_KEY = 'plankaHubUtm';
const UTM_ATTEMPT_STORAGE_KEY = 'plankaHubUtmAttemptId';
const TRACKING_PARAM_NAMES = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_id',
  'gclid',
  'yclid',
  'fbclid',
];

function getStoredUtm() {
  try {
    return JSON.parse(sessionStorage.getItem(UTM_STORAGE_KEY) || '{}');
  } catch (error) {
    return {};
  }
}

function getUrlTrackingParams() {
  const params = new URLSearchParams(window.location.search);
  const utm = {};

  params.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();

    if ((normalizedKey.startsWith('utm_') || TRACKING_PARAM_NAMES.includes(normalizedKey)) && value.trim()) {
      utm[normalizedKey] = value.trim();
    }
  });

  return utm;
}

function collectUtmParams() {
  const utm = getUrlTrackingParams();

  if (Object.keys(utm).length) {
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
    return utm;
  }

  return getStoredUtm();
}

const signupUtm = collectUtmParams();
const hasTrackingParamsInUrl = Object.keys(getUrlTrackingParams()).length > 0;

const ANALYTICS_SESSION_KEY = 'plankaHubBehaviorSessionId';
const analyticsLandingPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
let maxScrollPercentTracked = 0;
let maxScrollYTracked = 0;
let scrollTrackingTicking = false;
const sentScrollMilestones = new Set();
const scrollMilestones = [25, 50, 75, 90, 100];

function createAnalyticsSessionId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getAnalyticsSessionId() {
  try {
    const stored = localStorage.getItem(ANALYTICS_SESSION_KEY);

    if (stored) {
      return stored;
    }

    const sessionId = createAnalyticsSessionId();
    localStorage.setItem(ANALYTICS_SESSION_KEY, sessionId);
    return sessionId;
  } catch (error) {
    return createAnalyticsSessionId();
  }
}

const analyticsSessionId = getAnalyticsSessionId();

function getScrollAnalytics() {
  const documentHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight,
  );
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
  const maxScrollable = Math.max(1, documentHeight - viewportHeight);
  const scrollY = Math.max(0, window.scrollY || window.pageYOffset || 0);
  const percent = Math.min(100, Math.round((scrollY / maxScrollable) * 1000) / 10);

  maxScrollPercentTracked = Math.max(maxScrollPercentTracked, percent);
  maxScrollYTracked = Math.max(maxScrollYTracked, Math.round(scrollY));

  return {
    y: Math.round(scrollY),
    maxY: maxScrollYTracked,
    percent: maxScrollPercentTracked,
    pageHeight: documentHeight,
  };
}

function buildAnalyticsPayload(type, name, details = {}) {
  return {
    sessionId: analyticsSessionId,
    type,
    name,
    label: details.label || name,
    text: details.text || '',
    href: details.href || '',
    pagePath: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    landingPath: analyticsLandingPath,
    viewport: {
      width: window.innerWidth || document.documentElement.clientWidth || 0,
      height: window.innerHeight || document.documentElement.clientHeight || 0,
    },
    scroll: getScrollAnalytics(),
    utm: signupUtm,
    metadata: details.metadata || {},
  };
}

function sendAnalyticsEvent(type, name, details = {}, useBeacon = false) {
  const payload = buildAnalyticsPayload(type, name, details);
  const body = JSON.stringify(payload);

  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/events', new Blob([body], { type: 'application/json' }));
    return;
  }

  fetch('/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}

const analyticsClickTargets = [
  ['header.burger', '.burger-button', 'Header · burger menu'],
  ['header.logo', '.brand', 'Header · logo'],
  ['header.login', '.login-link, .registration-button', 'Header · вход'],
  ['hero.free', '.hero-cta', 'Hero · Получить бесплатно'],
  ['founders.join', '.founders-button--dark', 'Секция 2 · Стать участником'],
  ['bloggers.arrow', '.bloggers-arrow', 'Секция 3 · стрелка блогеров'],
  ['report.join', '.report-button--primary', 'Секция 5 · Стать участником'],
  ['pablo.apply', '.pablo-button, .pablo-link--telegram', 'Секция 7 · Подать заявку в Telegram'],
  ['pablo.site', '.pablo-link--site', 'Секция 7 · Сайт HIT Venture'],
  ['reviews.arrow', '.reviews-arrow', 'Секция 8 · стрелка отзывов'],
  ['telegram.subscribe', '.telegram-button', 'Секция 9 · Подписаться на канал'],
  ['faq.question', '.quest-card', 'Секция 11 · вопрос'],
  ['footer.anchor', '.site-footer a[href^="#"]', 'Футер · якорная ссылка'],
];

function resolveAnalyticsClick(target) {
  if (!(target instanceof Element)) {
    return null;
  }

  for (const [name, selector, fallbackLabel] of analyticsClickTargets) {
    const element = target.closest(selector);

    if (!element) {
      continue;
    }

    if (name === 'faq.question' && !questList?.contains(element)) {
      continue;
    }

    const label = element.getAttribute('aria-label')
      || element.querySelector('h3, strong, span')?.textContent
      || element.textContent
      || fallbackLabel;
    const href = element instanceof HTMLAnchorElement ? element.href : '';
    const index = name === 'faq.question'
      ? Array.from(questList?.querySelectorAll('.quest-card') || []).indexOf(element) + 1
      : undefined;

    return {
      name,
      label: fallbackLabel,
      text: label.replace(/\s+/g, ' ').trim().slice(0, 240),
      href,
      metadata: {
        index,
        className: element.className || '',
      },
    };
  }

  return null;
}

document.addEventListener('click', (event) => {
  const clickData = resolveAnalyticsClick(event.target);

  if (!clickData) {
    return;
  }

  sendAnalyticsEvent('click', clickData.name, clickData);
}, { capture: true });

function trackScrollDepth() {
  const scroll = getScrollAnalytics();

  scrollMilestones.forEach((milestone) => {
    if (scroll.percent < milestone || sentScrollMilestones.has(milestone)) {
      return;
    }

    sentScrollMilestones.add(milestone);
    sendAnalyticsEvent('scroll', `scroll.${milestone}`, {
      label: `Scroll ${milestone}%`,
      metadata: { milestone },
    });
  });
}

function requestScrollTracking() {
  if (scrollTrackingTicking) {
    return;
  }

  scrollTrackingTicking = true;
  requestAnimationFrame(() => {
    trackScrollDepth();
    scrollTrackingTicking = false;
  });
}

window.addEventListener('scroll', requestScrollTracking, { passive: true });
window.addEventListener('resize', requestScrollTracking);
window.addEventListener('beforeunload', () => {
  sendAnalyticsEvent('scroll', 'scroll.final', { label: 'Final scroll depth' }, true);
});
requestScrollTracking();

function getStoredSignupAttemptId() {
  try {
    const value = Number(sessionStorage.getItem(UTM_ATTEMPT_STORAGE_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch (error) {
    return null;
  }
}

function storeSignupAttemptId(attemptId) {
  try {
    if (attemptId) {
      sessionStorage.setItem(UTM_ATTEMPT_STORAGE_KEY, String(attemptId));
    }
  } catch (error) {
    // Storage can be blocked in embedded previews; the server-side attempt still exists.
  }
}

function clearStoredSignupAttemptId() {
  try {
    sessionStorage.removeItem(UTM_ATTEMPT_STORAGE_KEY);
  } catch (error) {
    // Nothing to clear when storage is unavailable.
  }
}

const storedSignupAttemptId = getStoredSignupAttemptId();

function resetSignupAttemptState({ clearStored = true } = {}) {
  clearTimeout(signupSaveTimer);
  signupAttemptId = null;
  signupAttemptStatus = 'in_progress';
  signupCreatePromise = null;

  if (clearStored) {
    clearStoredSignupAttemptId();
  }
}

function initScrollReveals() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!scrollRevealSections.length || reduceMotion) {
    return;
  }

  document.documentElement.classList.add('scroll-animations-ready');

  scrollRevealSections.forEach((section, index) => {
    section.classList.add('scroll-reveal');
    section.style.setProperty('--scroll-reveal-delay', `${Math.min(index * 25, 120)}ms`);

    if (index === 0) {
      section.classList.add('scroll-reveal--entered', 'scroll-reveal--initial');
    }
  });

  const updateAboveStates = () => {
    if (
      document.body.classList.contains('registration-mode')
      || document.body.classList.contains('login-mode')
      || document.body.classList.contains('login-code-mode')
    ) {
      return;
    }

    const upperBoundary = window.innerHeight * 0.08;

    scrollRevealSections.forEach((section) => {
      if (!section.classList.contains('scroll-reveal--entered')) {
        return;
      }

      const { bottom } = section.getBoundingClientRect();
      section.classList.toggle('scroll-reveal--above', bottom < upperBoundary);
    });
  };

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add('scroll-reveal--entered');
        revealObserver.unobserve(entry.target);
      });

      updateAboveStates();
    },
    {
      root: null,
      threshold: 0.14,
      rootMargin: '0px 0px -10% 0px',
    },
  );

  scrollRevealSections.forEach((section) => {
    if (!section.classList.contains('scroll-reveal--initial')) {
      revealObserver.observe(section);
    }
  });

  let ticking = false;
  const requestAboveUpdate = () => {
    if (ticking) {
      return;
    }

    ticking = true;
    requestAnimationFrame(() => {
      updateAboveStates();
      ticking = false;
    });
  };

  window.addEventListener('scroll', requestAboveUpdate, { passive: true });
  window.addEventListener('resize', requestAboveUpdate);
  requestAboveUpdate();
}

function restoreMainPageRevealState() {
  const firstSection = scrollRevealSections[0];

  if (!firstSection) {
    return;
  }

  firstSection.classList.add('scroll-reveal--entered', 'scroll-reveal--initial');
  firstSection.classList.remove('scroll-reveal--above');
}

function scrollMainPageToTop(behavior = 'auto') {
  restoreMainPageRevealState();
  window.scrollTo({ top: 0, left: 0, behavior });
  requestAnimationFrame(restoreMainPageRevealState);
}

function setMenuVisibility(isOpen) {
  burgerButton?.setAttribute('aria-expanded', String(isOpen));
  clearTimeout(menuHideTimer);

  if (isOpen) {
    if (menuPanel) {
      menuPanel.hidden = false;
      menuPanel.setAttribute('aria-hidden', 'false');
    }

    if (menuBackdrop) {
      menuBackdrop.hidden = false;
      menuBackdrop.setAttribute('aria-hidden', 'false');
    }

    // Force the closed visual state to paint before starting the fade-in transition.
    menuPanel?.getBoundingClientRect();
    menuBackdrop?.getBoundingClientRect();

    requestAnimationFrame(() => {
      document.body.classList.add('menu-open');
    });
    return;
  }

  document.body.classList.remove('menu-open');
  menuPanel?.setAttribute('aria-hidden', 'true');
  menuBackdrop?.setAttribute('aria-hidden', 'true');

  menuHideTimer = setTimeout(() => {
    if (burgerButton?.getAttribute('aria-expanded') === 'true') {
      return;
    }

    if (menuPanel) {
      menuPanel.hidden = true;
    }

    if (menuBackdrop) {
      menuBackdrop.hidden = true;
    }
  }, 340);
}

function closeMenu() {
  setMenuVisibility(false);
}

function openMenu() {
  setMenuVisibility(true);
  menuCloseButton?.focus({ preventScroll: true });
}

function toggleMenu() {
  const isOpen = burgerButton?.getAttribute('aria-expanded') === 'true';
  setMenuVisibility(!isOpen);
}

function setPromoTitle(title) {
  if (!promoTitle) {
    return;
  }

  const isFaqTitle = title === 'Ответы на частые вопросы';
  promoTitle.classList.toggle('menu-promo-title--faq', isFaqTitle);
  promoTitle.innerHTML = isFaqTitle ? 'Ответы на<br />частые вопросы' : title.replace(/Pre-Seed/g, 'Pre-<br />Seed');
}

function setActiveMenuLink(link) {
  if (!link?.classList.contains('menu-link')) {
    return;
  }

  document.querySelectorAll('.menu-link--active').forEach((item) => {
    item.classList.remove('menu-link--active');
  });

  link.classList.add('menu-link--active');

  if (promoTitle && link.dataset.menuTitle) {
    setPromoTitle(link.dataset.menuTitle);
  }

  if (promoCopy && link.dataset.menuCopy) {
    promoCopy.textContent = link.dataset.menuCopy;
  }
}

function showSignupStep(step) {
  activeSignupStep = Math.min(Math.max(step, 1), signupSteps.length || 1);
  maxVisitedSignupStep = Math.max(maxVisitedSignupStep, activeSignupStep);

  if (signupRoot) {
    signupRoot.dataset.activeStep = String(activeSignupStep);
  }

  signupSteps.forEach((item) => {
    const isActive = Number(item.dataset.signupStep) === activeSignupStep;
    item.hidden = !isActive;
    item.classList.toggle('is-active', isActive);
  });

  updateSignupActions();
}

function getSignupField(name) {
  return signupRoot?.querySelector(`[name="${name}"]`) || null;
}

function getSignupFieldValue(name) {
  const field = getSignupField(name);
  return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement ? field.value.trim() : '';
}

function hasActiveSignupChip(fieldName) {
  return Boolean(signupRoot?.querySelector(`.signup-chips[data-signup-field="${fieldName}"] .signup-chip.is-active`));
}

function isValidSignupEmail() {
  const field = getSignupField('email');

  if (!(field instanceof HTMLInputElement) || !field.value.trim()) {
    return false;
  }

  return field.validity.valid;
}

function isSignupStepComplete(step) {
  if (step === 1) {
    return Boolean(getSignupFieldValue('first-name') && getSignupFieldValue('last-name') && hasActiveSignupChip('role'));
  }

  if (step === 2) {
    return Boolean(hasActiveSignupChip('stage') && hasActiveSignupChip('needs'));
  }

  if (step === 3) {
    const privacy = getSignupField('privacy');
    return Boolean(isValidSignupEmail() && getSignupFieldValue('contact') && privacy instanceof HTMLInputElement && privacy.checked);
  }

  return false;
}

function updateSignupActions() {
  signupSteps.forEach((stepElement) => {
    const step = Number(stepElement.dataset.signupStep);
    const isComplete = isSignupStepComplete(step);

    stepElement.querySelectorAll('[data-signup-next], button[type="submit"]').forEach((button) => {
      if (button instanceof HTMLButtonElement) {
        button.disabled = !isComplete;
      }
    });
  });
}

function formatSignupAttemptNumber(attemptId) {
  const number = Number.isInteger(Number(attemptId)) ? Number(attemptId) : 0;
  return `PH-2026-${String(number).padStart(4, '0')}`;
}

function showSignupSuccess() {
  if (!signupRoot || !signupSuccess) {
    return;
  }

  if (signupSuccessNumber) {
    signupSuccessNumber.textContent = formatSignupAttemptNumber(signupAttemptId);
  }

  if (signupSuccessEmail) {
    signupSuccessEmail.textContent = getSignupFieldValue('email') || 'you@startup.io';
  }

  signupRoot.classList.add('is-submitted');
  document.body.classList.add('signup-submitted');
  signupSuccess.hidden = false;
}

function hideSignupSuccess() {
  signupRoot?.classList.remove('is-submitted');
  document.body.classList.remove('signup-submitted');

  if (signupSuccess) {
    signupSuccess.hidden = true;
  }
}

function getTrackedSignupStep() {
  if (!signupFlowOpened) {
    return 0;
  }

  return Math.max(activeSignupStep, maxVisitedSignupStep);
}

function collectSignupFields() {
  const form = signupRoot?.querySelector('form');

  if (!form) {
    return {};
  }

  const fields = {};

  form.querySelectorAll('input[name], textarea[name], select[name]').forEach((field) => {
    const step = field.closest('[data-signup-step]');

    if (step && Number(step.dataset.signupStep) > maxVisitedSignupStep) {
      return;
    }

    if (field instanceof HTMLInputElement && field.type === 'checkbox') {
      fields[field.name] = field.checked;
      return;
    }

    const value = field.value.trim();

    if (value) {
      fields[field.name] = value;
    }
  });

  form.querySelectorAll('.signup-chips[data-signup-field]').forEach((group) => {
    const step = group.closest('[data-signup-step]');
    const key = group.dataset.signupField;
    const selected = Array.from(group.querySelectorAll('.signup-chip.is-active')).map((chip) => chip.textContent.trim());

    if (!key || (step && Number(step.dataset.signupStep) > maxVisitedSignupStep)) {
      return;
    }

    fields[key] = group.hasAttribute('data-multi') ? selected : selected[0] || '';
  });

  return fields;
}

async function startSignupAttempt(options = {}) {
  if (!signupRoot) {
    return null;
  }

  const {
    currentStep = getTrackedSignupStep(),
    fields = collectSignupFields(),
    syncVisitedStep = true,
    forceNew = false,
  } = options;

  if (forceNew) {
    resetSignupAttemptState();
  }

  if (!forceNew && signupAttemptStatus !== 'submitted') {
    if (signupCreatePromise) {
      return signupCreatePromise;
    }

    if (signupAttemptId) {
      return { id: signupAttemptId };
    }
  }

  signupAttemptId = null;
  signupAttemptStatus = 'in_progress';
  if (syncVisitedStep) {
    maxVisitedSignupStep = activeSignupStep;
  }
  clearTimeout(signupSaveTimer);

  signupCreatePromise = fetch('/api/registration-attempts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentStep,
      fields,
      utm: signupUtm,
    }),
  })
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Attempt create failed'))))
    .then((attempt) => {
      signupAttemptId = attempt.id;
      storeSignupAttemptId(attempt.id);
      return attempt;
    })
    .catch((error) => {
      console.warn('РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РїРѕРїС‹С‚РєСѓ СЂРµРіРёСЃС‚СЂР°С†РёРё', error);
      signupCreatePromise = null;
      return null;
    });

  return signupCreatePromise;
}

function trackUtmLandingVisit() {
  if (!hasTrackingParamsInUrl || !Object.keys(signupUtm).length || hasActiveSignupAttempt()) {
    return;
  }

  startSignupAttempt({
    currentStep: 0,
    fields: {},
    syncVisitedStep: false,
  });
}

function hasActiveSignupAttempt() {
  return signupAttemptStatus !== 'submitted' && Boolean(signupAttemptId || signupCreatePromise);
}

function openSignupFlow(options = {}) {
  const { forceNewAttempt = !document.body.classList.contains('registration-mode') } = options;
  const shouldCreateAttempt = forceNewAttempt || !hasActiveSignupAttempt();

  hideSignupSuccess();

  if (shouldCreateAttempt) {
    resetSignupAttemptState();
    activeSignupStep = 1;
    maxVisitedSignupStep = 1;
  } else {
    activeSignupStep = Math.max(activeSignupStep, 1);
  }

  setRegistrationMode(true);

  if (shouldCreateAttempt) {
    startSignupAttempt({ forceNew: true });
    return;
  }

  persistSignupAttempt();
}

async function persistSignupAttempt(status = 'in_progress') {
  if (!signupRoot) {
    return null;
  }

  if (!signupAttemptId && signupCreatePromise) {
    await signupCreatePromise;
  }

  if (!signupAttemptId) {
    return null;
  }

  const nextStatus = signupAttemptStatus === 'submitted' ? 'submitted' : status;

  try {
    const response = await fetch(`/api/registration-attempts/${signupAttemptId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentStep: getTrackedSignupStep(),
        status: nextStatus,
        fields: collectSignupFields(),
      }),
    });

    if (response.status === 404) {
      clearStoredSignupAttemptId();
      signupAttemptId = null;
      signupCreatePromise = null;

      if (signupFlowOpened && signupAttemptStatus !== 'submitted') {
        await startSignupAttempt({
          currentStep: getTrackedSignupStep(),
          fields: collectSignupFields(),
          syncVisitedStep: false,
        });
        return persistSignupAttempt(status);
      }
    }

    if (response.ok) {
      const attempt = await response.json();

      if (attempt.communityCounter) {
        renderCommunityCounter(attempt.communityCounter);
      } else if (toFiniteNumber(attempt.currentStep, 0) >= 2) {
        await refreshCommunityCounter();
      }

      return attempt;
    }
  } catch (error) {
    console.warn('Не удалось сохранить попытку регистрации', error);
  }
  return null;
}

function scheduleSignupSave() {
  clearTimeout(signupSaveTimer);
  signupSaveTimer = setTimeout(() => {
    persistSignupAttempt();
  }, 350);
}

async function submitSignupAttempt() {
  if (!signupAttemptId && signupCreatePromise) {
    await signupCreatePromise;
  }

  if (!signupAttemptId) {
    return;
  }

  try {
    const response = await fetch(`/api/registration-attempts/${signupAttemptId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: collectSignupFields(),
      }),
    });

    if (response.ok) {
      const attempt = await response.json();

      if (attempt.communityCounter) {
        renderCommunityCounter(attempt.communityCounter);
      } else {
        await refreshCommunityCounter();
      }
    }
  } catch (error) {
    console.warn('Не удалось отправить попытку регистрации', error);
  }

  signupAttemptStatus = 'submitted';
}

function flushSignupAttempt() {
  if (!signupAttemptId || !signupRoot) {
    return;
  }

  clearTimeout(signupSaveTimer);

  fetch(`/api/registration-attempts/${signupAttemptId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentStep: getTrackedSignupStep(),
      status: signupAttemptStatus === 'submitted' ? 'submitted' : 'in_progress',
      fields: collectSignupFields(),
    }),
    keepalive: true,
  }).catch(() => {});
}

function setRegistrationMode(isOpen, shouldUpdateHistory = true) {
  if (isOpen) {
    document.body.classList.remove('login-mode', 'login-code-mode', 'login-error-open', 'magic-link-open');

    if (loginPage) {
      loginPage.hidden = true;
    }

    if (codePage) {
      codePage.hidden = true;
    }

    if (loginError) {
      loginError.hidden = true;
    }

    if (magicPanel) {
      magicPanel.hidden = true;
    }
  }

  document.body.classList.toggle('registration-mode', isOpen);

  if (!isOpen) {
    hideSignupSuccess();
    refreshCommunityCounter();
    requestAnimationFrame(restoreMainPageRevealState);
  }

  if (signupPage) {
    signupPage.hidden = !isOpen;
  }

  if (isOpen) {
    signupFlowOpened = true;
    closeMenu();
    showSignupStep(activeSignupStep || 1);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));

    if (shouldUpdateHistory && window.location.hash !== '#registration') {
      history.pushState(null, '', '#registration');
    }
  }
}

function setLoginMode(isOpen, shouldUpdateHistory = true) {
  document.body.classList.toggle('login-mode', isOpen);
  document.body.classList.remove('login-code-mode');
  hideLoginError();
  hideMagicPanel();

  if (loginPage) {
    loginPage.hidden = !isOpen;
  }

  if (codePage) {
    codePage.hidden = true;
  }

  if (!isOpen) {
    requestAnimationFrame(restoreMainPageRevealState);
  }

  if (isOpen) {
    document.body.classList.remove('registration-mode', 'signup-submitted');
    hideSignupSuccess();

    if (signupPage) {
      signupPage.hidden = true;
    }

    closeMenu();
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));

    if (shouldUpdateHistory && window.location.hash !== '#login') {
      history.pushState(null, '', '#login');
    }
  }
}

function setLoginCodeMode(isOpen, showLogin = false) {
  document.body.classList.toggle('login-code-mode', isOpen);
  document.body.classList.toggle('login-mode', !isOpen && showLogin);
  document.body.classList.remove('registration-mode', 'signup-submitted', 'login-error-open', 'magic-link-open');

  if (loginPage) {
    loginPage.hidden = isOpen || !showLogin;
  }

  if (codePage) {
    codePage.hidden = !isOpen;
  }

  if (signupPage) {
    signupPage.hidden = true;
  }

  if (loginError) {
    loginError.hidden = true;
  }

  if (magicPanel) {
    magicPanel.hidden = true;
  }

  if (isOpen) {
    hideSignupSuccess();
    closeMenu();
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      const nextInput = codeInputs.find((input) => !input.value.trim()) || codeInputs[0];
      nextInput?.focus({ preventScroll: true });
    });
    return;
  }

  requestAnimationFrame(restoreMainPageRevealState);
}

function showLoginError() {
  if (!loginError) {
    return;
  }

  document.body.classList.add('login-error-open');
  loginError.hidden = false;
  loginError.querySelector('[data-login-error-retry]')?.focus({ preventScroll: true });
}

function hideLoginError() {
  if (!loginError) {
    return;
  }

  document.body.classList.remove('login-error-open');
  loginError.hidden = true;
}

function showMagicPanel() {
  if (!magicPanel) {
    return;
  }

  document.body.classList.add('magic-link-open');
  magicPanel.hidden = false;
  magicPanel.querySelector('input')?.focus({ preventScroll: true });
}

function hideMagicPanel() {
  if (!magicPanel) {
    return;
  }

  document.body.classList.remove('magic-link-open');
  magicPanel.hidden = true;
}

function scrollToAnchor(anchor) {
  if (anchor === '#registration') {
    openSignupFlow();
    return true;
  }

  if (anchor === '#login') {
    setLoginMode(true);
    return true;
  }

  if (anchor === '#code') {
    setLoginCodeMode(true);
    updateActivationCodeState();
    if (window.location.hash !== '#code') {
      history.pushState(null, '', '#code');
    }
    return true;
  }

  if (document.body.classList.contains('registration-mode')) {
    setRegistrationMode(false, false);
  }

  if (document.body.classList.contains('login-mode')) {
    setLoginMode(false, false);
  }

  if (document.body.classList.contains('login-code-mode')) {
    setLoginCodeMode(false);
  }

  const target = document.querySelector(anchor);

  if (!target) {
    return false;
  }

  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  history.pushState(null, '', anchor);

  if (anchor === '#grants') {
    target.classList.add('give-note--anchor-highlight');
    clearTimeout(anchorHighlightTimer);
    anchorHighlightTimer = setTimeout(() => {
      target.classList.remove('give-note--anchor-highlight');
    }, 1800);
  }

  return true;
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatCommunityCardNumber(number) {
  return `00 · ${number}`;
}

function renderCommunityCounter(counter = {}) {
  const step2Count = Math.max(0, toFiniteNumber(counter.step2Count, 0));
  const participants = Math.max(COMMUNITY_BASE_PARTICIPANTS, toFiniteNumber(counter.participants, COMMUNITY_BASE_PARTICIPANTS + step2Count));
  const cardNumber = Math.max(COMMUNITY_BASE_CARD_NUMBER, toFiniteNumber(counter.cardNumber, COMMUNITY_BASE_CARD_NUMBER + step2Count));

  communityParticipantNumbers.forEach((item) => {
    item.textContent = String(participants);
  });

  communityParticipantText.forEach((item) => {
    item.textContent = `${participants} участников`;
  });

  communityFounderText.forEach((item) => {
    item.textContent = `Нас ${participants} фаундеров уже внутри`;
  });

  communityCardNumbers.forEach((item) => {
    const offset = toFiniteNumber(item.dataset.communityCardOffset, 0);
    item.textContent = formatCommunityCardNumber(cardNumber + offset);
  });
}

async function refreshCommunityCounter() {
  try {
    const response = await fetch('/api/community-counter', { cache: 'no-store' });

    if (!response.ok) {
      throw new Error('Community counter request failed');
    }

    renderCommunityCounter(await response.json());
  } catch (error) {
    renderCommunityCounter();
  }
}

function formatPabloCountdownPart(value) {
  return String(Math.max(0, value)).padStart(2, '0');
}

function getPabloCohortState(now = new Date()) {
  if (!pabloDeadline || Number.isNaN(pabloDeadline.getTime())) {
    return {
      remaining: PABLO_TOTAL_SLOTS,
      occupied: 0,
      isClosed: false,
    };
  }

  const msLeft = Math.max(0, pabloDeadline.getTime() - now.getTime());
  const windowStart = pabloWindowStart && !Number.isNaN(pabloWindowStart.getTime())
    ? pabloWindowStart.getTime()
    : pabloDeadline.getTime() - 4 * PABLO_WEEK_MS;
  const elapsedMs = Math.max(0, now.getTime() - windowStart);
  const elapsedWeeks = Math.min(4, Math.floor(elapsedMs / PABLO_WEEK_MS));
  const occupied = msLeft <= 0 ? PABLO_TOTAL_SLOTS : Math.min(PABLO_TOTAL_SLOTS, elapsedWeeks * PABLO_SLOTS_PER_WEEK);

  return {
    remaining: PABLO_TOTAL_SLOTS - occupied,
    occupied,
    isClosed: msLeft <= 0,
  };
}

function updatePabloSlots(now = new Date()) {
  if (!pabloSlots.length) {
    return;
  }

  const { remaining, occupied } = getPabloCohortState(now);

  pabloSlots.forEach((slot, index) => {
    slot.classList.toggle('is-filled', index < occupied);
  });

  if (pabloCardHeaderStatus) {
    pabloCardHeaderStatus.textContent = `Открыто ${remaining} · занято ${occupied}`;
  }

  if (pabloCardFooterStatus) {
    pabloCardFooterStatus.innerHTML = `Осталось <b>${remaining}</b> · занято ${occupied}`;
  }
}

function updatePabloCountdown() {
  if (!pabloCountdown || !pabloDeadline || Number.isNaN(pabloDeadline.getTime())) {
    updatePabloSlots();
    return;
  }

  const now = new Date();
  const msLeft = Math.max(0, pabloDeadline.getTime() - now.getTime());
  const days = Math.floor(msLeft / PABLO_COUNTDOWN_PARTS.day);
  const hours = Math.floor((msLeft % PABLO_COUNTDOWN_PARTS.day) / PABLO_COUNTDOWN_PARTS.hour);
  const minutes = Math.floor((msLeft % PABLO_COUNTDOWN_PARTS.hour) / PABLO_COUNTDOWN_PARTS.minute);
  const seconds = Math.floor((msLeft % PABLO_COUNTDOWN_PARTS.minute) / 1000);

  if (pabloCountdownParts.days) {
    pabloCountdownParts.days.textContent = formatPabloCountdownPart(days);
  }

  if (pabloCountdownParts.hours) {
    pabloCountdownParts.hours.textContent = formatPabloCountdownPart(hours);
  }

  if (pabloCountdownParts.minutes) {
    pabloCountdownParts.minutes.textContent = formatPabloCountdownPart(minutes);
  }

  if (pabloCountdownParts.seconds) {
    pabloCountdownParts.seconds.textContent = formatPabloCountdownPart(seconds);
  }

  updatePabloSlots(now);
  pabloCard?.classList.toggle('is-countdown-ended', msLeft <= 0);

  if (msLeft <= 0 && pabloCountdownTimer) {
    window.clearInterval(pabloCountdownTimer);
    pabloCountdownTimer = null;
  }
}

function getQuestLayoutConfig() {
  if (window.matchMedia('(max-width: 720px)').matches) {
    return {
      rows: [[0], [1], [2], [3], [4], [5]],
      columns: [0],
      baseHeights: [56, 72, 72, 72, 72, 56],
      featuredOpenHeight: 155,
      openHeight: 188,
      afterFeaturedGap: 10.39,
      rowGap: 10.39,
      baseListHeight: 485,
      basePanelHeight: 548,
      baseSectionHeight: 608,
    };
  }

  if (window.matchMedia('(min-width: 721px) and (max-width: 900px)').matches) {
    return {
      rows: [[0], [1, 2], [3, 4], [5, 6]],
      columns: [0, 499],
      baseHeights: [171.75, 161, 161, 161, 161, 162, 162],
      featuredOpenHeight: 188,
      openHeight: 200,
      afterFeaturedGap: 14,
      rowGap: 35.25,
      baseListHeight: 740.25,
      basePanelHeight: 992,
      baseSectionHeight: 700,
      sectionScale: 0.66,
    };
  }

  return {
    rows: [[0], [1, 2], [3, 4], [5, 6]],
    columns: [0, 499],
    baseHeights: [171.75, 161, 161, 161, 161, 162, 162],
    featuredOpenHeight: 188,
    openHeight: 200,
    afterFeaturedGap: 14,
    rowGap: 35.25,
    baseListHeight: 740.25,
    basePanelHeight: 992,
    baseSectionHeight: 971,
  };
}

function getQuestCardLayoutHeight(card, index, config) {
  if (!card?.classList.contains('is-open')) {
    return config.baseHeights[index] || config.baseHeights[1];
  }

  return index === 0 ? config.featuredOpenHeight : config.openHeight;
}

function updateQuestLayout() {
  if (!questSection || !questPanel || !questList) {
    return;
  }

  const cards = Array.from(questList.querySelectorAll('.quest-card'));
  const config = getQuestLayoutConfig();
  let top = 0;
  let listHeight = 0;

  config.rows.forEach((row, rowIndex) => {
    let rowHeight = 0;

    row.forEach((cardIndex, columnIndex) => {
      const card = cards[cardIndex];

      if (!card) {
        return;
      }

      const height = getQuestCardLayoutHeight(card, cardIndex, config);
      rowHeight = Math.max(rowHeight, height);
      card.style.top = `${top}px`;
      card.style.left = `${config.columns[columnIndex] || 0}px`;
    });

    listHeight = top + rowHeight;
    top += rowHeight + (rowIndex === 0 ? config.afterFeaturedGap : config.rowGap);
  });

  const heightDelta = Math.max(0, listHeight - config.baseListHeight);
  const sectionDelta = heightDelta * (config.sectionScale || 1);
  questList.style.height = `${listHeight}px`;
  questPanel.style.height = `${config.basePanelHeight + heightDelta}px`;
  questSection.style.height = `${config.baseSectionHeight + sectionDelta}px`;
}

function setQuestCardOpen(card, toggle, isOpen) {
  const isMobileQuest = window.matchMedia('(max-width: 720px)').matches;
  const isDesktopQuest = window.matchMedia('(min-width: 1181px)').matches;
  const isExclusiveQuest = isMobileQuest || isDesktopQuest;

  if (isExclusiveQuest && isOpen) {
    questToggles.forEach((item) => {
      const itemCard = item.closest('.quest-card');

      if (!itemCard || itemCard === card) {
        return;
      }

      itemCard.classList.remove('is-open');
      item.setAttribute('aria-expanded', 'false');
      const itemLabel = item.querySelector('span');
      if (itemLabel) {
        itemLabel.textContent = 'Подробно';
      }
    });
  }

  if (isExclusiveQuest && !isOpen) {
    isOpen = true;
  }

  card.classList.toggle('is-open', isOpen);
  toggle.setAttribute('aria-expanded', String(isOpen));

  const label = toggle.querySelector('span');
  if (label) {
    label.textContent = isOpen ? 'Свернуть' : 'Подробно';
  }

  updateQuestLayout();
}

questToggles.forEach((toggle) => {
  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const card = toggle.closest('.quest-card');

    if (!card) {
      return;
    }

    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    setQuestCardOpen(card, toggle, !isOpen);
  });
});

questList?.addEventListener('click', (event) => {
  if (!window.matchMedia('(max-width: 720px)').matches && !window.matchMedia('(min-width: 1181px)').matches) {
    return;
  }

  const card = event.target.closest('.quest-card');

  if (!card || !questList.contains(card) || Array.from(questList.querySelectorAll('.quest-card')).indexOf(card) > 4) {
    return;
  }

  const toggle = card.querySelector('.quest-toggle');

  if (!toggle) {
    return;
  }

  setQuestCardOpen(card, toggle, true);
});

function syncMobileQuestState() {
  const isExclusiveQuest = window.matchMedia('(max-width: 720px)').matches || window.matchMedia('(min-width: 1181px)').matches;

  if (!isExclusiveQuest || !questList) {
    updateQuestLayout();
    return;
  }

  const cards = Array.from(questList.querySelectorAll('.quest-card')).slice(0, 5);
  const openCard = cards.find((card) => card.classList.contains('is-open')) || cards[0];

  cards.forEach((card) => {
    const toggle = card.querySelector('.quest-toggle');
    const isOpen = card === openCard;
    card.classList.toggle('is-open', isOpen);
    toggle?.setAttribute('aria-expanded', String(isOpen));
    const label = toggle?.querySelector('span');
    if (label) {
      label.textContent = isOpen ? 'Свернуть' : 'Подробно';
    }
  });

  updateQuestLayout();
}

window.addEventListener('resize', updateQuestLayout);
window.addEventListener('resize', syncMobileQuestState);
syncMobileQuestState();

registrationButton?.addEventListener('click', () => {
  setLoginMode(true);
});

signupRoot?.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const chip = target?.closest('.signup-chip');
  const nextButton = target?.closest('[data-signup-next]');
  const prevButton = target?.closest('[data-signup-prev]');

  if (chip instanceof HTMLButtonElement) {
    const group = chip.closest('.signup-chips');

    if (!group?.hasAttribute('data-multi')) {
      group?.querySelectorAll('.signup-chip').forEach((item) => {
        item.classList.remove('is-active');
        item.setAttribute('aria-pressed', 'false');
      });
    }

    const isActive = group?.hasAttribute('data-multi') ? !chip.classList.contains('is-active') : true;
    chip.classList.toggle('is-active', isActive);
    chip.setAttribute('aria-pressed', String(isActive));
    updateSignupActions();
    scheduleSignupSave();
    return;
  }

  if (nextButton) {
    if (nextButton instanceof HTMLButtonElement && nextButton.disabled) {
      return;
    }

    const nextStep = activeSignupStep + 1;
    showSignupStep(nextStep);
    persistSignupAttempt().then(() => {
      if (nextStep >= 2) {
        refreshCommunityCounter();
      }
    });
    return;
  }

  if (prevButton) {
    showSignupStep(activeSignupStep - 1);
    persistSignupAttempt();
  }
});

signupRoot?.addEventListener('input', () => {
  updateSignupActions();
  scheduleSignupSave();
});

signupRoot?.addEventListener('change', () => {
  updateSignupActions();
  scheduleSignupSave();
});

signupRoot?.querySelector('form')?.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!isSignupStepComplete(3)) {
    const nextField = !isValidSignupEmail()
      ? getSignupField('email')
      : !getSignupFieldValue('contact')
        ? getSignupField('contact')
        : getSignupField('privacy');

    nextField?.focus({ preventScroll: true });
    return;
  }

  clearTimeout(signupSaveTimer);
  await submitSignupAttempt();
  showSignupSuccess();

  clearStoredSignupAttemptId();
});

signupSuccessHome?.addEventListener('click', () => {
  hideSignupSuccess();
  setRegistrationMode(false, false);
  history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
  scrollMainPageToTop('smooth');
});

burgerButton?.addEventListener('click', (event) => {
  event.stopPropagation();
  toggleMenu();
});

menuCloseButton?.addEventListener('click', closeMenu);
menuBackdrop?.addEventListener('click', closeMenu);

menuPanel?.addEventListener('click', (event) => {
  const inactiveMenuItem = event.target instanceof Element ? event.target.closest('.menu-link[data-menu-title]:not(a)') : null;

  if (inactiveMenuItem && menuPanel.contains(inactiveMenuItem)) {
    event.preventDefault();
    setActiveMenuLink(inactiveMenuItem);
    return;
  }

  const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;

  if (!(link instanceof HTMLAnchorElement)) {
    return;
  }

  const anchor = link.getAttribute('href');

  if (!anchor || anchor === '#') {
    return;
  }

  event.preventDefault();
  setActiveMenuLink(link);
  closeMenu();
  requestAnimationFrame(() => scrollToAnchor(anchor));
});

document.addEventListener('click', (event) => {
  const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;

  if (!(link instanceof HTMLAnchorElement) || menuPanel?.contains(link)) {
    return;
  }

  const anchor = link.getAttribute('href');

  if (!anchor || anchor === '#') {
    return;
  }

  if (anchor !== '#registration' && anchor !== '#login' && anchor !== '#code' && !document.querySelector(anchor)) {
    return;
  }

  event.preventDefault();
  closeMenu();
  scrollToAnchor(anchor);
});

menuLinks.forEach((link) => {
  link.addEventListener('mouseenter', () => setActiveMenuLink(link));
  link.addEventListener('focus', () => setActiveMenuLink(link));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    hideLoginError();
    hideMagicPanel();
    closeMenu();
  }
});

function syncRouteFromHash() {
  const hash = window.location.hash;

  if (hash === '#registration') {
    openSignupFlow({ forceNewAttempt: !hasActiveSignupAttempt() });
    return;
  }

  if (hash === '#login') {
    setLoginMode(true, false);
    return;
  }

  if (hash === '#code') {
    setLoginCodeMode(true, false);
    updateActivationCodeState();
    return;
  }

  setRegistrationMode(false, false);
  setLoginMode(false, false);
  setLoginCodeMode(false);
}

window.addEventListener('popstate', syncRouteFromHash);
window.addEventListener('hashchange', syncRouteFromHash);

window.addEventListener('beforeunload', flushSignupAttempt);

if (window.location.hash === '#registration') {
  activeSignupStep = 1;
  maxVisitedSignupStep = 1;
  setRegistrationMode(true, false);
  startSignupAttempt({ forceNew: true });
}

if (window.location.hash === '#login') {
  setLoginMode(true, false);
}

if (window.location.hash === '#code') {
  setLoginCodeMode(true, false);
  updateActivationCodeState();
}

function updateActivationCodeState() {
  const filledCount = codeInputs.filter((input) => input.value.trim()).length;

  codeInputs.forEach((input) => {
    input.classList.toggle('has-value', Boolean(input.value.trim()));
  });

  if (codeProgress) {
    codeProgress.textContent = `${filledCount} / 16 · ${filledCount === 16 ? 'код заполнен' : 'продолжайте ввод'}`;
  }
}

function getReviewCardData(card) {
  return {
    tag: card.querySelector('.review-tag')?.textContent || '',
    stage: card.querySelector('.review-stage')?.textContent || '',
    name: card.querySelector('.review-person strong')?.childNodes[0]?.textContent || '',
    role: card.querySelector('.review-person small')?.textContent || '',
    text: card.querySelector('p')?.textContent || '',
    metric: card.querySelector('footer strong')?.textContent || '',
    metricLabel: card.querySelector('footer span')?.textContent || '',
    avatar: card.querySelector('.review-avatar')?.innerHTML || '',
  };
}

const reviewAvatarDefault = `
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 16.5C18.76 16.5 21 14.26 21 11.5C21 8.74 18.76 6.5 16 6.5C13.24 6.5 11 8.74 11 11.5C11 14.26 13.24 16.5 16 16.5Z" fill="#0E0E10" />
    <path d="M16 10.1C17.1 10.1 18 9.2 18 8.1C18 7 17.1 6.1 16 6.1C14.9 6.1 14 7 14 8.1C14 9.2 14.9 10.1 16 10.1Z" fill="#4475F2" />
    <path d="M5.5 28C5.5 22.73 9 20.1 16 20.1C23 20.1 26.5 22.73 26.5 28H5.5Z" fill="#0E0E10" />
  </svg>
`;

const reviewAvatarRing = `
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 16.5C18.76 16.5 21 14.26 21 11.5C21 8.74 18.76 6.5 16 6.5C13.24 6.5 11 8.74 11 11.5C11 14.26 13.24 16.5 16 16.5Z" fill="#0E0E10" />
    <path d="M16 10.1C17.1 10.1 18 9.2 18 8.1C18 7 17.1 6.1 16 6.1C14.9 6.1 14 7 14 8.1C14 9.2 14.9 10.1 16 10.1Z" fill="#0E0E10" stroke="#4475F2" stroke-width="2" />
    <path d="M5.5 28C5.5 22.73 9 20.1 16 20.1C23 20.1 26.5 22.73 26.5 28H5.5Z" fill="#0E0E10" />
  </svg>
`;

const reviewAvatarPlain = `
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 16.5C18.76 16.5 21 14.26 21 11.5C21 8.74 18.76 6.5 16 6.5C13.24 6.5 11 8.74 11 11.5C11 14.26 13.24 16.5 16 16.5Z" fill="#0E0E10" />
    <path d="M5.5 28C5.5 22.73 9 20.1 16 20.1C23 20.1 26.5 22.73 26.5 28H5.5Z" fill="#0E0E10" />
  </svg>
`;

const reviewsPages = [
  reviewCards.map(getReviewCardData),
  [
    {
      tag: 'SaaS',
      stage: 'Pre-Seed · $90K',
      name: 'Дмитрий О',
      role: 'CEO · SaaS B2B',
      text: 'Сервис автоматизации продаж для агентств. После спринта добрали 4 платящих команд, MRR вырос с $2K до $6K за два месяца.',
      metric: 'MRR $6K',
      metricLabel: 'доходность',
      avatar: reviewAvatarDefault,
    },
    {
      tag: 'Consumer',
      stage: 'Pre-Seed · $45K',
      name: 'Екатерина С',
      role: 'Founder · Mobile',
      text: 'Приложение для микро-привычек. За 14 дней собрали ядро из 2.3K юзеров, retention D30 - 16%, готовимся к раунду.',
      metric: '16% за месяц',
      metricLabel: 'удержание',
      avatar: reviewAvatarRing,
    },
    {
      tag: 'MarTech',
      stage: 'Pre-Seed · $70K',
      name: 'Артем Л',
      role: 'Founder · MarTech',
      text: 'Сервис атрибуции для performance-агентств. После спринта переписали оффер - закрыли 5 контрактов из холодной базы, средний чек $1K.',
      metric: 'ARR $60K',
      metricLabel: 'вырост',
      avatar: reviewAvatarDefault,
    },
    {
      tag: 'LegalTech',
      stage: 'Seed · $100K',
      name: 'Юлия М',
      role: 'CEO · LegalTech',
      text: 'AI-ассистент для юристов по корпоративному праву. Через два месяца после нас - MRR $8K и очередь из шести команд на подключение.',
      metric: 'MRR $8K',
      metricLabel: 'доходность',
      avatar: reviewAvatarPlain,
    },
  ],
];

const mobileReviews = [
  {
    initials: 'ИА',
    name: 'Иван А.',
    role: 'co-founder · fintech',
    text: 'За 14 дней спринта собрал MVP и закрыл первых трех клиентов. Менторы реально включаются в задачу, а не просто слушают.',
  },
  {
    initials: 'ДП',
    name: 'Денис П.',
    role: 'CEO · fintech',
    text: 'GPT, обученный на нашей CRM, делает 12 часов работы в неделю. Прошли путь от идеи до раунда за 4 месяца - менторы и шаблоны делают все.',
  },
  {
    initials: 'МЮ',
    name: 'Мария Ю.',
    role: 'CPO · edtech',
    text: 'AI-обучение школьников. NPS 78, четыре школы, поток рос на 30% MoM. Без Planka мы бы и customer dev толком не сделали.',
  },
  {
    initials: 'АР',
    name: 'Антон Р.',
    role: 'CTO · biotech',
    text: 'AI-диагностика по анализам. Шаблоны питча и менторинг по грантам сократили путь в два раза. Сейчас пилот в трех клиниках.',
  },
  {
    initials: 'ОК',
    name: 'Ольга К.',
    role: 'Founder · HealthTech',
    text: 'Mental-health трекер для подростков. За 30 дней спринта - 1300 активных, 4 школы партнеров, первый чек от ангела.',
  },
  {
    initials: 'ПД',
    name: 'Павел Д.',
    role: 'CEO · Climate',
    text: 'Платформа учета углеродного следа для SMB. Прошли KYC по грантам ЕС, закрыли раунд через знакомства из чата.',
  },
];

const desktopReviews = [
  {
    initials: 'ИА',
    name: 'Иван А.',
    role: 'co-founder · fintech',
    text: 'За 14 дней спринта собрал MVP и закрыл первых трех клиентов. Менторы реально включаются в задачу, а не просто слушают.',
  },
  {
    initials: 'ДП',
    name: 'Денис П.',
    role: 'CEO · fintech',
    text: 'GPT, обученный на нашей CRM, делает 12 часов работы в неделю. Прошли путь от идеи до раунда за 4 месяца - менторы и шаблоны делают все.',
  },
  {
    initials: 'АР',
    name: 'Антон Р.',
    role: 'CTO · biotech',
    text: 'AI-диагностика по анализам. Шаблоны питча и менторинг по грантам сократили путь в два раза. Сейчас пилот в трех клиниках.',
  },
  {
    initials: 'МЮ',
    name: 'Мария Ю.',
    role: 'CPO · edtech',
    text: 'AI-обучение школьников. NPS 78, четыре школы, поток рос на 30% MoM. Без Planka мы бы и customer dev толком не сделали.',
  },
  {
    initials: 'ОК',
    name: 'Ольга К.',
    role: 'founder · healthtech',
    text: 'Mental-health трекер для подростков. За 30 дней спринта - 1300 активных, 4 школы партнеров, первый чек от ангела',
  },
  {
    initials: 'ПД',
    name: 'Павел Д.',
    role: 'CEO · climate',
    text: 'Платформа учета углеродного следа для SMB. Прошли KYC по грантам ЕС, закрыли раунд через знакомства из чата',
  },
];

function renderReviewDots(count, activeIndex) {
  if (!reviewsDotsContainer) {
    return;
  }

  while (reviewsDotsContainer.children.length < count) {
    const dot = document.createElement('span');
    reviewsDotsContainer.appendChild(dot);
  }

  while (reviewsDotsContainer.children.length > count) {
    reviewsDotsContainer.lastElementChild?.remove();
  }

  Array.from(reviewsDotsContainer.children).forEach((dot, index) => {
    dot.classList.toggle('is-active', index === activeIndex);
    dot.setAttribute('role', 'button');
    dot.setAttribute('tabindex', '0');
    dot.setAttribute('aria-label', `Отзывы ${index + 1}`);
    dot.setAttribute('aria-current', index === activeIndex ? 'true' : 'false');
  });
}

function setReviewsPage(pageIndex) {
  if (!reviewsGrid || !reviewCards.length || !reviewsPages.length) {
    return;
  }

  if (mobileReviewsQuery.matches) {
    const normalizedIndex = (pageIndex + mobileReviews.length) % mobileReviews.length;
    const data = mobileReviews[normalizedIndex];
    const card = reviewCards[0];

    reviewCards.forEach((reviewCard, index) => {
      reviewCard.hidden = index !== 0;
    });

    if (card && data) {
      card.hidden = false;
      card.querySelector('.review-avatar')?.setAttribute('data-initials', data.initials);
      card.querySelector('.review-person strong').innerHTML = `${data.name}<br /><small>${data.role}</small>`;
      card.querySelector('p').textContent = data.text;
    }

    reviewsGrid.classList.remove('is-page-two');
    reviewsGrid.dataset.activeReview = String(normalizedIndex);
    reviewsGrid.dataset.mobileReview = String(normalizedIndex);
    renderReviewDots(mobileReviews.length, normalizedIndex);
    activeReviewsPage = normalizedIndex;
    return;
  }

  if (window.matchMedia('(min-width: 1181px)').matches) {
    const normalizedIndex = (pageIndex + desktopReviews.length) % desktopReviews.length;
    const data = desktopReviews[normalizedIndex];
    const card = reviewCards[0];

    reviewCards.forEach((card, index) => {
      card.hidden = index !== 0;
    });

    if (card && data) {
      const avatar = card.querySelector('.review-avatar');
      if (avatar) {
        avatar.setAttribute('data-initials', data.initials);
        avatar.innerHTML = '';
      }

      card.hidden = false;
      card.querySelector('.review-person strong').innerHTML = `${data.name}<br /><small>${data.role}</small>`;
      card.querySelector('p').textContent = data.text;
      card.querySelector('footer strong').textContent = '21 ДЕНЬ · СПРИНТ';
      card.querySelector('footer span').textContent = '';
    }

    reviewsGrid.classList.remove('is-page-two');
    reviewsGrid.dataset.activeReview = String(normalizedIndex);
    reviewsGrid.removeAttribute('data-mobile-review');
    renderReviewDots(desktopReviews.length, normalizedIndex);
    activeReviewsPage = normalizedIndex;
    return;
  }

  const normalizedIndex = (pageIndex + reviewsPages.length) % reviewsPages.length;
  const page = reviewsPages[normalizedIndex];

  reviewCards.forEach((card, index) => {
    const data = page[index];

    if (!data) {
      card.hidden = true;
      return;
    }

    card.hidden = false;
    card.querySelector('.review-tag').textContent = data.tag;
    card.querySelector('.review-stage').textContent = data.stage;
    card.querySelector('.review-avatar').innerHTML = data.avatar;
    card.querySelector('.review-person strong').innerHTML = `${data.name}<br /><small>${data.role}</small>`;
    card.querySelector('p').textContent = data.text;
    card.querySelector('footer strong').textContent = data.metric;
    card.querySelector('footer span').textContent = data.metricLabel;
  });

  reviewsGrid.classList.toggle('is-page-two', normalizedIndex === 1);
  reviewsGrid.dataset.activeReview = String(normalizedIndex);
  reviewsGrid.removeAttribute('data-mobile-review');
  renderReviewDots(reviewsPages.length, normalizedIndex);
  activeReviewsPage = normalizedIndex;
}

function shiftReviewsPage(direction) {
  setReviewsPage(activeReviewsPage + direction);
}

loginSubmit?.addEventListener('click', () => {
  showLoginError();
});

loginMagic?.addEventListener('click', () => {
  showMagicPanel();
});

codeLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    setLoginCodeMode(true);
    updateActivationCodeState();
    history.pushState(null, '', '#code');
  });
});

loginErrorCloseButtons.forEach((button) => button.addEventListener('click', () => {
  hideLoginError();
  loginSubmit?.focus({ preventScroll: true });
}));

loginErrorRegister?.addEventListener('click', () => {
  hideLoginError();
  openSignupFlow();
});

magicCloseButtons.forEach((button) => button.addEventListener('click', () => {
  hideMagicPanel();
  loginMagic?.focus({ preventScroll: true });
}));

magicRegisterButtons.forEach((button) => button.addEventListener('click', () => {
  hideMagicPanel();
  openSignupFlow();
}));

codeCloseButtons.forEach((button) => button.addEventListener('click', () => {
  setLoginMode(true, false);
}));

reviewArrows.forEach((button, index) => {
  button.addEventListener('click', () => {
    shiftReviewsPage(index === 0 ? -1 : 1);
  });
});

reviewDots.forEach((dot, index) => {
  dot.setAttribute('role', 'button');
  dot.setAttribute('tabindex', '0');
  dot.setAttribute('aria-label', `Отзывы ${index + 1}`);

  dot.addEventListener('click', () => {
    setReviewsPage(index);
  });

  dot.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    setReviewsPage(index);
  });
});

reviewsDotsContainer?.addEventListener('click', (event) => {
  const dot = event.target.closest('span');

  if (!dot || !reviewsDotsContainer.contains(dot)) {
    return;
  }

  setReviewsPage(Array.from(reviewsDotsContainer.children).indexOf(dot));
});

reviewsDotsContainer?.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  const dot = event.target.closest('span');

  if (!dot || !reviewsDotsContainer.contains(dot)) {
    return;
  }

  event.preventDefault();
  setReviewsPage(Array.from(reviewsDotsContainer.children).indexOf(dot));
});

mobileReviewsQuery.addEventListener?.('change', () => {
  setReviewsPage(0);
});

setReviewsPage(0);

codeInputs.forEach((input, index) => {
  input.addEventListener('input', () => {
    input.value = input.value.slice(-1).toUpperCase();
    updateActivationCodeState();

    if (input.value && codeInputs[index + 1]) {
      codeInputs[index + 1].focus();
    }
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Backspace' && !input.value && codeInputs[index - 1]) {
      codeInputs[index - 1].focus();
    }
  });
});

updateSignupActions();
updateActivationCodeState();
trackUtmLandingVisit();
setReviewsPage(0);
initScrollReveals();
renderCommunityCounter();
refreshCommunityCounter();
updatePabloCountdown();
if (pabloCountdown && !pabloCard?.classList.contains('is-countdown-ended')) {
  pabloCountdownTimer = window.setInterval(updatePabloCountdown, 1000);
}
updateQuestLayout();
