
(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  const yearFilter = $('filter-year');
  const semesterFilter = $('filter-semester');
  const categoryFilter = $('filter-category');

  const search = $('resource-search');
  const list = $('resource-list');
  const count = $('results-count');
  const heading = $('results-heading');
  const steps = $('step-nav');

  // Vérification des éléments indispensables.
  if (
    !yearFilter ||
    !semesterFilter ||
    !categoryFilter ||
    !search ||
    !list ||
    !count ||
    !heading ||
    !steps
  ) {
    console.error('Certains éléments HTML de la page ressources sont introuvables.');
    return;
  }

  const params = new URLSearchParams(location.search);

  const CATEGORIES = [
    'دروس',
    'TD',
    'دراسات تقنية',
    'وثائق الأستاذ'
  ];

  const YEARS = ['1AS', '2AS', '3AS'];

  const UNCLASSIFIED_YEAR = 'À classer';

  const valid = (value, values) =>
    values.includes(value) ? value : '';

  yearFilter.value = valid(
    params.get('annee'),
    YEARS
  );

  semesterFilter.value = valid(
    params.get('semestre'),
    ['S1', 'S2', 'S3']
  );

  categoryFilter.value = valid(
    params.get('categorie'),
    CATEGORIES
  );

  // Protection contre les injections HTML.
  const esc = value =>
    String(value ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c]);

  const labels = {
    S1: 'السداسي الأول',
    S2: 'السداسي الثاني',
    S3: 'السداسي الثالث'
  };

  let all = [];

  let refreshInProgress = false;

  // ==================================================
  // 1. FILTRES ET RECHERCHE
  // ==================================================

  function currentFilters() {
    return {
      year: yearFilter.value,
      semester: semesterFilter.value,
      category: categoryFilter.value,
      query: search.value.trim().toLocaleLowerCase('ar')
    };
  }

  function filteredItems() {
    const f = currentFilters();

    return all.filter(r => {
      const matchesYear =
        !f.year || r.year === f.year;

      const matchesSemester =
        !f.semester || r.semester === f.semester;

      const matchesCategory =
        !f.category || r.category === f.category;

      const searchableText = [
        r.title,
        r.description,
        r.fileName,
        r.year,
        r.semester,
        r.category
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('ar');

      const matchesQuery =
        !f.query || searchableText.includes(f.query);

      return (
        matchesYear &&
        matchesSemester &&
        matchesCategory &&
        matchesQuery
      );
    });
  }

  // ==================================================
  // 2. ICÔNE DU FICHIER
  // ==================================================

  function fileIcon(r) {
    const ext = MecaniqueStorage.extensionOf(r.fileName);

    const image = [
      'jpg',
      'jpeg',
      'png',
      'webp'
    ].includes(ext);

    return `
      <span
        class="file-icon${image ? ' image' : ''}"
        aria-label="ملف ${esc(ext)}"
      >
        ${esc(ext || 'FILE')}
      </span>
    `;
  }

  // ==================================================
  // 3. NAVIGATION PAR ÉTAPES
  // ==================================================

  function renderSteps() {
    const year = yearFilter.value;
    const semester = semesterFilter.value;
    const category = categoryFilter.value;

    const buttons = [];

    if (year) {
      buttons.push({
        text: year,
        key: 'year'
      });
    }

    if (semester) {
      buttons.push({
        text: labels[semester],
        key: 'semester'
      });
    }

    if (category) {
      buttons.push({
        text: category,
        key: 'category'
      });
    }

    if (!buttons.length) {
      steps.innerHTML = `
        <span class="step-chip active">
          جميع السنوات
        </span>

        <button class="step-chip" type="button" data-year="1AS">1AS</button>
        <button class="step-chip" type="button" data-year="2AS">2AS</button>
        <button class="step-chip" type="button" data-year="3AS">3AS</button>
      `;

      steps.querySelectorAll('[data-year]').forEach(button => {
        button.addEventListener('click', () => {
          yearFilter.value = button.dataset.year;
          render();
        });
      });

      return;
    }

    steps.innerHTML =
      buttons.map((b, i) => `
        <button
          class="step-chip${i === buttons.length - 1 ? ' active' : ''}"
          type="button"
          data-key="${b.key}"
        >
          ${esc(b.text)}
        </button>
      `).join('') +
      `
        <button
          class="step-chip"
          type="button"
          data-clear="true"
        >
          مسح الكل ×
        </button>
      `;

    steps.querySelectorAll('[data-key]').forEach(button => {
      button.addEventListener('click', () => {
        const key = button.dataset.key;

        if (key === 'year') {
          semesterFilter.value = '';
          categoryFilter.value = '';
        }

        if (key === 'semester') {
          categoryFilter.value = '';
        }

        render();
      });
    });

    steps
      .querySelector('[data-clear]')
      ?.addEventListener('click', resetFilters);
  }

  // ==================================================
  // 4. AFFICHAGE DES RESSOURCES
  // ==================================================

  function render() {
    const items = filteredItems();
    const f = currentFilters();

    heading.textContent = f.category
      ? f.category
      : (
          f.semester
            ? labels[f.semester]
            : (f.year || 'جميع الموارد')
        );

    count.textContent =
      `${items.length} وثيقة متاحة`;

    renderSteps();

    if (!items.length) {
      const hasFilter =
        f.year || f.semester || f.category || f.query;

      list.innerHTML = `
        <div class="empty-state">
          <strong>
            ${
              hasFilter
                ? 'لا توجد وثائق تطابق بحثك'
                : 'لا توجد موارد متاحة حاليا'
            }
          </strong>

          <p>
            ${
              hasFilter
                ? 'حاول تغيير الفلاتر أو استخدام كلمة مفتاحية أخرى.'
                : 'ستظهر هنا الوثائق التي تنشرها الأستاذة.'
            }
          </p>

          ${
            hasFilter
              ? `
                <button
                  class="btn btn-secondary"
                  id="empty-reset"
                  type="button"
                >
                  إعادة ضبط الفلاتر
                </button>
              `
              : ''
          }
        </div>
      `;

      $('empty-reset')?.addEventListener(
        'click',
        resetFilters
      );

      return;
    }

    list.innerHTML = items.map(r => `
      <article class="resource-card">

        ${fileIcon(r)}

        <div class="resource-details">
          <h3>${esc(r.title || r.fileName || 'Sans titre')}</h3>

          ${
            r.description
              ? `<p>${esc(r.description)}</p>`
              : ''
          }

          <div class="resource-meta">
            <span>
              ${esc(r.year || UNCLASSIFIED_YEAR)}
            </span>

            <span>
              ${esc(labels[r.semester] || r.semester || '')}
            </span>

            <span>${esc(r.category || '')}</span>

            <span>
              ${esc(MecaniqueStorage.formatDate(r.addedAt))}
            </span>

            <span>
              ${esc(MecaniqueStorage.formatSize(r.fileSize))}
            </span>
          </div>
        </div>

        <div class="resource-actions">
          <button
            class="small-btn primary"
            type="button"
            data-download="${esc(r.id)}"
          >
            ↓ تحميل
          </button>

          ${
            MecaniqueStorage.isPreviewable(r)
              ? `
                <button
                  class="small-btn"
                  type="button"
                  data-preview="${esc(r.id)}"
                >
                  ↗ معاينة
                </button>
              `
              : ''
          }
        </div>

      </article>
    `).join('');

    // Téléchargement.
    list.querySelectorAll('[data-download]').forEach(button => {
      button.addEventListener('click', () => {
        downloadFile(button.dataset.download);
      });
    });

    // Prévisualisation.
    list.querySelectorAll('[data-preview]').forEach(button => {
      button.addEventListener('click', () => {
        previewFile(button.dataset.preview);
      });
    });
  }

  // ==================================================
  // 5. TÉLÉCHARGEMENT
  // ==================================================

  async function downloadFile(id) {
    try {
      const resource = await MecaniqueStorage.get(id);

      if (!resource) {
        throw new Error('الوثيقة غير موجودة.');
      }

      const link = document.createElement('a');

      link.href = MecaniqueStorage.getFileURL(
        resource,
        true
      );

      link.download = resource.fileName || resource.title || 'document';

      document.body.appendChild(link);
      link.click();
      link.remove();

    } catch (error) {
      alert(`تعذر تحميل الملف: ${error.message}`);
    }
  }

  // ==================================================
  // 6. PRÉVISUALISATION
  // ==================================================

  async function previewFile(id) {
    try {
      const resource = await MecaniqueStorage.get(id);

      if (!resource) {
        throw new Error('الوثيقة غير موجودة.');
      }

      const url = MecaniqueStorage.getFileURL(resource);

      const tab = window.open(
        url,
        '_blank',
        'noopener,noreferrer'
      );

      if (!tab) {
        alert('يرجى السماح بالنوافذ المنبثقة لمعاينة الوثيقة.');
      }

    } catch (error) {
      alert(`تعذرت معاينة الملف: ${error.message}`);
    }
  }

  // ==================================================
  // 7. RÉINITIALISATION DES FILTRES
  // ==================================================

  function resetFilters() {
    yearFilter.value = '';
    semesterFilter.value = '';
    categoryFilter.value = '';
    search.value = '';

    render();
  }

  [
    yearFilter,
    semesterFilter,
    categoryFilter
  ].forEach(el => {
    el.addEventListener('change', render);
  });

  search.addEventListener('input', render);

  $('reset-filters')?.addEventListener(
    'click',
    resetFilters
  );

  // ==================================================
  // 8. MENU MOBILE
  // ==================================================

  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');

      toggle.setAttribute(
        'aria-expanded',
        String(open)
      );

      toggle.setAttribute(
        'aria-label',
        open ? 'إغلاق القائمة' : 'فتح القائمة'
      );
    });
  }

  // ==================================================
  // 9. ANNÉE DANS LE FOOTER
  // ==================================================

  document
    .querySelectorAll('.current-year')
    .forEach(el => {
      el.textContent = new Date().getFullYear();
    });

  // ==================================================
  // 10. CHARGEMENT DES RESSOURCES
  // ==================================================

  async function loadResources() {
    if (refreshInProgress) return;

    refreshInProgress = true;

    try {
      const items = await MecaniqueStorage.getAll();

      if (!Array.isArray(items)) {
        throw new Error('Réponse invalide du serveur.');
      }

      all = items;

      render();

    } catch (error) {
      console.error('Erreur de chargement des ressources :', error);

      if (!all.length) {
        list.innerHTML = `
          <div class="empty-state">
            <strong>تعذر تحميل الوثائق</strong>
            <p>${esc(error.message)}</p>
          </div>
        `;

        count.textContent = 'خطأ في تحميل الوثائق';
      }

    } finally {
      refreshInProgress = false;
    }
  }

  // Chargement initial.
  loadResources();

  // Actualisation automatique toutes les 30 secondes.
  // Le serveur doit lui-même synchroniser Google Drive en arrière-plan.
  setInterval(() => {
    if (!document.hidden) {
      loadResources();
    }
  }, 30000);

  // Actualisation lorsque l'utilisateur revient sur la page.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      loadResources();
    }
  });

})();
