(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Highlight the current page in navigation.
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.site-nav a, .mobile-nav__panel a:not(.button)').forEach((link) => {
    const target = new URL(link.href, window.location.origin).pathname.replace(/\/$/, '') || '/';
    if (target === currentPath || (target !== '/' && currentPath.startsWith(`${target}/`))) link.setAttribute('aria-current', 'page');
  });

  // Header shadow once the page scrolls.
  const header = document.querySelector('[data-header]');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Mobile menu: close on link click, Escape, outside click, or resize to desktop.
  const mobileNav = document.querySelector('[data-mobile-nav]');
  if (mobileNav) {
    const close = () => mobileNav.removeAttribute('open');
    mobileNav.addEventListener('toggle', () => document.body.classList.toggle('nav-open', mobileNav.open));
    mobileNav.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mobileNav.open) { close(); mobileNav.querySelector('summary')?.focus(); } });
    document.addEventListener('click', (e) => { if (mobileNav.open && !mobileNav.contains(e.target)) close(); });
    window.matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches) close(); });
  }

  // Gentle reveal-on-scroll. Content stays visible without JS or with reduced motion.
  const revealItems = document.querySelectorAll('[data-reveal]');
  if (!reduceMotion && 'IntersectionObserver' in window && revealItems.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealItems.forEach((el, i) => {
      el.style.setProperty('--reveal-delay', `${(i % 4) * 70}ms`);
      el.classList.add('will-reveal');
      observer.observe(el);
    });
  } else {
    revealItems.forEach((el) => el.classList.add('is-visible'));
  }

  // Consultation form.
  const form = document.querySelector('#consultation-form');
  if (!form) return;
  const result = document.querySelector('#form-result');
  const submit = document.querySelector('#form-submit');
  const originalLabel = submit.innerHTML;
  const fileInput = form.querySelector('#attachment');
  const fileLabel = form.querySelector('[data-file-label]');
  const defaultFileLabel = fileLabel?.textContent ?? '';
  const drop = form.querySelector('.file-drop');

  const showError = (message) => {
    const box = document.createElement('div');
    box.className = 'form-status form-status--error';
    box.setAttribute('role', 'alert');
    box.textContent = message;
    result.replaceChildren(box);
  };

  const updateFileLabel = () => {
    const file = fileInput?.files?.[0];
    if (!fileLabel) return;
    fileLabel.textContent = file ? `${file.name} · ${(file.size / 1048576).toFixed(1)} MB` : defaultFileLabel;
    drop?.classList.toggle('has-file', Boolean(file));
  };

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const max = Number(fileInput.dataset.maxBytes || 0);
      const file = fileInput.files?.[0];
      if (file && max && file.size > max) {
        fileInput.value = '';
        showError(`That file is too large. Please choose a file under ${Math.round(max / 1048576)} MB.`);
      }
      updateFileLabel();
    });
    if (drop) {
      ['dragenter', 'dragover'].forEach((type) => drop.addEventListener(type, (e) => { e.preventDefault(); drop.classList.add('is-dragging'); }));
      ['dragleave', 'drop'].forEach((type) => drop.addEventListener(type, (e) => { e.preventDefault(); drop.classList.remove('is-dragging'); }));
      drop.addEventListener('drop', (e) => {
        if (!e.dataTransfer?.files?.length) return;
        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event('change'));
      });
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    result.replaceChildren();
    submit.disabled = true;
    submit.textContent = 'Sending…';
    form.setAttribute('aria-busy', 'true');

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'fetch', Accept: 'text/html' },
      });
      const markup = await response.text();
      // The API returns a small, server-escaped status fragment.
      result.innerHTML = markup;
      const success = response.ok && markup.includes('form-status--success');
      if (success) { form.reset(); updateFileLabel(); }
      result.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    } catch {
      showError('We could not send your request just now. Please try again, or contact us by phone or WhatsApp.');
    } finally {
      submit.disabled = false;
      submit.innerHTML = originalLabel;
      form.removeAttribute('aria-busy');
    }
  });
})();
