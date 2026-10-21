(function () {
  'use strict';

  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var mqFine = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : null;

  function prefersReduced() {
    return !!(mqReduce && mqReduce.matches);
  }

  function each(list, fn) {
    Array.prototype.forEach.call(list, fn);
  }

  function on(el, type, fn, opts) {
    if (el) el.addEventListener(type, fn, opts);
  }

  /* Shared scroll lock: released only when neither layer is open. */
  var scrollLocks = 0;

  function lockScroll() {
    scrollLocks++;
    if (scrollLocks === 1) document.body.style.overflow = 'hidden';
  }

  function unlockScroll() {
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks === 0) document.body.style.overflow = '';
  }

  /* ---------- 1 · Sticky header ---------- */
  var header = document.querySelector('.site-header');

  if (header) {
    var headerTicking = false;

    var updateHeader = function () {
      var stuck = window.scrollY > 20;
      if (stuck !== header.classList.contains('is-stuck')) {
        header.classList.toggle('is-stuck', stuck);
      }
      headerTicking = false;
    };

    var onHeaderScroll = function () {
      if (headerTicking) return;
      headerTicking = true;
      window.requestAnimationFrame(updateHeader);
    };

    window.addEventListener('scroll', onHeaderScroll, { passive: true });
    updateHeader();
  }

  /* ---------- 2 · Scroll reveal ---------- */
  var revealEls = document.querySelectorAll('.reveal');

  each(revealEls, function (el) {
    var delay = parseInt(el.getAttribute('data-delay'), 10);
    if (!isNaN(delay) && delay > 0) {
      el.style.transitionDelay = (delay * 100) + 'ms';
    }
  });

  if (revealEls.length) {
    if (prefersReduced() || !('IntersectionObserver' in window)) {
      each(revealEls, function (el) { el.classList.add('is-in'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

      each(revealEls, function (el) { io.observe(el); });

      /* Safety net: nothing may stay invisible if the observer misfires. */
      setTimeout(function () {
        each(revealEls, function (el) {
          if (!el.classList.contains('is-in')) el.classList.add('is-in');
        });
      }, 4000);
    }
  }

  /* ---------- 3 · Mobile drawer ---------- */
  var menuBtn = document.querySelector('.menu-btn');
  var drawer = document.getElementById('drawer');
  var drawerClose = document.getElementById('drawerClose');
  var drawerOpen = false;

  function openDrawer() {
    if (!drawer || drawerOpen) return;
    drawerOpen = true;
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
    lockScroll();
    if (drawerClose) drawerClose.focus();
  }

  function closeDrawer(returnFocus) {
    if (!drawer || !drawerOpen) return;
    drawerOpen = false;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', 'false');
      if (returnFocus !== false) menuBtn.focus();
    }
    unlockScroll();
  }

  if (menuBtn && drawer) {
    on(menuBtn, 'click', function () {
      if (drawerOpen) closeDrawer(); else openDrawer();
    });
  }
  on(drawerClose, 'click', function () { closeDrawer(); });

  if (drawer) {
    on(drawer, 'click', function (e) {
      if (e.target === drawer) closeDrawer();
    });
    each(drawer.querySelectorAll('a'), function (a) {
      on(a, 'click', function () { closeDrawer(false); });
    });
  }

  /* ---------- 4 · Lightbox ---------- */
  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightboxImg');
  var lightboxClose = document.getElementById('lightboxClose');
  var lightboxOpen = false;
  var lastTrigger = null;

  function closeLightbox() {
    if (!lightbox || !lightboxOpen) return;
    lightboxOpen = false;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    unlockScroll();
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
    lastTrigger = null;
  }

  function openLightbox(trigger) {
    if (!lightbox || !lightboxImg) return;
    var src = trigger.getAttribute('data-lightbox');
    if (!src) return;

    lightboxImg.setAttribute('src', src);
    lightboxImg.setAttribute('alt', trigger.getAttribute('data-alt') || '');
    lastTrigger = trigger;

    if (!lightboxOpen) {
      lightboxOpen = true;
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      lockScroll();
    }
    if (lightboxClose) lightboxClose.focus();
  }

  if (lightbox && lightboxImg) {
    each(document.querySelectorAll('[data-lightbox]'), function (trigger) {
      on(trigger, 'click', function (e) {
        e.preventDefault();
        openLightbox(trigger);
      });
      on(trigger, 'keydown', function (e) {
        var key = e.key || e.keyCode;
        if (key === 'Enter' || key === ' ' || key === 'Spacebar' || key === 13 || key === 32) {
          e.preventDefault();
          openLightbox(trigger);
        }
      });
    });

    on(lightboxClose, 'click', closeLightbox);

    on(lightbox, 'click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
  }

  /* Escape closes the topmost layer: lightbox first, then the drawer. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' && e.keyCode !== 27) return;
    if (lightboxOpen) {
      closeLightbox();
    } else if (drawerOpen) {
      closeDrawer();
    }
  });

  /* ---------- 5 · Contact form ---------- */
  var form = document.getElementById('formSolicitud');

  if (form) {
    var ENDPOINT = form.getAttribute('action') || '';
    var statusEl = document.getElementById('formStatus');
    var errorEl = document.getElementById('formError');
    var submitBtn = form.querySelector('[data-fs-submit-btn]') || form.querySelector('[type="submit"]');
    var submitLabel = submitBtn ? submitBtn.textContent : 'Enviar solicitud';
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    var fields = Array.prototype.slice.call(form.querySelectorAll('[data-fs-field]'));

    function errorNode(field) {
      if (!field.id) return null;
      return document.getElementById(field.id + '-error');
    }

    function setError(field, message) {
      var node = errorNode(field);
      if (node) node.textContent = message || '';
      if (message) {
        field.setAttribute('aria-invalid', 'true');
      } else {
        field.removeAttribute('aria-invalid');
      }
    }

    function clearStatus() {
      if (statusEl) { statusEl.textContent = ''; statusEl.style.color = ''; }
      if (errorEl) { errorEl.textContent = ''; errorEl.style.color = ''; }
    }

    function showError(message) {
      if (!errorEl) return;
      errorEl.textContent = message;
      errorEl.style.color = '#FF6B85';
    }

    function validateField(field) {
      var raw = field.value;
      var value = (raw || '').replace(/^\s+|\s+$/g, '');

      if (field.type === 'checkbox') {
        if (field.hasAttribute('required') && !field.checked) {
          setError(field, 'Debes confirmar este punto para continuar.');
          return false;
        }
        setError(field, '');
        return true;
      }

      if (field.hasAttribute('required') && !value) {
        setError(field, 'Este campo es obligatorio.');
        return false;
      }

      if (field.type === 'email' && value && !EMAIL_RE.test(value)) {
        setError(field, 'Introduce un correo válido.');
        return false;
      }

      if (field.type === 'number' && value !== '') {
        var n = parseInt(value, 10);
        var min = parseInt(field.getAttribute('min') || '0', 10);
        var max = parseInt(field.getAttribute('max') || '999', 10);
        if (isNaN(n) || n < min || n > max) {
          setError(field, 'Debe estar entre ' + min + ' y ' + max + '.');
          return false;
        }
      }

      if (field.tagName === 'TEXTAREA' && value !== '' && value.length < 20) {
        setError(field, 'Escribe al menos 20 caracteres.');
        return false;
      }

      setError(field, '');
      return true;
    }

    each(fields, function (field) {
      on(field, 'blur', function () { validateField(field); });
      on(field, 'input', function () {
        if (field.getAttribute('aria-invalid') === 'true') validateField(field);
        clearStatus();
      });
      if (field.tagName === 'SELECT' || field.type === 'checkbox') {
        on(field, 'change', function () { validateField(field); });
      }
    });

    function applyServerErrors(payload) {
      var mapped = false;

      if (payload && Object.prototype.toString.call(payload.errors) === '[object Array]') {
        payload.errors.forEach(function (err) {
          var names = (err.field || '').split(',');
          names.forEach(function (name) {
            var target = form.querySelector('[name="' + name.replace(/^\s+|\s+$/g, '') + '"]');
            if (target && errorNode(target)) {
              setError(target, err.message || 'Valor no válido.');
              mapped = true;
            }
          });
        });
      }

      if (!mapped) {
        showError('No se pudo enviar la solicitud. Revisa los datos e inténtalo de nuevo.');
      }
    }

    function setSending(sending) {
      if (!submitBtn) return;
      submitBtn.disabled = sending;
      submitBtn.textContent = sending ? 'Enviando…' : submitLabel;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearStatus();

      var honey = form.querySelector('[name="_gotcha"]');
      if (honey && honey.value) return;

      var firstInvalid = null;
      each(fields, function (field) {
        if (!validateField(field) && !firstInvalid) firstInvalid = field;
      });

      if (firstInvalid) {
        showError('Revisa los campos marcados antes de enviar.');
        firstInvalid.focus();
        return;
      }

      if (!ENDPOINT) {
        showError('El formulario no tiene un destino configurado.');
        return;
      }

      setSending(true);

      fetch(ENDPOINT, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      })
        .then(function (res) {
          return res.json()
            .catch(function () { return {}; })
            .then(function (payload) {
              if (res.ok) return payload;
              var err = new Error('Formspree ' + res.status);
              err.payload = payload;
              throw err;
            });
        })
        .then(function () {
          if (statusEl) {
            statusEl.textContent = 'Solicitud recibida. Si hay afinidad, recibirás respuesta.';
            statusEl.style.color = '#9C9792';
          }
          form.reset();
          each(fields, function (f) { setError(f, ''); });
          setSending(false);
          if (fields[0]) fields[0].focus();
        })
        .catch(function (err) {
          applyServerErrors(err && err.payload);
          setSending(false);
        });
    });
  }

  /* ---------- 6 · Dynamic year ---------- */
  each(document.querySelectorAll('[data-year]'), function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------- 7 · Active navigation ---------- */
  var currentPage = window.location.pathname.split('/').pop() || 'index.html';

  each(document.querySelectorAll('.nav a, .drawer-nav a'), function (a) {
    var href = (a.getAttribute('href') || '').split('#')[0];
    if (href && href === currentPage) {
      a.setAttribute('aria-current', 'page');
    }
  });

  /* ---------- 8 · Gallery parallax ---------- */
  var parallaxItems = [];

  if (!prefersReduced() && mqFine && mqFine.matches) {
    parallaxItems = Array.prototype.slice.call(document.querySelectorAll('.parallax'));

    if (parallaxItems.length) {
      each(parallaxItems, function (box) { box.classList.add('is-parallax'); });

      var parallaxTicking = false;

      var updateParallax = function () {
        var vh = window.innerHeight;

        parallaxItems.forEach(function (box) {
          var rect = box.getBoundingClientRect();

          if (rect.bottom < -200 || rect.top > vh + 200) return;

          var progress = (rect.top + rect.height / 2 - vh / 2) / (vh / 2 + rect.height / 2);
          box.style.setProperty('--py', (progress * -42).toFixed(1) + 'px');
        });

        parallaxTicking = false;
      };

      var requestParallax = function () {
        if (parallaxTicking) return;
        parallaxTicking = true;
        window.requestAnimationFrame(updateParallax);
      };

      window.addEventListener('scroll', requestParallax, { passive: true });
      window.addEventListener('resize', requestParallax, { passive: true });
      updateParallax();
    }
  }
})();
