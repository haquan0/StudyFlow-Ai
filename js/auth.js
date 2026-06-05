/* =====================================================
  auth.js — Kullanıcı kimlik doğrulama, oturum ve UI kontrol
  ===================================================== */

const Auth = {
  apiBase: './api',
  user: null,
  csrfToken: null,
  isReady: false,
  authPage: document.getElementById('authPage'),
  authSwitch: document.getElementById('authSwitch'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  authError: document.getElementById('authError'),

  init() {
    this.bindEvents();
    this.checkAuthStatus();
  },

  bindEvents() {
    const loginBtn = document.getElementById('showLoginBtn');
    const registerBtn = document.getElementById('showRegisterBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (loginBtn) loginBtn.addEventListener('click', () => this.showForm('login'));
    if (registerBtn) registerBtn.addEventListener('click', () => this.showForm('register'));
    if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());

    if (this.loginForm) {
      this.loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        await this.login();
      });
    }

    if (this.registerForm) {
      this.registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        await this.register();
      });
    }
  },

  apiUrl(path) {
    return `${this.apiBase}/${path}`;
  },

  async request(url, method = 'GET', body = null, useCsrf = true) {
    const headers = { 'Accept': 'application/json' };
    if (useCsrf) {
      this.csrfToken = this.getCsrfCookie();
      if (this.csrfToken) {
        headers['X-CSRF-Token'] = this.csrfToken;
      }
    }
    if (body !== null) {
      headers['Content-Type'] = 'application/json';
    }

    let resp;
    try {
      resp = await fetch(url, {
        method,
        headers,
        credentials: 'include',
        body: body !== null ? JSON.stringify(body) : null,
      });
    } catch (error) {
      throw new Error('Sunucuya bağlanılamadı. PHP sunucunuzu başlatın ve bu projeyi bir HTTP sunucusu üzerinden açın.');
    }

    let data;
    try {
      data = await resp.json();
    } catch (error) {
      const text = await resp.text();
      console.error('Invalid JSON response from backend:', text);
      throw new Error(`Sunucudan geçersiz yanıt alındı (${resp.status}). Backend çıktısını kontrol edin.`);
    }

    if (!resp.ok) {
      throw new Error(data.error || data.message || 'Sunucu hatası');
    }
    return data;
  },

  async checkAuthStatus() {
    try {
      const response = await this.request(this.apiUrl('auth.php'), 'GET', null, false);
      this.csrfToken = this.getCsrfCookie();
      if (response.authenticated) {
        this.user = response.user;
        this.onAuthenticated();
      } else {
        this.showAuthView();
      }
    } catch (error) {
      console.error('Auth check failed', error);
      this.showAuthView();
    } finally {
      this.isReady = true;
    }
  },

  getCsrfCookie() {
    return document.cookie.split('; ').reduce((acc, cookie) => {
      const [name, value] = cookie.split('=');
      if (name === 'studyai_csrf') {
        return decodeURIComponent(value || '');
      }
      return acc;
    }, '');
  },

  showAuthView() {
    document.body.classList.add('auth-active');
    if (this.authPage) this.authPage.classList.add('active');
    document.querySelectorAll('.sidebar, .main-content, .mobile-header').forEach((el) => el?.classList.add('hidden-auth'));
    this.showForm('login');
  },

  hideAuthView() {
    document.body.classList.remove('auth-active');
    if (this.authPage) this.authPage.classList.remove('active');
    document.querySelectorAll('.sidebar, .main-content, .mobile-header').forEach((el) => el?.classList.remove('hidden-auth'));
  },

  showForm(type) {
    if (!this.authPage) return;
    const loginPane = this.authPage.querySelector('.auth-pane.login');
    const registerPane = this.authPage.querySelector('.auth-pane.register');
    if (!loginPane || !registerPane) return;

    loginPane.classList.toggle('visible', type === 'login');
    registerPane.classList.toggle('visible', type === 'register');
    this.authError.textContent = '';
    this.authPage.querySelectorAll('.auth-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.target === type));
  },

  async login() {
    try {
      const payload = {
        action: 'login',
        email: document.getElementById('loginEmail').value.trim(),
        password: document.getElementById('loginPassword').value,
        remember: document.getElementById('rememberMe').checked,
      };
      const response = await this.request(this.apiUrl('auth.php'), 'POST', payload);
      this.user = response.user;
      this.csrfToken = this.getCsrfCookie();
      this.onAuthenticated();
      UI.toast(response.message || 'Giriş başarılı.');
    } catch (error) {
      this.authError.textContent = error.message;
    }
  },

  async register() {
    try {
      const payload = {
        action: 'register',
        name: document.getElementById('registerName').value.trim(),
        email: document.getElementById('registerEmail').value.trim(),
        password: document.getElementById('registerPassword').value,
        remember: document.getElementById('registerRemember').checked,
      };
      const response = await this.request(this.apiUrl('auth.php'), 'POST', payload);
      this.user = response.user;
      this.csrfToken = this.getCsrfCookie();
      this.onAuthenticated();
      UI.toast(response.message || 'Kayıt başarılı.');
    } catch (error) {
      this.authError.textContent = error.message;
    }
  },

  async logout() {
    try {
      await this.request(this.apiUrl('auth.php?action=logout'), 'POST', null);
    } catch (error) {
      console.warn('Logout failed', error);
    }
    this.user = null;
    this.csrfToken = null;
    DB.setAuthenticated(false);
    this.showAuthView();
    UI.toast('Oturum kapatıldı.', 'info');
  },

  async onAuthenticated() {
    this.hideAuthView();
    UI.setUser(this.user);
    DB.setAuthenticated(true);
    try {
      await DB.syncFromServer();
    } catch (error) {
      console.warn('Bulut senkronizasyonu basarisiz', error);
      UI.toast('Bulut verileri yüklenirken hata oluştu. Yerel veri yüklendi.', 'warning');
    }
    UI.renderDashboard();
    UI.showPage('dashboard');
  },
};
