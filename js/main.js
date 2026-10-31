(function () {
  'use strict';
  document.querySelectorAll('#current-year, .current-year').forEach(el => { el.textContent = new Date().getFullYear(); });
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  if (toggle && nav) toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
  });
  const latest = document.getElementById('latest-resources');
  if (!latest || !window.MecaniqueStorage) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  window.MecaniqueStorage.getAll().then(items => {
    if (!items.length) {
      latest.innerHTML = '<div class="empty-state"><strong>Aucune ressource publiée pour le moment</strong><p>Les documents ajoutés par la professeure apparaîtront ici.</p><a class="btn btn-primary" href="pages/admin.html">Ajouter un document →</a></div>';
      return;
    }
    latest.innerHTML = items.slice(0, 3).map(item => `<article class="latest-card"><span class="doc-tag">${esc(item.category)} · ${esc(item.year)}</span><h3>${esc(item.title)}</h3><p>${esc(item.description || 'Document pédagogique disponible à consulter.')}</p><div class="doc-meta"><span>${esc(item.semester)} · ${esc(window.MecaniqueStorage.formatDate(item.addedAt))}</span><span>${esc(item.fileName)}</span></div><a class="card-link" href="pages/ressources.html?annee=${encodeURIComponent(item.year)}&semestre=${encodeURIComponent(item.semester)}&categorie=${encodeURIComponent(item.category)}">Voir le document <span>→</span></a></article>`).join('');
  }).catch(error => { latest.innerHTML = `<div class="empty-state"><strong>Impossible de charger les ressources</strong><p>${esc(error.message)}</p></div>`; });
})();
