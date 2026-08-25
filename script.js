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
   du <head> (anti-flash). Ici on gère la bascule, la mémorisation
   et — sur les navigateurs compatibles — une révélation en cercle
   partant du bouton, via la View Transitions API.
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

    const appliquer = () => {
        const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
        document.documentElement.dataset.theme = next;
        try {
            localStorage.setItem('theme', next);
        } catch (e) {
            /* Mode navigation privée : on ignore, le thème reste actif
               pour la session en cours. */
        }
        syncButton();
    };

    toggle.addEventListener('click', () => {
        const transitionsSupportees =
            typeof document.startViewTransition === 'function' && !prefersReducedMotion;

        if (!transitionsSupportees) {
            appliquer(); // bascule instantanée, aucun message d'erreur
            return;
        }

        // Le cercle part du centre du bouton : la révélation semble
        // émaner du geste de l'utilisateur.
        const rect = toggle.getBoundingClientRect();
        const cx = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
        const cy = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
        document.documentElement.style.setProperty('--tx', cx.toFixed(1) + '%');
        document.documentElement.style.setProperty('--ty', cy.toFixed(1) + '%');

        document.startViewTransition(appliquer);
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
   Barre de progression, navbar compacte, bouton « retour en
   haut », parallaxe du portrait et tracé de la timeline
   partagent UN SEUL écouteur de scroll, throttlé avec
   requestAnimationFrame.

   Pourquoi un seul : chaque écouteur de scroll supplémentaire
   s'exécute à chaque pixel défilé. En les regroupant, on lit la
   position une fois par image (60 fois par seconde maximum) au
   lieu de plusieurs centaines de fois par seconde.
   ============================================================ */

function initScrollEffects() {
    const progressBar = document.querySelector('.scroll-progress span');
    const navbar = document.querySelector('.navbar');
    const backToTop = document.querySelector('.back-to-top');
    const portrait = document.querySelector('.portrait-frame img');
    const timeline = document.querySelector('.timeline');
    let ticking = false;

    const update = () => {
        const scrollTop = window.scrollY;
        const viewport = window.innerHeight;
        const maxScroll = document.documentElement.scrollHeight - viewport;

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
            // Le bouton flotte au-dessus du contenu. Dans la section
            // contact, il chevauchait la zone du bouton d'envoi : on le
            // retire dès que le formulaire est à l'écran, pour qu'il ne
            // dispute jamais le clic à l'action principale.
            const contact = document.querySelector('#contact');
            const contactVisible = contact
                ? contact.getBoundingClientRect().top < viewport * 0.75
                : false;
            backToTop.classList.toggle('visible', scrollTop > 300 && !contactVisible);
        }

        // Parallaxe : le portrait se décale plus lentement que la
        // page. Amplitude volontairement faible (±18 px) — au-delà,
        // l'effet devient tape-à-l'œil et provoque du mal-être.
        if (portrait && !prefersReducedMotion) {
            const decalage = Math.max(-18, Math.min(18, scrollTop * 0.06));
            portrait.style.setProperty('--shift', decalage.toFixed(1) + 'px');
        }

        // Tracé de la timeline : la ligne se remplit à mesure que
        // la section traverse le viewport.
        if (timeline && !prefersReducedMotion) {
            const rect = timeline.getBoundingClientRect();
            const parcouru = (viewport * 0.75) - rect.top;
            const progression = Math.max(0, Math.min(1, parcouru / rect.height));
            timeline.style.setProperty('--draw', progression.toFixed(3));
        }

        ticking = false;
    };

    window.addEventListener('scroll', () => {
        if (!ticking) {
            ticking = true;
            window.requestAnimationFrame(update);
        }
    }, { passive: true });

    // Le redimensionnement change la hauteur du document : on
    // recalcule, sinon la barre de progression devient fausse.
    window.addEventListener('resize', () => {
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
   4. RÉVÉLATION AU SCROLL (avec cascade)
   Les éléments [data-animate] apparaissent en entrant dans le
   viewport. Ceux qui partagent le même parent (les cartes d'une
   grille) sont décalés les uns après les autres : c'est ce
   décalage qui donne une impression de fluidité plutôt qu'un
   bloc entier qui surgit d'un coup.
   ============================================================ */

function initScrollAnimations() {
    const elements = document.querySelectorAll('[data-animate]');
    if (!elements.length) return;

    // Mouvement réduit ou navigateur ancien : tout est affiché
    // immédiatement, sans dépendre d'un observateur.
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
        elements.forEach((el) => el.classList.add('visible', 'motion-done'));
        document.documentElement.style.setProperty('--draw', '1');
        return;
    }

    const STAGGER = 90;      // ms entre deux éléments d'une même grille
    const CASCADE_MAX = 450; // durée totale maximale d'une cascade

    const observer = new IntersectionObserver((entries, obs) => {
        // On regroupe par parent pour calculer la cascade sur les
        // seuls éléments qui apparaissent DANS LA MÊME passe.
        const parEntree = new Map();

        entries.filter((e) => e.isIntersecting).forEach((entry) => {
            const parent = entry.target.parentElement;
            if (!parEntree.has(parent)) parEntree.set(parent, []);
            parEntree.get(parent).push(entry.target);
        });

        parEntree.forEach((groupe) => {
            // Ordre du DOM, pour que la cascade suive la lecture
            groupe.sort((a, b) =>
                a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
            );

            // Le pas est reduit sur les grandes grilles : avec 9 projets
            // et 90 ms fixes, la derniere carte attendrait 720 ms avant
            // meme de commencer. On plafonne la cascade a 450 ms au total.
            const pas = Math.min(STAGGER, CASCADE_MAX / Math.max(1, groupe.length - 1));

            groupe.forEach((el, i) => {
                el.style.setProperty('--delay', Math.round(i * pas) + 'ms');
                el.classList.add('visible');

                // Une fois l'animation finie on libère le GPU et on
                // remet le délai à zéro, sinon un futur survol le
                // réutiliserait et paraîtrait « collant ».
                setTimeout(() => el.classList.add('motion-done'), 900 + i * pas);

                obs.unobserve(el);
            });
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

    elements.forEach((el) => observer.observe(el));
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
   7. ROTATION DES INTITULÉS DE POSTE (titre du hero)

   Ce bloc écrivait auparavant le titre lettre par lettre. Mesuré
   au chargement en 375 px, le <h2> affichait « Au » : pendant les
   premières secondes, la seule information qui dit à un recruteur
   quel est le métier de la personne était illisible, et le cycle
   la réécrivait indéfiniment.

   La rotation est conservée, la frappe est abandonnée : on passe
   d'un libellé COMPLET au suivant par un fondu. À chaque instant,
   ce qui est à l'écran est un intitulé entier et exact — y compris
   à la toute première image, puisque le premier libellé est déjà
   dans le HTML et n'est jamais effacé.
   ============================================================ */

function initRoleRotation() {
    const element = document.querySelector('[data-typed]');
    if (!element) return;

    const phrases = element.dataset.typed.split('|').map((s) => s.trim()).filter(Boolean);

    // Le premier intitulé est le principal : il est déjà rendu par le
    // HTML. On le réaffirme ici pour retirer d'éventuels espaces.
    element.textContent = phrases[0] || element.textContent.trim();

    // Mouvement réduit, ou un seul intitulé : on s'arrête là, titre fixe.
    if (prefersReducedMotion || phrases.length < 2) return;

    const DUREE_FONDU = 320;   // doit rester alignée sur la transition CSS
    const DUREE_LECTURE = 3200;
    let index = 0;

    const suivant = () => {
        element.classList.add('is-fading');

        setTimeout(() => {
            index = (index + 1) % phrases.length;
            element.textContent = phrases[index];
            element.classList.remove('is-fading');
            setTimeout(suivant, DUREE_LECTURE);
        }, DUREE_FONDU);
    };

    setTimeout(suivant, DUREE_LECTURE);
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
    const statut = document.querySelector('[data-filter-status]');
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
                const etaitCachee = card.classList.contains('is-hidden');
                card.classList.toggle('is-hidden', !match);

                // Rejoue l'animation d'entrée sur les cartes qui
                // réapparaissent. Retirer puis remettre la classe ne
                // suffit pas : le navigateur regroupe les deux
                // changements dans la même image et l'animation ne
                // redémarre pas. offsetWidth force un recalcul de
                // style entre les deux — c'est le déclencheur.
                if (match && etaitCachee && !prefersReducedMotion) {
                    card.classList.remove('is-entering');
                    void card.offsetWidth;
                    card.classList.add('is-entering');
                }

                if (match) visibleCount += 1;
            });

            if (emptyMessage) emptyMessage.hidden = visibleCount > 0;

            // WCAG 4.1.3 Messages de statut (AA) : le filtrage change le
            // nombre de projets visibles sans déplacer le focus. Sans cette
            // région live, un lecteur d'écran n'annonce rien. Le libellé du
            // bouton est repris pour que l'annonce ait du sens hors contexte
            // visuel : « 4 projets affichés pour la catégorie Web ».
            if (statut) {
                const categorie = button.textContent.trim();
                const pluriel = visibleCount > 1 ? 's' : '';
                statut.textContent = visibleCount === 0
                    ? 'Aucun projet dans la catégorie ' + categorie + '.'
                    : visibleCount + ' projet' + pluriel + ' affiché' + pluriel
                      + ' pour la catégorie ' + categorie + '.';
            }
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
   12. INCLINAISON 3D DES CARTES
   Au survol, la carte s'incline légèrement vers le curseur et un
   reflet la suit. L'effet n'est activé que sur les appareils
   dotés d'un vrai pointeur : sur écran tactile il n'y a pas de
   survol, l'inclinaison resterait figée après un appui.
   ============================================================ */

function initTilt() {
    if (prefersReducedMotion) return;

    // pointer:fine = souris ou trackpad, pas un doigt
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const cartes = document.querySelectorAll('.project-card, .skill-card');
    const AMPLITUDE = 6; // degrés maximum — au-delà, l'effet fait « jouet »

    cartes.forEach((carte) => {
        carte.classList.add('tilt');

        carte.addEventListener('pointermove', (event) => {
            const rect = carte.getBoundingClientRect();

            // Position du curseur ramenée dans l'intervalle -0.5 … +0.5
            const x = (event.clientX - rect.left) / rect.width - 0.5;
            const y = (event.clientY - rect.top) / rect.height - 0.5;

            carte.classList.add('is-tilting');
            // L'axe X est inversé : bouger le curseur vers le bas doit
            // faire basculer le haut de la carte vers l'arrière.
            carte.style.setProperty('--ry', (x * AMPLITUDE).toFixed(2) + 'deg');
            carte.style.setProperty('--rx', (-y * AMPLITUDE).toFixed(2) + 'deg');
            carte.style.setProperty('--lift', '-6px');

            // Position du reflet, en pourcentage de la carte
            carte.style.setProperty('--mx', ((x + 0.5) * 100).toFixed(1) + '%');
            carte.style.setProperty('--my', ((y + 0.5) * 100).toFixed(1) + '%');
        });

        const reset = () => {
            // On retire is-tilting AVANT de remettre les valeurs à
            // zéro : la transition CSS reprend et le retour est doux.
            carte.classList.remove('is-tilting');
            carte.style.setProperty('--rx', '0deg');
            carte.style.setProperty('--ry', '0deg');
            carte.style.setProperty('--lift', '0px');
        };

        carte.addEventListener('pointerleave', reset);
        carte.addEventListener('pointercancel', reset);
    });
}
/* ============================================================
   INITIALISATION
   Le script est chargé avec defer : le DOM est donc déjà prêt.
   ============================================================ */

initTheme();
initMobileNav();
initScrollEffects();
initScrollAnimations();
initTilt();
initScrollSpy();
initCounters();
initRoleRotation();
initProjectFilters();
initCopyButtons();
initContactForm();
initFooterYear();
