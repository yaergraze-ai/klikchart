/* Accessible table labels for the mobile card layout. No API requests or business state. */
(() => {
  const root = document.getElementById('app');
  if (!root) return;
  function decorateTables() {
    for (const table of root.querySelectorAll('table.data-table')) {
      const headings = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
      if (!headings.length) continue;
      for (const tr of table.querySelectorAll('tbody tr')) {
        [...tr.children].forEach((cell, i) => {
          const label = headings[i] || `Kolom ${i+1}`;
          if (cell.getAttribute('data-column-label') !== label) cell.setAttribute('data-column-label', label);
        });
      }
    }
  }
  const observer = new MutationObserver(mutations => {
    if (mutations.some(m => m.type === 'childList')) decorateTables();
  });
  observer.observe(root, {childList:true,subtree:true});
  decorateTables();
})();
