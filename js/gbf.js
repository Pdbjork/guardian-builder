// Guardian Builder Foundation — small progressive enhancements.
// Mobile menu toggle + graceful interest form submission.
(function () {
  'use strict';

  // Mobile menu -----------------------------------------------------------
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      const isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  // Interest form ---------------------------------------------------------
  // Posts to /api/interest (matches live Vercel endpoint) with JSON.
  // Falls back to a /interest form POST if the API is unavailable, so the
  // VPS express capture service can also accept it.
  const form = document.querySelector('#interest-form');
  if (!form) return;

  const status = form.querySelector('#interest-status');
  const submitBtn = form.querySelector('button[type="submit"]');

  function setStatus(text, kind) {
    if (!status) return;
    status.textContent = text;
    status.className = 'form-status' + (kind ? ' ' + kind : '');
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (submitBtn) submitBtn.disabled = true;
    setStatus('Submitting…', 'loading');

    const data = new FormData(form);
    const payload = {
      website: data.get('website') || '',
      name: (data.get('name') || '').toString().trim(),
      email: (data.get('email') || '').toString().trim(),
      organization: (data.get('organization') || '').toString().trim(),
      role: (data.get('role') || '').toString().trim(),
      interestAreas: data.getAll('interestAreas'),
      message: (data.get('message') || '').toString().trim(),
      consentToContact: data.get('consentToContact') === 'on',
      source: 'guardianbuilder.org/' + (location.pathname.replace(/^\/|\/$/g, '') || 'home')
    };

    // Honeypot: silently "succeed" without sending.
    if (payload.website) {
      setStatus('Thank you. Your interest has been recorded.', 'success');
      form.reset();
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    if (!payload.email || !payload.consentToContact) {
      setStatus('Please provide your email and confirm consent to contact.', 'error');
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    try {
      const response = await fetch('/api/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(function () { return {}; });
      if (response.ok && (result.ok || result.id || result.message)) {
        setStatus(result.message || 'Thank you. Your interest has been recorded.', 'success');
        form.reset();
      } else {
        throw new Error((result && result.error) || 'Submission failed. Please try again.');
      }
    } catch (err) {
      // Fallback: try the VPS /interest route
      try {
        const fallback = await fetch('/interest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (fallback.ok) {
          setStatus('Thank you. Your interest has been recorded.', 'success');
          form.reset();
        } else {
          setStatus(err.message || 'Submission failed. Please email admin@guardianbuilder.org.', 'error');
        }
      } catch (err2) {
        setStatus('Could not reach the form endpoint. Please email admin@guardianbuilder.org.', 'error');
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
})();
