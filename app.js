/**
 * THE FAMILY GYM - SISTEMA DE GESTIÓN FINANCIERA Y CONTROL DE MIEMBROS
 * Versión PC Desktop Responsiva + Adaptativa a Móvil + Firebase Auth Login
 */

class FitControlApp {
  constructor() {
    this.storageKey = 'THE_FAMILY_GYM_V4';
    this.authSessionKey = 'THE_FAMILY_GYM_AUTH';

    this.data = {
      settings: {
        gymName: 'The Family Gym',
        slogan: 'Haz la diferencia',
        defaultFee: 25
      },
      clients: [],
      loans: [],
      customAlerts: [],
      cashflow: []
    };

    this.activeTab = 'dashboard';
    this.clientStatusFilter = 'all';
    this.init();
  }

  init() {
    this.registerServiceWorker();
    this.loadData();
    this.checkAuthStatus();
    this.setupEventListeners();
    this.setCurrentDate();
    this.applyTheme();
    this.checkAndRenewCycles();
    this.render();
    this.startNotificationScheduler();
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        console.log('SW registrado con éxito:', reg.scope);
      }).catch(err => {
        console.error('Error al registrar SW:', err);
      });
    }
  }

  advanceClientDueDate(dateStr, plan = '') {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    let year = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1;
    let day = parseInt(parts[2], 10);

    const planLower = (plan || '').toLowerCase();
    if (planLower.includes('semanal') && !planLower.includes('quincenal')) {
      const dObj = new Date(year, month, day + 7);
      return dObj.toISOString().split('T')[0];
    } else if (planLower.includes('quincenal')) {
      const dObj = new Date(year, month, day + 15);
      return dObj.toISOString().split('T')[0];
    } else {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      const lastDayOfNextMonth = new Date(year, month + 1, 0).getDate();
      const actualDay = Math.min(day, lastDayOfNextMonth);
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(actualDay).padStart(2, '0');
      return `${year}-${mStr}-${dStr}`;
    }
  }

  formatDateSpanish(dateStr) {
    if (!dateStr) return 'No definida';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return dObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  }

  checkAndRenewCycles() {
    const todayStr = new Date().toISOString().split('T')[0];
    let changed = false;

    if (this.data.clients && this.data.clients.length > 0) {
      this.data.clients.forEach(client => {
        if (client.status === 'paid' && client.amountOwed === 0 && client.startDate) {
          if (todayStr >= client.startDate) {
            client.amountOwed = Number(client.fee) || 25;
            client.status = 'overdue';
            changed = true;
          }
        }
      });
    }

    if (this.data.loans && this.data.loans.length > 0) {
      this.data.loans.forEach(loan => {
        if (!loan.nextPayDate) {
          const now = new Date();
          let yr = now.getFullYear();
          let mo = now.getMonth();
          const pDay = loan.payDay || 15;
          const maxD = new Date(yr, mo + 1, 0).getDate();
          const d = Math.min(pDay, maxD);
          const candidate = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          loan.nextPayDate = candidate < todayStr ? this.advanceClientDueDate(candidate, 'Mensual') : candidate;
          changed = true;
        } else if (todayStr >= loan.nextPayDate && loan.currentBalance > 0) {
          const monthlyInt = (loan.currentBalance * ((loan.interestRate || 0) / 100));
          if (monthlyInt > 0) {
            loan.accumulatedInterest = (Number(loan.accumulatedInterest) || 0) + monthlyInt;
          }
          loan.nextPayDate = this.advanceClientDueDate(loan.nextPayDate, 'Mensual');
          changed = true;
        }
      });
    }

    if (changed) {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    }
  }

  applyTheme() {
    const theme = (this.data.settings && this.data.settings.theme) || 'dark';
    const isLight = theme === 'light';
    document.body.classList.toggle('light-theme', isLight);

    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');
    if (sunIcon && moonIcon) {
      if (isLight) {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
      } else {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
      }
    }
  }

  toggleTheme() {
    if (!this.data.settings) this.data.settings = {};
    const currentTheme = this.data.settings.theme || 'dark';
    this.data.settings.theme = currentTheme === 'dark' ? 'light' : 'dark';
    this.saveData();
    this.applyTheme();
    this.showToast(this.data.settings.theme === 'light' ? '☀️ Modo Claro Activado' : '🌙 Modo Oscuro Activado');
  }

  getClientStatus(client) {
    if (!client) return 'paid';
    return (client.amountOwed > 0 || client.status === 'overdue') ? 'overdue' : 'paid';
  }

  checkCustomPlan(planVal) {
    const customSelect = document.getElementById('client-has-custom');
    if (customSelect) {
      if ((planVal || '').toLowerCase().includes('entrenador')) {
        customSelect.value = 'true';
      }
    }
  }

  updatePayDayFromStartDate(dateStr) {
    if (!dateStr) return;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const feeInput = document.getElementById('client-fee');
      if (feeInput && (!feeInput.value || parseFloat(feeInput.value) <= 0)) {
        feeInput.value = this.data.settings.defaultFee || 25;
      }
    }
  }

  requestNotificationPermission() {
    if (!('Notification' in window)) {
      this.showToast('⚠️ Este navegador no soporta notificaciones de escritorio.');
      return;
    }

    if (Notification.permission === 'granted') {
      this.showToast('🔔 Notificaciones constantes YA están activadas.');
      this.checkAndSendNotifications(true);
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          this.showToast('✅ ¡Notificaciones de alertas activadas correctamente!');
          this.checkAndSendNotifications(true);
        } else {
          this.showToast('⚠️ Permiso de notificaciones denegado.');
        }
      });
    } else {
      this.showToast('⚠️ Notificaciones bloqueadas en el navegador.');
    }
  }

  startNotificationScheduler() {
    setTimeout(() => this.checkAndSendNotifications(false), 1500);
    setInterval(() => this.checkAndSendNotifications(false), 30000);
  }

  sendPhoneNotification(title, body, tag = 'gym-notif') {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    if ('vibrate' in navigator) {
      try { navigator.vibrate([200, 100, 200, 100, 200]); } catch (e) {}
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration && registration.showNotification) {
          registration.showNotification(title, {
            body: body,
            icon: './assets/icon-192.png',
            badge: './assets/icon-192.png',
            tag: tag,
            vibrate: [200, 100, 200, 100, 200],
            requireInteraction: true
          }).catch(() => {
            try { new Notification(title, { body, tag }); } catch (e) {}
          });
        } else {
          try { new Notification(title, { body, tag }); } catch (e) {}
        }
      }).catch(() => {
        try { new Notification(title, { body, tag }); } catch (e) {}
      });
    } else {
      try { new Notification(title, { body, tag }); } catch (e) {}
    }
  }

  testPhoneNotification() {
    if (!('Notification' in window)) {
      alert('⚠️ Tu navegador o teléfono no soporta la función nativa de notificaciones.');
      this.showToast('⚠️ No compatible con notificaciones.');
      return;
    }
    if (Notification.permission === 'granted') {
      this.sendPhoneNotification(
        '🏋️ ¡Alarma Confirmada! The Family Gym',
        '¡Excelente! Las alarmas y recordatorios llegarán a tu teléfono correctamente a la hora programada.',
        'test-alarm'
      );
      this.showToast('🔔 Alarma de prueba enviada al teléfono.');
    } else if (Notification.permission === 'denied') {
      alert('⚠️ Permiso BLOQUEADO en tu teléfono: Para recibir alarmas, debes tocar el icono del candado 🔒 o los 3 puntos (Ajustes) en la barra de dirección de tu navegador -> Permisos de la página -> Notificaciones -> Permitir.');
      this.showToast('⚠️ Permiso bloqueado.');
    } else {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          this.sendPhoneNotification(
            '🏋️ ¡Alarma Confirmada! The Family Gym',
            '¡Excelente! Las alarmas y recordatorios llegarán a tu teléfono correctamente a la hora programada.',
            'test-alarm'
          );
          this.showToast('✅ Permisos activados y alarma enviada.');
        } else {
          alert('⚠️ Permiso denegado. Para recibir alarmas automáticas en tu celular, debes seleccionar "Permitir" cuando se te solicite.');
          this.showToast('⚠️ Permiso denegado.');
        }
      });
    }
  }

  checkAndSendNotifications(forceToast = false) {
    const today = new Date();
    const currentDay = today.getDate();

    const pendingClients = (this.data.clients || []).filter(c => c.amountOwed > 0 || c.status === 'overdue');
    const todayAlerts = (this.data.customAlerts || []).filter(a => parseInt(a.day, 10) === currentDay);
    const pendingLoans = (this.data.loans || []).filter(l => (l.originalPrincipal - l.totalPaid) > 0);

    const totalAlertCount = pendingClients.length + todayAlerts.length + pendingLoans.length;

    const badgeEl = document.getElementById('notif-badge-count');
    if (badgeEl) {
      badgeEl.textContent = totalAlertCount;
      badgeEl.style.display = totalAlertCount > 0 ? 'inline-block' : 'none';
    }

    if (forceToast && totalAlertCount === 0) {
      this.showToast('✅ No hay alertas pendientes por notificar hoy.');
      return;
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      const targetTime = (this.data.settings && this.data.settings.notifTime) ? this.data.settings.notifTime : '09:00';
      const [targetHour, targetMinute] = targetTime.split(':').map(Number);
      const nowHour = today.getHours();
      const nowMinute = today.getMinutes();
      const todayStr = today.toISOString().split('T')[0];

      if (!forceToast) {
        if (nowHour !== targetHour || nowMinute !== targetMinute || (this.data.settings && this.data.settings.lastNotifDate === todayStr)) {
          return;
        }
        if (!this.data.settings) this.data.settings = {};
        this.data.settings.lastNotifDate = todayStr;
        this.saveData();
      }

      if (pendingClients.length > 0) {
        this.sendPhoneNotification(
          '🏋️ THE FAMILY GYM: Miembros Vencidos',
          `Atención: Hay ${pendingClients.length} miembro(s) con mensualidad pendiente por cobrar.`,
          'gym-overdue-clients'
        );
      }

      if (todayAlerts.length > 0) {
        this.sendPhoneNotification(
          '🔔 THE FAMILY GYM: Alerta Programada',
          `Tienes ${todayAlerts.length} recordatorio(s) para hoy (Día ${currentDay} del mes).`,
          'gym-today-alerts'
        );
      }
    }
  }

  checkAuthStatus() {
    const isLoggedIn = sessionStorage.getItem(this.authSessionKey);
    const loginOverlay = document.getElementById('login-overlay');
    if (isLoggedIn === 'true') {
      loginOverlay.classList.add('hidden');
    } else {
      loginOverlay.classList.remove('hidden');
    }
  }

  handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errorDiv = document.getElementById('login-error');

    errorDiv.classList.add('hidden');

    // Secure fallback authentication (Remove before public release if solely relying on Firebase)
    const secureFallbackPassword = 'Gym2026';
    if (email === 'admin@thefamilygym.com' && password === secureFallbackPassword) {
      sessionStorage.setItem(this.authSessionKey, 'true');
      document.getElementById('login-overlay').classList.add('hidden');
      this.showToast('🔓 Sesión iniciada correctamente (Admin Local).');
      return;
    }

    // Si Firebase está configurado globalmente:
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().signInWithEmailAndPassword(email, password)
        .then(() => {
          sessionStorage.setItem(this.authSessionKey, 'true');
          document.getElementById('login-overlay').classList.add('hidden');
          this.showToast('🔓 Sesión iniciada con Firebase Auth.');
        })
        .catch(err => {
          errorDiv.textContent = `Error: ${err.message || 'Contraseña incorrecta'}`;
          errorDiv.classList.remove('hidden');
        });
    } else {
      errorDiv.textContent = 'Contraseña o usuario incorrecto';
      errorDiv.classList.remove('hidden');
    }
  }

  logout() {
    sessionStorage.removeItem(this.authSessionKey);
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().signOut().catch(() => {});
    }
    document.getElementById('login-overlay').classList.remove('hidden');
    this.showToast('🔒 Sesión cerrada.');
  }

  loadEmptyData() {
    this.data = {
      settings: {
        gymName: 'The Family Gym',
        slogan: 'Haz la diferencia',
        defaultFee: 25,
        notifTime: '09:00'
      },
      clients: [],
      loans: [],
      customAlerts: [],
      cashflow: []
    };
  }

  loadData() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        this.data = JSON.parse(saved);
        if (!this.data.customAlerts) this.data.customAlerts = [];
        if (!this.data.settings) this.data.settings = {};
        if (!this.data.settings.notifTime) this.data.settings.notifTime = '09:00';
      } catch (e) {
        console.error('Error al cargar datos:', e);
        this.loadEmptyData();
      }
    } else {
      this.loadEmptyData();
    }
    this.checkAndRenewCycles();
  }

  saveData() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    this.render();
  }

  /**
   * Día de pago ajustado a meses cortos (Febrero 28/29, Días 31)
   */
  getAdjustedDueDate(startDateStr, targetYear, targetMonth) {
    if (!startDateStr) return null;
    const parts = startDateStr.split('-');
    const originalDay = parseInt(parts[2], 10) || 1;
    const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const actualDay = Math.min(originalDay, lastDayOfMonth);
    return new Date(targetYear, targetMonth, actualDay);
  }

  loadDemoData() {
    const today = new Date();
    const currentYear = today.getFullYear();

    this.data = {
      settings: {
        gymName: 'The Family Gym',
        slogan: 'Haz la diferencia',
        defaultFee: 25
      },
      clients: [
        {
          id: 'c1',
          name: 'Carlos Mendoza',
          phone: '584121112233',
          plan: 'Entrenador Personalizado',
          fee: 35.00,
          startDate: `${currentYear}-01-02`,
          hasCustomTrainer: true,
          notes: 'Entrenador: Prof. Alexis | Objetivo: Hipertrofia',
          amountOwed: 35.00,
          status: 'overdue'
        },
        {
          id: 'c2',
          name: 'Ana Sofía Rodríguez',
          phone: '584149998877',
          plan: 'Mensual Completo',
          fee: 25.00,
          startDate: `${currentYear}-01-10`,
          hasCustomTrainer: false,
          notes: 'Rutina general musculación',
          amountOwed: 0.00,
          status: 'paid'
        },
        {
          id: 'c3',
          name: 'Roberto Gómez',
          phone: '584245554433',
          plan: 'Entrenador Personalizado',
          fee: 40.00,
          startDate: `${currentYear}-01-31`, // Día 31 (Feb -> día 28, Abril -> 30)
          hasCustomTrainer: true,
          notes: 'Entrenador: Prof. Alexis | Recuperación rodilla',
          amountOwed: 40.00,
          status: 'overdue'
        },
        {
          id: 'c4',
          name: 'Lucía Fernández',
          phone: '584163332211',
          plan: 'Pase Libre VIP',
          fee: 30.00,
          startDate: `${currentYear}-01-20`,
          hasCustomTrainer: false,
          notes: 'Acceso total cardio y pesas',
          amountOwed: 0.00,
          status: 'paid'
        }
      ],
      loans: [
        {
          id: 'l1',
          lender: 'Préstamo Equipos (Caminadoras y Pesas)',
          originalPrincipal: 1000.00,
          totalPaid: 400.00,
          currentBalance: 600.00,
          interestRate: 5.0,
          payDay: 15,
          notes: 'Préstamo para salón principal'
        },
        {
          id: 'l2',
          lender: 'Crédito Suplementos e Hidratación',
          originalPrincipal: 300.00,
          totalPaid: 150.00,
          currentBalance: 150.00,
          interestRate: 0.0,
          payDay: 30,
          notes: 'Bebidas y barras proteicas'
        }
      ],
      customAlerts: [
        {
          id: 'a1',
          title: '⚡ Pagar recibo de energía eléctrica del gimnasio',
          day: 10,
          priority: 'high'
        },
        {
          id: 'a2',
          title: '🛢️ Mantenimiento de pesas y caminadoras',
          day: 20,
          priority: 'medium'
        }
      ],
      cashflow: [
        {
          id: 'm1',
          type: 'income',
          title: 'Cuota Miembro: Ana Sofía Rodríguez',
          amount: 25.00,
          category: 'Mensualidad',
          date: new Date().toISOString()
        },
        {
          id: 'm2',
          type: 'expense',
          title: 'Mantenimiento y Grasa para Caminadoras',
          amount: 45.00,
          category: 'Mantenimiento',
          date: new Date().toISOString()
        },
        {
          id: 'm3',
          type: 'income',
          title: 'Cuota Miembro: Lucía Fernández',
          amount: 30.00,
          category: 'Mensualidad',
          date: new Date().toISOString()
        }
      ]
    };

    this.saveData();
    this.showToast('¡Datos demo de The Family Gym cargados!');
  }

  setupEventListeners() {
    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.closeModal(e.target.id);
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const openModals = document.querySelectorAll('.modal-overlay:not(.hidden)');
        openModals.forEach(modal => this.closeModal(modal.id));
      }
    });
  }

  setCurrentDate() {
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const dateStr = new Date().toLocaleDateString('es-ES', options);
    document.getElementById('current-date-str').textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  }

  switchTab(tabName) {
    this.activeTab = tabName;

    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    const targetSec = document.getElementById(`view-${tabName}`);
    if (targetSec) targetSec.classList.add('active');

    // Actualizar botones de navegación Desktop y Mobile
    document.querySelectorAll('.d-nav-item, .nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    const backBtn = document.getElementById('global-back-btn');
    if (backBtn) {
      if (tabName === 'dashboard') {
        backBtn.classList.add('hidden');
      } else {
        backBtn.classList.remove('hidden');
      }
    }

    this.render();
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    if (modalId === 'modal-add-client') {
      document.getElementById('edit-client-id').value = '';
      document.getElementById('modal-client-title').textContent = '🏋️ Inscribir Nuevo Miembro';
      document.getElementById('btn-save-client').textContent = 'Guardar Miembro';
      document.getElementById('form-add-client').reset();
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('client-start-date').value = today;
    } else if (modalId === 'modal-quick-pay') {
      this.populateClientSelect();
    } else if (modalId === 'modal-alerts') {
      this.populateAlertsModal();
    }

    modal.classList.remove('hidden');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  }

  populateAlertsModal() {
    const container = document.getElementById('modal-alerts-content');
    if (!container) return;
    container.innerHTML = '';

    const currentDay = new Date().getDate();
    const pendingClients = (this.data.clients || []).filter(c => this.getClientStatus(c) === 'overdue');
    const todayAlerts = (this.data.customAlerts || []).filter(a => parseInt(a.day, 10) === currentDay);
    const pendingLoans = (this.data.loans || []).filter(l => (l.originalPrincipal - l.totalPaid) > 0);

    let hasAlerts = false;

    if (pendingClients.length > 0) {
      hasAlerts = true;
      const section = document.createElement('div');
      section.innerHTML = `<h4 style="margin-top: 0; color: var(--text-primary);">🏋️ Miembros Vencidos (${pendingClients.length})</h4>`;
      pendingClients.forEach(c => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.style.borderLeft = '4px solid var(--danger)';
        item.innerHTML = `
          <div class="list-item-content">
            <strong>${c.name}</strong>
            <div class="list-item-sub">Venció: ${c.nextPaymentDate} - Deuda: $${Number(c.fee).toFixed(2)}</div>
          </div>
          <div class="list-item-actions">
            <button class="btn-primary" onclick="app.closeModal('modal-alerts'); app.switchTab('clients');">Ver</button>
          </div>
        `;
        section.appendChild(item);
      });
      container.appendChild(section);
    }

    if (pendingLoans.length > 0) {
      hasAlerts = true;
      const section = document.createElement('div');
      section.style.marginTop = '1rem';
      section.innerHTML = `<h4 style="margin-top: 0; color: var(--text-primary);">💸 Deudas Activas (${pendingLoans.length})</h4>`;
      pendingLoans.forEach(l => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.style.borderLeft = '4px solid var(--warning)';
        item.innerHTML = `
          <div class="list-item-content">
            <strong>${l.title}</strong>
            <div class="list-item-sub">Restante: $${(l.originalPrincipal - l.totalPaid).toFixed(2)}</div>
          </div>
          <div class="list-item-actions">
            <button class="btn-primary" onclick="app.closeModal('modal-alerts'); app.switchTab('loans');">Ver</button>
          </div>
        `;
        section.appendChild(item);
      });
      container.appendChild(section);
    }

    if (todayAlerts.length > 0) {
      hasAlerts = true;
      const section = document.createElement('div');
      section.style.marginTop = '1rem';
      section.innerHTML = `<h4 style="margin-top: 0; color: var(--text-primary);">🔔 Recordatorios (${todayAlerts.length})</h4>`;
      todayAlerts.forEach(a => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.style.borderLeft = '4px solid var(--primary)';
        item.innerHTML = `
          <div class="list-item-content">
            <strong>${a.title}</strong>
            <div class="list-item-sub">Día: ${a.day}</div>
          </div>
        `;
        section.appendChild(item);
      });
      container.appendChild(section);
    }

    if (!hasAlerts) {
      container.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-secondary);">No hay alertas pendientes hoy. ¡Todo al día! 🎉</div>';
    }
  }

  calculateKPIs() {
    const activeMembersCount = this.data.clients.length;
    const estimatedToCollect = this.data.clients.reduce((sum, c) => sum + (Number(c.fee) || 0), 0);

    const realIncomeThisMonth = this.data.cashflow
      .filter(m => m.type === 'income')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    const pendingToCollect = Math.max(0, estimatedToCollect - realIncomeThisMonth);
    const overdueMembersCount = this.data.clients.filter(c => c.amountOwed > 0 || c.status === 'overdue').length;

    const monthlyLoanInterest = this.data.loans.reduce((sum, l) => {
      const balance = Number(l.currentBalance) || 0;
      const rate = Number(l.interestRate) || 0;
      return sum + (balance * (rate / 100));
    }, 0);

    const expensesThisMonth = this.data.cashflow
      .filter(m => m.type === 'expense')
      .reduce((sum, m) => sum + Number(m.amount), 0);

    const estimatedToPay = expensesThisMonth + monthlyLoanInterest;

    const totalOriginalDebts = this.data.loans.reduce((sum, l) => sum + (Number(l.originalPrincipal) || 0), 0);
    const totalPaidDebts = this.data.loans.reduce((sum, l) => sum + (Number(l.totalPaid) || 0), 0);
    const totalCurrentDebts = this.data.loans.reduce((sum, l) => sum + (Number(l.currentBalance) || 0), 0);

    const overallLiquidatedPercent = totalOriginalDebts > 0 ? (totalPaidDebts / totalOriginalDebts) * 100 : 0;

    return {
      activeMembersCount,
      estimatedToCollect,
      realIncomeThisMonth,
      pendingToCollect,
      overdueMembersCount,
      estimatedToPay,
      expensesThisMonth,
      monthlyLoanInterest,
      totalOriginalDebts,
      totalPaidDebts,
      totalCurrentDebts,
      overallLiquidatedPercent
    };
  }

  render() {
    const kpis = this.calculateKPIs();

    document.getElementById('kpi-estimated-to-collect').textContent = `$${kpis.estimatedToCollect.toFixed(2)}`;
    document.getElementById('kpi-collected-detail').textContent = `Cobrado: $${kpis.realIncomeThisMonth.toFixed(2)} | Falta: $${kpis.pendingToCollect.toFixed(2)}`;

    document.getElementById('kpi-estimated-to-pay').textContent = `$${kpis.estimatedToPay.toFixed(2)}`;
    document.getElementById('kpi-pay-detail').textContent = `Gastos: $${kpis.expensesThisMonth.toFixed(2)} | Intereses: $${kpis.monthlyLoanInterest.toFixed(2)}`;

    document.getElementById('kpi-real-income').textContent = `$${kpis.realIncomeThisMonth.toFixed(2)}`;
    document.getElementById('kpi-active-members-count').textContent = kpis.activeMembersCount;
    document.getElementById('kpi-overdue-members-count').textContent = `${kpis.overdueMembersCount} por cobrar`;

    const alertBanner = document.getElementById('alert-banner');
    if (kpis.overdueMembersCount > 0) {
      alertBanner.classList.remove('hidden');
      document.getElementById('alert-text').textContent = `⚠️ Tienes ${kpis.overdueMembersCount} miembro(s) con cobros pendientes este mes.`;
    } else {
      alertBanner.classList.add('hidden');
    }

    if (document.getElementById('setting-gym-name')) document.getElementById('setting-gym-name').value = this.data.settings?.gymName || 'The Family Gym';
    if (document.getElementById('setting-gym-slogan')) document.getElementById('setting-gym-slogan').value = this.data.settings?.slogan || 'Haz la diferencia';
    if (document.getElementById('setting-notif-time')) document.getElementById('setting-notif-time').value = this.data.settings?.notifTime || '09:00';

    if (this.activeTab === 'dashboard') {
      this.renderDashboardLists();
    } else if (this.activeTab === 'clients') {
      this.filterClients();
    } else if (this.activeTab === 'loans') {
      this.renderLoansList();
    } else if (this.activeTab === 'cashflow') {
      this.renderCashflowList();
    }
  }

  renderDashboardLists() {
    this.renderCustomAlertsList();
  }

  renderCustomAlertsList() {
    const container = document.getElementById('custom-alerts-list');
    const alerts = this.data.customAlerts || [];

    if (alerts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span>🔔</span>
          <p>No tienes alertas personalizadas registradas.</p>
        </div>`;
      return;
    }

    container.innerHTML = alerts.map(alt => {
      const priorityClass = alt.priority === 'high' ? 'badge-overdue' : alt.priority === 'medium' ? 'badge-pending' : 'badge-paid';
      const priorityText = alt.priority === 'high' ? '🔴 Urgente' : alt.priority === 'medium' ? '🟡 Media' : '🔵 Recordatorio';
      const waText = encodeURIComponent(`Recordatorio THE FAMILY GYM 🏋️: ${alt.title} (Día ${alt.day} de cada mes)`);

      return `
        <div class="item-card">
          <div class="item-main">
            <div class="avatar-circle">🔔</div>
            <div class="item-info">
              <span class="item-title">${this.escapeHtml(alt.title)}</span>
              <span class="item-sub">Recordar día ${alt.day} de cada mes</span>
            </div>
          </div>
          <div class="item-side">
            <span class="badge ${priorityClass}">${priorityText}</span>
            <div style="display:flex; gap:6px; margin-top:4px;">
              <a href="https://wa.me/?text=${waText}" target="_blank" class="btn-whatsapp" title="Enviar Notificación por WhatsApp">💬 Alerta WA</a>
              <button class="btn-icon-sm" style="color: var(--accent-red);" onclick="app.deleteCustomAlert('${alt.id}')">Eliminar</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  saveCustomAlert(e) {
    e.preventDefault();
    const title = document.getElementById('alert-title').value.trim();
    const day = parseInt(document.getElementById('alert-day').value) || 1;
    const priority = document.getElementById('alert-priority').value;

    if (!title) return;
    if (!this.data.customAlerts) this.data.customAlerts = [];

    this.data.customAlerts.push({
      id: 'a_' + Date.now(),
      title,
      day,
      priority
    });

    this.saveData();
    this.closeModal('modal-add-alert');
    document.getElementById('form-add-alert').reset();
    this.showToast('🔔 Alerta personalizada guardada.');
  }

  deleteCustomAlert(alertId) {
    if (confirm('¿Deseas eliminar esta alerta?')) {
      this.data.customAlerts = this.data.customAlerts.filter(a => a.id !== alertId);
      this.saveData();
      this.showToast('Alerta eliminada.');
    }
  }

  setClientFilter(status, btn) {
    if (btn) {
      document.querySelectorAll('.filter-pills .pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
    }
    this.clientStatusFilter = status;
    this.filterClients();
  }

  /**
   * Filtrado Avanzado Multi-Criterio de Miembros (Buscador, Estado, Personalizado, Fechas)
   */
  filterClients() {
    const query = (document.getElementById('client-search-input')?.value || '').toLowerCase();
    const statusFilter = this.clientStatusFilter || 'all';
    const trainerFilter = document.getElementById('filter-trainer-select')?.value || 'all';
    const paydayFilter = document.getElementById('filter-payday-select')?.value || 'all';

    let filtered = [...this.data.clients];

    // 1. Filtro por Estado
    if (statusFilter === 'overdue') {
      filtered = filtered.filter(c => c.amountOwed > 0 || c.status === 'overdue');
    } else if (statusFilter === 'paid') {
      filtered = filtered.filter(c => c.amountOwed === 0 && c.status === 'paid');
    }

    // 2. Filtro por Personalizado
    if (trainerFilter === 'custom') {
      filtered = filtered.filter(c => c.hasCustomTrainer === true || (c.plan && c.plan.toLowerCase().includes('personalizado')));
    } else if (trainerFilter === 'standard') {
      filtered = filtered.filter(c => !c.hasCustomTrainer && (!c.plan || !c.plan.toLowerCase().includes('personalizado')));
    }

    // 3. Filtro por Rango Día de Pago
    if (paydayFilter !== 'all') {
      filtered = filtered.filter(c => {
        const parts = (c.startDate || '').split('-');
        const day = parseInt(parts[2], 10) || 1;
        if (paydayFilter === 'd1_10') return day >= 1 && day <= 10;
        if (paydayFilter === 'd11_20') return day >= 11 && day <= 20;
        if (paydayFilter === 'd21_31') return day >= 21 && day <= 31;
        return true;
      });
    }

    // 4. Búsqueda por Texto (Nombre, teléfono o notas)
    if (query) {
      filtered = filtered.filter(c => 
        (c.name || '').toLowerCase().includes(query) ||
        (c.phone || '').toLowerCase().includes(query) ||
        (c.notes || '').toLowerCase().includes(query) ||
        (c.plan || '').toLowerCase().includes(query)
      );
    }

    const container = document.getElementById('clients-list');
    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span>🔍</span>
          <p>No se encontraron miembros con estos filtros.</p>
        </div>`;
      return;
    }

    container.innerHTML = filtered.map(c => this.createClientCardHtml(c)).join('');
  }

  createClientCardHtml(client) {
    const dueDateFormatted = this.formatDateSpanish(client.startDate);

    const isOverdue = client.amountOwed > 0 || client.status === 'overdue';
    const statusBadge = isOverdue
      ? `<span class="badge badge-overdue">Debe $${Number(client.amountOwed).toFixed(2)} (Venció: ${dueDateFormatted})</span>`
      : `<span class="badge badge-paid">Al día (Próximo pago: ${dueDateFormatted})</span>`;

    const trainerBadge = client.hasCustomTrainer
      ? `<span class="badge badge-custom">🏋️ Personalizado</span>`
      : '';

    const waText = encodeURIComponent(`Hola ${client.name}, ¡un saludo de THE FAMILY GYM! 🏋️‍♂️ Te recordamos amablemente tu cuota del mes ($${client.fee}). ¡Haz la diferencia y ven a entrenar hoy! 💪🏼`);
    const waPhone = client.phone ? client.phone.replace(/[^0-9]/g, '') : '';
    const waButton = waPhone ? `
      <a href="https://wa.me/${waPhone}?text=${waText}" target="_blank" class="btn-whatsapp">
        💬 Recordar
      </a>` : '';

    return `
      <div class="item-card">
        <div class="item-main">
          <div class="avatar-circle">${client.name.charAt(0).toUpperCase()}</div>
          <div class="item-info">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span class="item-title">${this.escapeHtml(client.name)}</span>
              ${trainerBadge}
            </div>
            <span class="item-sub">Plan: ${client.plan} | Cobra el ${dueDateFormatted}</span>
            ${client.notes ? `<span class="item-sub" style="color:var(--brand-yellow); font-style:italic;">📝 ${this.escapeHtml(client.notes)}</span>` : ''}
            <div style="margin-top: 4px;">${statusBadge}</div>
          </div>
        </div>
        <div class="item-side">
          <span class="item-amount text-warning">$${Number(client.fee).toFixed(2)}/mes</span>
          <div style="display:flex; gap: 4px; margin-top: 4px; flex-wrap:wrap; justify-content:flex-end;">
            ${waButton}
            <button class="btn-icon-sm" onclick="app.openQuickPayForClient('${client.id}')">Cobrar</button>
            <button class="btn-icon-sm" onclick="app.editClient('${client.id}')">✏️</button>
            <button class="btn-icon-sm" style="color:var(--accent-red);" onclick="app.deleteClient('${client.id}')">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }

  saveClient(e) {
    e.preventDefault();
    const editId = document.getElementById('edit-client-id').value;
    const name = document.getElementById('client-name').value.trim();
    const phone = document.getElementById('client-phone').value.trim();
    const plan = document.getElementById('client-plan').value;
    const fee = parseFloat(document.getElementById('client-fee').value) || 25;
    const startDate = document.getElementById('client-start-date').value;
    const hasCustomTrainer = document.getElementById('client-has-custom').value === 'true';
    const notes = document.getElementById('client-notes').value.trim();
    const initialDebt = parseFloat(document.getElementById('client-initial-debt').value) || 0;

    if (!name || !startDate) return;

    if (editId) {
      const client = this.data.clients.find(c => c.id === editId);
      if (client) {
        client.name = name;
        client.phone = phone;
        client.plan = plan;
        client.fee = fee;
        client.startDate = startDate;
        client.hasCustomTrainer = hasCustomTrainer;
        client.notes = notes;
        client.amountOwed = initialDebt;
        client.status = initialDebt > 0 ? 'overdue' : 'paid';
        this.showToast(`✅ Miembro ${name} actualizado.`);
      }
    } else {
      const newClient = {
        id: 'c_' + Date.now(),
        name,
        phone,
        plan,
        fee,
        startDate,
        hasCustomTrainer,
        notes,
        amountOwed: initialDebt,
        status: initialDebt > 0 ? 'overdue' : 'paid'
      };
      this.data.clients.push(newClient);
      this.showToast(`✅ Miembro ${name} inscrito.`);
    }

    this.saveData();
    this.closeModal('modal-add-client');
    document.getElementById('form-add-client').reset();
  }

  editClient(clientId) {
    const client = this.data.clients.find(c => c.id === clientId);
    if (!client) return;

    document.getElementById('edit-client-id').value = client.id;
    document.getElementById('client-name').value = client.name;
    document.getElementById('client-phone').value = client.phone || '';
    document.getElementById('client-plan').value = client.plan;
    document.getElementById('client-fee').value = client.fee;
    document.getElementById('client-start-date').value = client.startDate;
    document.getElementById('client-has-custom').value = client.hasCustomTrainer ? 'true' : 'false';
    document.getElementById('client-notes').value = client.notes || '';
    document.getElementById('client-initial-debt').value = client.amountOwed;

    document.getElementById('modal-client-title').textContent = '✏️ Editar Miembro';
    document.getElementById('btn-save-client').textContent = 'Guardar Cambios';

    this.openModal('modal-add-client');
  }

  deleteClient(clientId) {
    const client = this.data.clients.find(c => c.id === clientId);
    if (!client) return;

    if (confirm(`¿Estás segura de eliminar a ${client.name}?`)) {
      this.data.clients = this.data.clients.filter(c => c.id !== clientId);
      this.saveData();
      this.showToast(`🗑️ Miembro ${client.name} eliminado.`);
    }
  }

  populateClientSelect() {
    const select = document.getElementById('pay-client-select');
    select.innerHTML = '<option value="">-- Selecciona un miembro --</option>' +
      this.data.clients.map(c => `<option value="${c.id}">${c.name} (Debe: $${c.amountOwed.toFixed(2)})</option>`).join('');
  }

  onClientSelectChange(selectElem) {
    const clientId = selectElem.value;
    const infoBox = document.getElementById('pay-client-info');
    if (!clientId) {
      infoBox.classList.add('hidden');
      return;
    }
    const client = this.data.clients.find(c => c.id === clientId);
    if (client) {
      infoBox.classList.remove('hidden');
      document.getElementById('pay-due-amount').textContent = `$${client.amountOwed.toFixed(2)}`;
      document.getElementById('pay-amount').value = client.amountOwed > 0 ? client.amountOwed : client.fee;
    }
  }

  openQuickPayForClient(clientId) {
    this.openModal('modal-quick-pay');
    const select = document.getElementById('pay-client-select');
    select.value = clientId;
    this.onClientSelectChange(select);
  }

  processClientPayment(e) {
    e.preventDefault();
    const clientId = document.getElementById('pay-client-select').value;
    const amount = parseFloat(document.getElementById('pay-amount').value) || 0;
    const method = document.getElementById('pay-method').value;

    if (!clientId || amount <= 0) return;

    const client = this.data.clients.find(c => c.id === clientId);
    if (client) {
      client.amountOwed = Math.max(0, client.amountOwed - amount);
      if (client.amountOwed === 0) {
        client.status = 'paid';
        client.startDate = this.advanceClientDueDate(client.startDate, client.plan);
      }

      this.data.cashflow.push({
        id: 'm_' + Date.now(),
        type: 'income',
        title: `Cuota Miembro: ${client.name}`,
        amount: amount,
        category: `Mensualidad (${method})`,
        date: new Date().toISOString()
      });

      this.saveData();
      this.closeModal('modal-quick-pay');
      document.getElementById('form-quick-pay').reset();
      this.showToast(`💰 Pago de $${amount.toFixed(2)} registrado para ${client.name}.`);
    }
  }

  filterLoans() {
    const searchTerm = document.getElementById('loan-search-input')?.value.toLowerCase() || '';
    const filtered = this.data.loans.filter(l => 
      l.lender.toLowerCase().includes(searchTerm) || 
      (l.notes && l.notes.toLowerCase().includes(searchTerm))
    );
    this.renderLoansList(filtered);
  }

  renderLoansList(filteredLoans = null) {
    const container = document.getElementById('loans-list');
    const kpis = this.calculateKPIs();

    document.getElementById('loans-total-original').textContent = `$${kpis.totalOriginalDebts.toFixed(2)}`;
    document.getElementById('loans-total-paid').textContent = `$${kpis.totalPaidDebts.toFixed(2)}`;
    document.getElementById('loans-total-balance').textContent = `$${kpis.totalCurrentDebts.toFixed(2)}`;

    document.getElementById('loans-overall-percent').textContent = `${kpis.overallLiquidatedPercent.toFixed(0)}% Liquidado`;
    document.getElementById('loans-overall-bar').style.width = `${kpis.overallLiquidatedPercent}%`;

    const loansToRender = filteredLoans || this.data.loans;

    if (loansToRender.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span>🏦</span>
          <p>No tienes ningún préstamo o deuda registrada.</p>
        </div>`;
      return;
    }

    container.innerHTML = loansToRender.map(loan => {
      const monthlyInterest = (loan.currentBalance * (loan.interestRate / 100)).toFixed(2);
      const percentPaid = loan.originalPrincipal > 0 ? ((loan.totalPaid / loan.originalPrincipal) * 100).toFixed(0) : 0;

      return `
        <div class="item-card" style="flex-direction: column; align-items: stretch;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span class="item-title" style="font-size: 0.98rem; color: var(--brand-yellow);">${this.escapeHtml(loan.lender)}</span>
              <p class="item-sub">${this.escapeHtml(loan.notes || 'Sin detalle')}</p>
            </div>
            <span class="item-amount text-danger" style="font-size: 1.15rem;">Saldo: $${Number(loan.currentBalance).toFixed(2)}</span>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin: 10px 0; font-size: 0.76rem; text-align:center; background: rgba(0,0,0,0.25); padding: 8px; border-radius: 8px;">
            <div>Original: <strong>$${Number(loan.originalPrincipal).toFixed(2)}</strong></div>
            <div class="text-success">Liquidado: <strong>$${Number(loan.totalPaid).toFixed(2)}</strong></div>
            <div class="text-warning">Interés: <strong>$${monthlyInterest}/mes</strong></div>
          </div>
          <div style="display:flex; justify-content: space-around; font-size: 0.76rem; text-align:center; background: rgba(0,0,0,0.25); padding: 8px; border-radius: 8px; margin-bottom: 10px;">
            <div class="text-warning" style="color: #facc15;">Int. Acum: <strong>$${(Number(loan.accumulatedInterest) || 0).toFixed(2)}</strong></div>
            <div class="text-success">Int. Pagado: <strong>$${(Number(loan.interestPaidSoFar) || 0).toFixed(2)}</strong></div>
          </div>

          <div>
            <div style="display:flex; justify-content:space-between; font-size:0.72rem; color:var(--text-muted);">
              <span>Amortizado: ${percentPaid}%</span>
              <span>Pendiente: ${100 - percentPaid}%</span>
            </div>
            <div class="progress-container">
              <div class="progress-bar" style="width: ${percentPaid}%;"></div>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap: 8px; margin-top: 12px;">
            <button class="btn-icon-sm" style="background: var(--brand-yellow); color:#0a0e21; font-weight:800;" onclick="app.openPayLoanModal('${loan.id}')">💸 Registrar Abono</button>
            <button class="btn-icon-sm" style="color: var(--accent-red);" onclick="app.deleteLoan('${loan.id}')">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }

  saveLoan(e) {
    e.preventDefault();
    const lender = document.getElementById('loan-lender').value.trim();
    const principal = parseFloat(document.getElementById('loan-principal').value) || 0;
    const paidSoFar = parseFloat(document.getElementById('loan-paid-so-far').value) || 0;
    const rate = parseFloat(document.getElementById('loan-interest-rate').value) || 0;
    const payDay = parseInt(document.getElementById('loan-pay-day').value) || 15;
    const accumulatedInterest = parseFloat(document.getElementById('loan-accumulated-interest').value) || 0;
    const interestPaidSoFar = parseFloat(document.getElementById('loan-interest-paid-so-far').value) || 0;

    const balance = Math.max(0, principal - paidSoFar);

    const newLoan = {
      id: 'l_' + Date.now(),
      lender,
      originalPrincipal: principal,
      totalPaid: paidSoFar,
      currentBalance: balance,
      interestRate: rate,
      payDay,
      accumulatedInterest: accumulatedInterest,
      interestPaidSoFar: interestPaidSoFar
    };

    this.data.loans.push(newLoan);
    this.saveData();
    this.closeModal('modal-add-debt');
    document.getElementById('form-add-debt').reset();
    this.showToast(`🏦 Deuda con ${lender} registrada.`);
  }

  openPayLoanModal(loanId) {
    const loan = this.data.loans.find(l => l.id === loanId);
    if (!loan) return;

    document.getElementById('pay-loan-id').value = loan.id;
    document.getElementById('pay-loan-title').textContent = `${loan.lender} (Saldo pendiente: $${loan.currentBalance.toFixed(2)})`;
    
    const estInterest = (loan.currentBalance * (loan.interestRate / 100)).toFixed(2);
    document.getElementById('pay-loan-interest').value = estInterest;
    document.getElementById('pay-loan-principal').value = '0.00';

    this.openModal('modal-pay-loan');
  }

  processLoanPayment(e) {
    e.preventDefault();
    const loanId = document.getElementById('pay-loan-id').value;
    const principalPaid = parseFloat(document.getElementById('pay-loan-principal').value) || 0;
    const interestPaid = parseFloat(document.getElementById('pay-loan-interest').value) || 0;
    const accumulateInterest = parseFloat(document.getElementById('pay-loan-accumulate-interest').value) || 0;

    const loan = this.data.loans.find(l => l.id === loanId);
    if (!loan) return;

    if (principalPaid > 0) {
      loan.totalPaid = (Number(loan.totalPaid) || 0) + principalPaid;
      loan.currentBalance = Math.max(0, loan.originalPrincipal - loan.totalPaid);
    }

    if (interestPaid > 0) {
      loan.interestPaidSoFar = (Number(loan.interestPaidSoFar) || 0) + interestPaid;
      if ((Number(loan.accumulatedInterest) || 0) > 0) {
        loan.accumulatedInterest = Math.max(0, loan.accumulatedInterest - interestPaid);
      }
      if (loan.nextPayDate) {
        loan.nextPayDate = this.advanceClientDueDate(loan.nextPayDate, 'Mensual');
      }
    }

    if (accumulateInterest > 0) {
      loan.accumulatedInterest = (Number(loan.accumulatedInterest) || 0) + accumulateInterest;
    }

    const totalPaidThisTime = principalPaid + interestPaid;

    if (totalPaidThisTime > 0) {
      this.data.cashflow.push({
        id: 'm_' + Date.now(),
        type: 'expense',
        title: `Abono Deuda: ${loan.lender}`,
        amount: totalPaidThisTime,
        category: 'Abono Deuda',
        date: new Date().toISOString()
      });
    }

    this.saveData();
    this.closeModal('modal-pay-loan');
    document.getElementById('form-pay-loan').reset();
    this.showToast(`💸 Abono de $${principalPaid.toFixed(2)} realizado.`);
  }

  deleteLoan(loanId) {
    if (confirm('¿Seguro que deseas eliminar este registro de deuda?')) {
      this.data.loans = this.data.loans.filter(l => l.id !== loanId);
      this.saveData();
      this.showToast('Deuda eliminada.');
    }
  }

  filterCashflow() {
    const searchTerm = document.getElementById('cashflow-search-input')?.value.toLowerCase() || '';
    const filtered = this.data.cashflow.filter(c => 
      c.title.toLowerCase().includes(searchTerm)
    );
    this.renderCashflowList(filtered);
  }

  renderCashflowList(filteredCashflow = null) {
    const container = document.getElementById('cashflow-list');
    const kpis = this.calculateKPIs();

    document.getElementById('cash-income-total').textContent = `$${kpis.realIncomeThisMonth.toFixed(2)}`;
    document.getElementById('cash-expense-total').textContent = `$${kpis.expensesThisMonth.toFixed(2)}`;

    const cashflowToRender = filteredCashflow || this.data.cashflow;

    if (cashflowToRender.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span>📖</span>
          <p>No hay registro de movimientos en caja.</p>
        </div>`;
      return;
    }

    container.innerHTML = [...cashflowToRender].reverse().map(item => {
      const isIncome = item.type === 'income';
      const symbol = isIncome ? '+' : '-';
      const colorClass = isIncome ? 'text-success' : 'text-danger';
      const icon = isIncome ? '🟢' : '🔴';

      return `
        <div class="item-card">
          <div class="item-main">
            <div class="avatar-circle">${icon}</div>
            <div class="item-info">
              <span class="item-title">${this.escapeHtml(item.title)}</span>
              <span class="item-sub">${item.category} | ${new Date(item.date).toLocaleDateString('es-ES')}</span>
            </div>
          </div>
          <div class="item-side">
            <span class="item-amount ${colorClass}">${symbol}$${Number(item.amount).toFixed(2)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  saveExpense(e) {
    e.preventDefault();
    const title = document.getElementById('expense-title').value.trim();
    const amount = parseFloat(document.getElementById('expense-amount').value) || 0;
    const category = document.getElementById('expense-category').value;

    if (!title || amount <= 0) return;

    this.data.cashflow.push({
      id: 'm_' + Date.now(),
      type: 'expense',
      title,
      amount,
      category,
      date: new Date().toISOString()
    });

    this.saveData();
    this.closeModal('modal-add-expense');
    document.getElementById('form-add-expense').reset();
    this.showToast(`🧾 Gasto de $${amount.toFixed(2)} registrado.`);
  }

  saveExtraIncome(e) {
    e.preventDefault();
    const title = document.getElementById('income-title').value.trim();
    const amount = parseFloat(document.getElementById('income-amount').value) || 0;

    if (!title || amount <= 0) return;

    this.data.cashflow.push({
      id: 'm_' + Date.now(),
      type: 'income',
      title,
      amount,
      category: 'Ingreso Extra',
      date: new Date().toISOString()
    });

    this.saveData();
    this.closeModal('modal-add-income');
    document.getElementById('form-add-income').reset();
    this.showToast(`💰 Ingreso extra de $${amount.toFixed(2)} registrado.`);
  }

  saveSettings() {
    const name = document.getElementById('setting-gym-name').value.trim();
    const slogan = document.getElementById('setting-gym-slogan').value.trim();
    const notifTime = document.getElementById('setting-notif-time')?.value || '09:00';

    if (!this.data.settings) this.data.settings = {};
    this.data.settings.gymName = name || 'The Family Gym';
    this.data.settings.slogan = slogan || 'Haz la diferencia';
    this.data.settings.notifTime = notifTime;

    this.saveData();
    this.showToast('⚙️ Ajustes guardados.');
  }

  exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.data, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Respaldo_TheFamilyGym_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    this.showToast('📦 Copia de seguridad descargada.');
  }

  importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (importedData.clients && importedData.loans) {
          this.data = importedData;
          this.saveData();
          this.showToast('✅ Copia de seguridad restaurada.');
        } else {
          alert('El archivo no tiene el formato correcto.');
        }
      } catch (err) {
        alert('Error al leer el archivo JSON.');
      }
    };
    reader.readAsText(file);
  }

  resetAllData() {
    if (confirm('⚠️ ¿Estás segura de borrar TODOS los datos y dejar la aplicación en blanco para comenzar de cero?')) {
      localStorage.removeItem(this.storageKey);
      this.loadEmptyData();
      this.saveData();
      this.showToast('🗑️ Aplicación en blanco lista para usar.');
    }
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 84px;
      right: 20px;
      background: #0f172a;
      color: #facc15;
      padding: 12px 20px;
      border-radius: 20px;
      border: 1.5px solid var(--brand-yellow);
      font-size: 0.85rem;
      font-weight: 800;
      z-index: 1000;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6);
      animation: fadeIn 0.2s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, match => {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match];
    });
  }
}

// Inicializar la aplicación
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new FitControlApp();
});
