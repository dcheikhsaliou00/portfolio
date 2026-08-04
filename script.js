/* ============================================================
   PORTFOLIO — SCRIPT PRINCIPAL
   Organisation : chaque fonctionnalité est isolée dans sa propre
   fonction, appelée en bas du fichier. Aucune dépendance externe.
   ============================================================ */

'use strict';

/* Préférence système « réduire les animations ».
   On la lit une seule fois et on l'utilise partout pour
   désactiver les effets non essentiels. */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============================================================
   1. THÈME CLAIR / SOMBRE
   Le thème initial est déjà posé sur <html> par le script inline
   du <head> (anti-flash). Ici on gère seulement la bascule et
   la mémorisation dans localStorage.
   ============================================================ */

function initTheme() {
    const toggle = document.querySelector('.theme-toggle');
    if (!toggle) return;

    const syncButton = () => {
        const isLight = document.documentElement.dataset.theme === 'light';
        toggle.setAttribute('aria-pressed', isLight ? 'true' : 'false');
        toggle.setAttribute('aria-label', isLight ? 'Basculer en thème sombre' : 'Basculer en thème clair');

        // Met à jour la couleur de la barre du navigateur sur mobile
        const meta = document.querySelector('meta[name="theme-color"]:not([media])');
        if (meta) meta.setAttribute('content', isLight ? '#ffffff' : '#0b0b10');
    };

    toggle.addEventListener('click', () => {
        const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
        document.documentElement.dataset.theme = next;
        try {
            localStorage.setItem('theme', next);
        } catch (e) {
            /* Mode navigation privée : on ignore, le thème reste actif
               pour la session en cours. */
        }
        syncButton();
    });

    syncButton();
}

/* ============================================================
   2. MENU MOBILE
   Ouverture / fermeture avec gestion complète du clavier :
   - Échap ferme le menu et rend le focus au bouton
   - un clic à l'extérieur ferme le menu
   - le défilement de la page est bloqué quand le menu est ouvert
   ============================================================ */

function initMobileNav() {
    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');
    if (!navToggle || !navLinks) return;

    const setOpen = (open) => {
        navLinks.classList.toggle('open', open);
        navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        navToggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
        document.body.classList.toggle('nav-open', open);
    };

    const close = ({ refocus = false } = {}) => {
        if (!navLinks.classList.contains('open')) return;
        setOpen(false);
        if (refocus) navToggle.focus();
    };

    navToggle.addEventListener('click', () => {
        setOpen(!navLinks.classList.contains('open'));
    });

    // Fermer après un clic sur un lien de navigation
    navLinks.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => close());
    });

    // Échap ferme le menu
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') close({ refocus: true });
    });

    // Clic en dehors de la navbar
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.navbar')) close();
    });

    // Si on repasse en affichage desktop, on réinitialise l'état
    window.matchMedia('(min-width: 993px)').addEventListener('change', (event) => {
        if (event.matches) setOpen(false);
    });
}

/* ============================================================
   3. EFFETS LIÉS AU DÉFILEMENT
   Barre de progression, navbar compacte et bouton « retour en
   haut » partagent UN SEUL écouteur de scroll, throttlé avec
   requestAnimationFrame pour ne pas saturer le thread principal.
   ============================================================ */

function initScrollEffects() {
    const progressBar = document.querySelector('.scroll-progress span');
    const navbar = document.querySelector('.navbar');
    const backToTop = document.querySelector('.back-to-top');
    let ticking = false;

    const update = () => {
        const scrollTop = window.scrollY;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

        if (progressBar) {
            // Math.min évite un dépassement de 100 % dû aux arrondis
            // sous-pixels (scroll élastique sur mobile notamment).
            const ratio = maxScroll > 0 ? Math.min((scrollTop / maxScroll) * 100, 100) : 0;
            progressBar.style.width = ratio + '%';
        }

        if (navbar) {
            navbar.classList.toggle('is-scrolled', scrollTop > 20);
        }

        if (backToTop) {
            backToTop.classList.toggle('visible', scrollTop > 300);
        }

        ticking = false;
    };

    window.addEventListener('scroll', () => {
        if (!ticking) {
            ticking = true;
            window.requestAnimationFrame(update);
        }
    }, { passive: true });

    if (backToTop) {
        backToTop.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: prefersReducedMotion ? 'auto' : 'smooth',
            });
        });
    }

    update();
}

/* ============================================================
   4. APPARITION PROGRESSIVE AU SCROLL
   Les éléments marqués [data-animate] apparaissent en fondu
   lorsqu'ils entrent dans le viewport.
   ============================================================ */

function initScrollAnimations() {
    const elements = document.querySelectorAll('[data-animate]');
    if (!elements.length) return;

    // Mouvement réduit ou navigateur ancien : on affiche tout directement
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
        elements.forEach((el) => el.classList.add('visible'));
        return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('visible');
            obs.unobserve(entry.target); // une seule fois par élément
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    elements.forEach((el) => {
        el.classList.add('fade-in');
        observer.observe(el);
    });
}

/* ============================================================
   5. SCROLLSPY — LIEN DE NAVIGATION ACTIF
   Marque d'un aria-current="page" le lien correspondant à la
   section actuellement visible à l'écran.
   ============================================================ */

function initScrollSpy() {
    const links = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;

    const sections = links
        .map((link) => document.querySelector(link.getAttribute('href')))
        .filter(Boolean);

    const setActive = (id) => {
        links.forEach((link) => {
            if (link.getAttribute('href') === '#' + id) {
                link.setAttribute('aria-current', 'page');
            } else {
                link.removeAttribute('aria-current');
            }
        });
    };

    const observer = new IntersectionObserver((entries) => {
        // On retient la section la plus visible parmi celles à l'écran
        const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible) setActive(visible.target.id);
    }, {
        // La zone d'observation exclut la navbar en haut
        rootMargin: '-45% 0px -45% 0px',
        threshold: 0,
    });

    sections.forEach((section) => observer.observe(section));
}

/* ============================================================
   6. COMPTEURS ANIMÉS (chiffres clés)
   Les valeurs portant data-count montent de 0 jusqu'à la valeur
   cible quand le bandeau entre à l'écran.
   ============================================================ */

function initCounters() {
    const counters = document.querySelectorAll('[data-count]');
    if (!counters.length) return;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) return; // valeurs déjà dans le HTML

    const animate = (el) => {
        const target = Number(el.dataset.count);
        const suffix = el.dataset.suffix || '';
        const duration = 1200;
        const start = performance.now();

        const step = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            // Courbe d'accélération « ease-out » pour un rendu naturel
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(target * eased) + suffix;
            if (progress < 1) requestAnimationFrame(step);
        };

        requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            animate(entry.target);
            obs.unobserve(entry.target);
        });
    }, { threshold: 0.6 });

    counters.forEach((el) => observer.observe(el));
}

/* ============================================================
   7. EFFET MACHINE À ÉCRIRE (titre du hero)
   Le texte de repli est déjà dans le HTML (bon pour le SEO et
   pour les utilisateurs sans JS) ; on ne l'anime que si les
   animations sont autorisées.
   ============================================================ */

function initTypingEffect() {
    const element = document.querySelector('[data-typed]');
    if (!element || prefersReducedMotion) return;

    const phrases = element.dataset.typed.split('|').map((s) => s.trim()).filter(Boolean);
    if (phrases.length < 2) return;

    const textNode = document.createElement('span');
    const caret = document.createElement('span');
    caret.className = 'caret';

    element.textContent = '';
    element.append(textNode, caret);

    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;

    const tick = () => {
        const phrase = phrases[phraseIndex];
        charIndex += deleting ? -1 : 1;
        textNode.textContent = phrase.slice(0, charIndex);

        let delay = deleting ? 40 : 75;

        if (!deleting && charIndex === phrase.length) {
            delay = 2200;          // pause une fois la phrase écrite
            deleting = true;
        } else if (deleting && charIndex === 0) {
            deleting = false;
            phraseIndex = (phraseIndex + 1) % phrases.length;
            delay = 400;
        }

        setTimeout(tick, delay);
    };

    setTimeout(tick, 1200);
}

/* ============================================================
   8. FILTRES DE PROJETS
   Affiche uniquement les cartes dont data-category correspond
   au filtre sélectionné.
   ============================================================ */

function initProjectFilters() {
    const filters = document.querySelectorAll('.filter');
    const cards = document.querySelectorAll('.project-card');
    const emptyMessage = document.querySelector('.no-result');
    if (!filters.length || !cards.length) return;

    filters.forEach((button) => {
        button.addEventListener('click', () => {
            const value = button.dataset.filter;

            filters.forEach((other) => {
                const active = other === button;
                other.classList.toggle('is-active', active);
                other.setAttribute('aria-pressed', active ? 'true' : 'false');
            });

            let visibleCount = 0;
            cards.forEach((card) => {
                const match = value === 'all' || card.dataset.category === value;
                card.classList.toggle('is-hidden', !match);
                if (match) visibleCount += 1;
            });

            if (emptyMessage) emptyMessage.hidden = visibleCount > 0;
        });
    });
}

/* ============================================================
   9. BOUTONS « COPIER »
   Copie la valeur de data-copy dans le presse-papiers et
   confirme visuellement pendant 2 secondes.
   ============================================================ */

function initCopyButtons() {
    document.querySelectorAll('[data-copy]').forEach((button) => {
        button.addEventListener('click', async () => {
            const original = button.textContent;
            try {
                await navigator.clipboard.writeText(button.dataset.copy);
                button.textContent = 'Copié !';
                button.classList.add('is-copied');
            } catch (e) {
                // navigator.clipboard nécessite HTTPS ou localhost
                button.textContent = 'Échec';
            }
            setTimeout(() => {
                button.textContent = original;
                button.classList.remove('is-copied');
            }, 2000);
        });
    });
}

/* ============================================================
   10. FORMULAIRE DE CONTACT
   - validation champ par champ avec messages en français
   - piège anti-spam (honeypot)
   - envoi AJAX si un endpoint est configuré, sinon ouverture
     du client mail avec un message pré-rempli
   ============================================================ */

function initContactForm() {
    const form = document.querySelector('.contact-form');
    if (!form) return;

    const status = form.querySelector('.form-status');
    const submitBtn = form.querySelector('button[type="submit"]');
    const messageField = form.querySelector('#message');
    const charCount = form.querySelector('#message-count');
    const EMAIL_TO = 'dcheikhsaliou@gmail.com';

    /* ---- Compteur de caractères du message ---- */
    if (messageField && charCount) {
        const maxLength = messageField.getAttribute('maxlength') || 1000;
        const updateCount = () => {
            charCount.textContent = `${messageField.value.length} / ${maxLength}`;
        };
        messageField.addEventListener('input', updateCount);
        updateCount();
    }

    /* ---- Validation d'un champ ---- */
    const validateField = (field) => {
        const errorBox = form.querySelector(`#${field.id}-error`);
        let message = '';

        const value = field.value.trim();

        if (field.hasAttribute('required') && !value) {
            message = 'Ce champ est obligatoire.';
        } else if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
            message = 'Merci de saisir une adresse email valide.';
        } else if (field.minLength > 0 && value && value.length < field.minLength) {
            message = `Minimum ${field.minLength} caractères (actuellement ${value.length}).`;
        }

        field.setAttribute('aria-invalid', message ? 'true' : 'false');
        if (errorBox) errorBox.textContent = message;
        return !message;
    };

    // Validation à la sortie du champ, puis en direct une fois corrigé
    form.querySelectorAll('input[required], textarea[required], input[type="email"]').forEach((field) => {
        field.addEventListener('blur', () => validateField(field));
        field.addEventListener('input', () => {
            if (field.getAttribute('aria-invalid') === 'true') validateField(field);
        });
    });

    const setStatus = (text, type) => {
        if (!status) return;
        status.textContent = text;
        status.classList.remove('is-success', 'is-error');
        if (type) status.classList.add(type);
    };

    /* ---- Soumission ---- */
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        // Piège anti-spam : si ce champ caché est rempli, c'est un robot.
        if (form.querySelector('#website') && form.querySelector('#website').value) {
            setStatus('Message envoyé. Merci !', 'is-success');
            form.reset();
            return;
        }

        const fields = Array.from(form.querySelectorAll('input[required], textarea[required]'));
        const isValid = fields.map(validateField).every(Boolean);

        if (!isValid) {
            setStatus('Merci de corriger les champs signalés avant l\'envoi.', 'is-error');
            const firstInvalid = fields.find((f) => f.getAttribute('aria-invalid') === 'true');
            if (firstInvalid) firstInvalid.focus();
            return;
        }

        const data = {
            name: form.name.value.trim(),
            email: form.email.value.trim(),
            subject: form.subject.value.trim() || `Message de ${form.name.value.trim()} via le portfolio`,
            message: form.message.value.trim(),
        };

        /* Cas 1 : un service tiers est configuré (Formspree, etc.).
           Ajoute action="https://formspree.io/f/xxxx" et
           data-endpoint="true" sur le <form> pour l'activer. */
        if (form.dataset.endpoint === 'true' && form.action) {
            submitBtn.disabled = true;
            setStatus('Envoi en cours…', null);
            try {
                const response = await fetch(form.action, {
                    method: 'POST',
                    headers: { Accept: 'application/json' },
                    body: new FormData(form),
                });
                if (!response.ok) throw new Error('Réponse ' + response.status);
                setStatus('Merci ! Votre message a bien été envoyé.', 'is-success');
                form.reset();
                if (charCount) charCount.textContent = '0 / 1000';
            } catch (error) {
                setStatus('L\'envoi a échoué. Écrivez-moi directement à ' + EMAIL_TO + '.', 'is-error');
            } finally {
                submitBtn.disabled = false;
            }
            return;
        }

        /* Cas 2 (par défaut) : ouverture du client mail avec un
           message pré-rempli. encodeURIComponent protège les
           accents, sauts de ligne et caractères spéciaux. */
        const body = `Nom : ${data.name}\nEmail : ${data.email}\n\n${data.message}`;
        const mailto = `mailto:${EMAIL_TO}`
            + `?subject=${encodeURIComponent(data.subject)}`
            + `&body=${encodeURIComponent(body)}`;

        window.location.href = mailto;
        setStatus('Votre logiciel de messagerie va s\'ouvrir avec le message pré-rempli. '
            + 'S\'il ne s\'ouvre pas, écrivez-moi à ' + EMAIL_TO + '.', 'is-success');
    });
}

/* ============================================================
   11. ANNÉE DYNAMIQUE DANS LE FOOTER
   ============================================================ */

function initFooterYear() {
    const yearSpan = document.getElementById('year');
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();
}

/* ============================================================
   INITIALISATION
   Le script est chargé avec defer : le DOM est donc déjà prêt.
   ============================================================ */

initTheme();
initMobileNav();
initScrollEffects();
initScrollAnimations();
initScrollSpy();
initCounters();
initTypingEffect();
initProjectFilters();
initCopyButtons();
initContactForm();
initFooterYear();
