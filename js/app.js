/* =====================================================
   app.js — Ana uygulama başlatıcı
   Tüm event listener'ları ve init kodları burada.
   ===================================================== */

// Seçili difficulty ve color
let selectedDifficulty = 2;
let selectedColor = '#7c3aed';

// ─── Tema yönetimi ────────────────────────────────
function applyTheme(theme) {
  document.body.classList.remove('dark', 'light');
  document.body.classList.add(theme);
  DB.setTheme(theme);
  // Toggle buton ikonunu güncelle
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.textContent = theme === 'dark' ? '☀' : '☾';
  });
}

function toggleTheme() {
  const current = DB.getTheme();
  applyTheme(current === 'dark' ? 'light' : 'dark');
  // Chart renklerini yenile
  Charts.renderAll();
}

// ─── Navigation ───────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const page = item.dataset.page;
    UI.showPage(page);
    // Mobilde sidebar kapat
    document.getElementById('sidebar').classList.remove('open');
  });
});

const userMenuBtn = document.getElementById('userMenuBtn');
if (userMenuBtn) {
  userMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    UI.toggleUserMenu();
  });
}

document.addEventListener('click', (event) => {
  if (!event.target.closest('#userPill')) {
    document.getElementById('userDropdown')?.classList.remove('open');
  }
});

// ─── Mobile hamburger ─────────────────────────────
document.getElementById('hamburgerBtn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// Sidebar dışına tıkla → kapat
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('sidebar');
  const hamburger = document.getElementById('hamburgerBtn');
  if (sidebar.classList.contains('open') &&
      !sidebar.contains(e.target) &&
      !hamburger.contains(e.target)) {
    sidebar.classList.remove('open');
  }
});

// ─── Theme toggles ────────────────────────────────
document.getElementById('themeToggle').addEventListener('click', toggleTheme);
document.getElementById('themeToggleDesktop').addEventListener('click', toggleTheme);

// ─── Modal aç/kapat ───────────────────────────────
document.getElementById('addCourseBtn').addEventListener('click', UI.openModal.bind(UI));
document.getElementById('cancelBtn').addEventListener('click', UI.closeModal.bind(UI));
document.getElementById('modalClose').addEventListener('click', UI.closeModal.bind(UI));

document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modalOverlay')) UI.closeModal();
});

// ESC tuşu ile modal kapat
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') UI.closeModal();
});

// ─── Difficulty seçici ────────────────────────────
document.getElementById('difficultySelector').addEventListener('click', (e) => {
  const btn = e.target.closest('.diff-btn');
  if (!btn) return;
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedDifficulty = Number(btn.dataset.level);
});

// ─── Renk seçici ─────────────────────────────────
document.getElementById('colorPicker').addEventListener('click', (e) => {
  const dot = e.target.closest('.color-dot');
  if (!dot) return;
  document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
  dot.classList.add('active');
  selectedColor = dot.dataset.color;
});

// ─── Ders formu gönder ────────────────────────────
document.getElementById('courseForm').addEventListener('submit', (e) => {
  e.preventDefault();

  const name  = document.getElementById('courseName').value.trim();
  const date  = document.getElementById('examDate').value;
  const hours = document.getElementById('dailyHours').value;

  if (!name || !date) {
    UI.toast('Ders adı ve sınav tarihi gerekli!', 'error');
    return;
  }

  const course = DB.addCourse({
    name,
    examDate:   date,
    dailyHours: Number(hours) || 2,
    difficulty: selectedDifficulty,
    color:      selectedColor,
  });

  UI.closeModal();
  UI.toast(`"${name}" eklendi! 📚`);

  // AI günlük öneriyi yenile
  AI.generateDailySuggestion();

  // Aktif sayfayı yenile
  const activePage = document.querySelector('.page.active')?.id?.replace('page-', '');
  if (activePage === 'dashboard') UI.renderDashboard();
  if (activePage === 'courses')   UI.renderCourses();
  if (activePage === 'stats')     UI.renderStats();
  Charts.renderAll();
});

// ─── AI günlük öneri yenile butonu ───────────────
document.getElementById('refreshAI').addEventListener('click', () => {
  AI.generateDailySuggestion();
});

// ─── AI Plan oluştur butonu ───────────────────────
document.getElementById('generatePlanBtn').addEventListener('click', () => {
  AI.generateFullPlan();
});

// ─── Uygulama başlat ──────────────────────────────
function init() {
  Auth.init();
  DB.migrate();
  // Tema uygula
  applyTheme(DB.getTheme());

  // Pomodoro başlat
  Pomodoro.init();

  // Dashboard'u aç
  UI.showPage('dashboard');

  // AI öneri yükle
  AI.generateDailySuggestion();

  // Streak güncelle
  DB.checkAndUpdateStreak();

  console.log('%c⚡ StudyAI başlatıldı!', 'color:#7c3aed;font-size:16px;font-weight:bold');
  UI.hideLoader();

  // Production error boundary (basic).
  window.addEventListener("error", () => {
    UI.toast("Beklenmeyen bir hata olustu. Sayfayi yenilemeyi deneyin.", "error");
  });
  window.addEventListener("unhandledrejection", () => {
    UI.toast("Bir islem tamamlanamadi. Ag baglantinizi kontrol edin.", "error");
  });

  window.addEventListener("online", () => UI.renderSystemStatus());
  window.addEventListener("offline", () => UI.renderSystemStatus());

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {});
    });
  }
}

function setupNewActions() {
  const exportBtn = document.getElementById("exportDataBtn");
  const importBtn = document.getElementById("importDataBtn");
  const importInput = document.getElementById("importJsonInput");
  const saveAIBtn = document.getElementById("saveAISettingsBtn");
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const settingsThemeBtn = document.getElementById("settingsThemeBtn");
  const resetDataBtn = document.getElementById("resetDataBtn");

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const blob = new Blob([DB.exportJSON()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `studyai-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      UI.toast("Veriler JSON olarak disari aktarildi.");
    });
  }

  if (importBtn && importInput) {
    importBtn.addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        DB.importJSON(text);
        applyTheme(DB.getTheme());
        UI.renderDashboard();
        UI.renderCourses();
        UI.renderStats();
        UI.renderPlannerSettings();
        Charts.renderAll();
        UI.toast("Yedek basariyla ice aktarıldi.");
      } catch (error) {
        UI.toast(`Import hatasi: ${error.message}`, "error");
      } finally {
        importInput.value = "";
      }
    });
  }

  if (saveAIBtn) {
    saveAIBtn.addEventListener("click", () => {
      UI.toast("Planlayici ayarlari yerel algoritma ile uygulanir.");
    });
  }

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener("click", () => {
      DB.saveSettings({
        pomodoroWork: Number(document.getElementById("settingsWorkMin").value || 25),
        pomodoroShort: Number(document.getElementById("settingsShortMin").value || 5),
        pomodoroLong: Number(document.getElementById("settingsLongMin").value || 15),
        notifications: document.getElementById("settingsNotifications").checked,
      });
      UI.renderPlannerSettings();
      UI.toast("Ayarlar kaydedildi.");
      Pomodoro.applySettings();
    });
  }

  if (settingsThemeBtn) {
    settingsThemeBtn.addEventListener("click", () => toggleTheme());
  }

  if (resetDataBtn) {
    resetDataBtn.addEventListener("click", () => {
      if (!confirm("Tum veriler sifirlansin mi?")) return;
      const keys = Object.values(DB.KEYS);
      keys.forEach((k) => localStorage.removeItem(k));
      UI.toast("Tum veriler sifirlandi.", "info");
      location.reload();
    });
  }
}

// DOM hazır olunca başlat
document.addEventListener('DOMContentLoaded', () => {
  init();
  setupNewActions();
});
