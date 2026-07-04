const fs = require('fs');

let indexHtml = fs.readFileSync('index.html', 'utf8');

// Add global back button
indexHtml = indexHtml.replace(
  '<div class="brand">\r\n        <div class="logo-wrapper">',
  `<div class="brand">\n        <!-- BOTÓN DE ATRÁS -->\n        <button id="global-back-btn" class="icon-btn hidden" onclick="app.switchTab('dashboard')" style="margin-right: 10px;">\n          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>\n        </button>\n        <div class="logo-wrapper">`
);

indexHtml = indexHtml.replace(
  '<div class="brand">\n        <div class="logo-wrapper">',
  `<div class="brand">\n        <!-- BOTÓN DE ATRÁS -->\n        <button id="global-back-btn" class="icon-btn hidden" onclick="app.switchTab('dashboard')" style="margin-right: 10px;">\n          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>\n        </button>\n        <div class="logo-wrapper">`
);

fs.writeFileSync('index.html', indexHtml);

let appJs = fs.readFileSync('app.js', 'utf8');

// Add global back button toggle
appJs = appJs.replace(
  `document.querySelectorAll('.d-nav-item, .nav-item').forEach(btn => {\r\n      btn.classList.toggle('active', btn.dataset.tab === tabName);\r\n    });`,
  `document.querySelectorAll('.d-nav-item, .nav-item').forEach(btn => {\n      btn.classList.toggle('active', btn.dataset.tab === tabName);\n    });\n\n    const backBtn = document.getElementById('global-back-btn');\n    if (backBtn) {\n      if (tabName === 'dashboard') {\n        backBtn.classList.add('hidden');\n      } else {\n        backBtn.classList.remove('hidden');\n      }\n    }`
);

appJs = appJs.replace(
  `document.querySelectorAll('.d-nav-item, .nav-item').forEach(btn => {\n      btn.classList.toggle('active', btn.dataset.tab === tabName);\n    });`,
  `document.querySelectorAll('.d-nav-item, .nav-item').forEach(btn => {\n      btn.classList.toggle('active', btn.dataset.tab === tabName);\n    });\n\n    const backBtn = document.getElementById('global-back-btn');\n    if (backBtn) {\n      if (tabName === 'dashboard') {\n        backBtn.classList.add('hidden');\n      } else {\n        backBtn.classList.remove('hidden');\n      }\n    }`
);

// Add filter methods for loans and cashflow
if (!appJs.includes('filterLoans()')) {
  appJs = appJs.replace(
    `renderLoansList() {`,
    `filterLoans() {\n    const searchTerm = document.getElementById('loan-search-input')?.value.toLowerCase() || '';\n    const filtered = this.data.loans.filter(l => \n      l.lender.toLowerCase().includes(searchTerm) || \n      (l.notes && l.notes.toLowerCase().includes(searchTerm))\n    );\n    this.renderLoansList(filtered);\n  }\n\n  renderLoansList(filteredLoans = null) {`
  );
  
  appJs = appJs.replace(
    `if (this.data.loans.length === 0) {`,
    `const loansToRender = filteredLoans || this.data.loans;\n    if (loansToRender.length === 0) {`
  );
  
  appJs = appJs.replace(
    `container.innerHTML = this.data.loans.map(loan => {`,
    `container.innerHTML = loansToRender.map(loan => {`
  );
}

if (!appJs.includes('filterCashflow()')) {
  appJs = appJs.replace(
    `renderCashflowList() {`,
    `filterCashflow() {\n    const searchTerm = document.getElementById('cashflow-search-input')?.value.toLowerCase() || '';\n    const filtered = this.data.cashflow.filter(c => \n      c.title.toLowerCase().includes(searchTerm)\n    );\n    this.renderCashflowList(filtered);\n  }\n\n  renderCashflowList(filteredCashflow = null) {`
  );
  
  appJs = appJs.replace(
    `if (this.data.cashflow.length === 0) {`,
    `const cashflowToRender = filteredCashflow || this.data.cashflow;\n    if (cashflowToRender.length === 0) {`
  );
  
  appJs = appJs.replace(
    `container.innerHTML = this.data.cashflow.map(mov => {`,
    `container.innerHTML = cashflowToRender.map(mov => {`
  );
}

fs.writeFileSync('app.js', appJs);

console.log('Update successful');
