const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
document.querySelectorAll('.site-nav a, .mobile-nav__panel a').forEach((link) => {
  const target = new URL(link.href, window.location.origin).pathname.replace(/\/$/, '') || '/';
  if (target !== '/' && (currentPath === target || currentPath.startsWith(`${target}/`))) {
    link.setAttribute('aria-current', 'page');
  } else if (target === currentPath) {
    link.setAttribute('aria-current', 'page');
  }
});

const form = document.querySelector('#consultation-form');
if (form) {
  const result = document.querySelector('#form-result');
  const submit = document.querySelector('#form-submit');
  const originalLabel = submit.textContent;

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
      result.innerHTML = markup;
      const success = response.ok && markup.includes('form-status--success');
      if (success) form.reset();
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      result.scrollIntoView({ behavior, block: 'nearest' });
    } catch {
      result.innerHTML = '<div class="form-status form-status--error" role="alert">We could not send your request just now. Please try again or contact us by phone or email.</div>';
    } finally {
      submit.disabled = false;
      submit.textContent = originalLabel;
      form.removeAttribute('aria-busy');
    }
  });
}
