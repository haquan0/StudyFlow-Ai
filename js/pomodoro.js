/* =====================================================
   pomodoro.js — Pomodoro Timer
   25 dk çalış, 5 dk mola. Klasik odaklanma tekniği.
   ===================================================== */

const Pomodoro = {
  modes: {
    work:  { duration: 25 * 60, label: 'Odaklan! 🎯' },
    short: { duration: 5  * 60, label: 'Kısa mola ☕' },
    long:  { duration: 15 * 60, label: 'Uzun mola 🌿' },
  },

  currentMode: 'work',
  timeLeft: 25 * 60,
  running: false,
  interval: null,

  init() {
    this.applySettings();
    this.updateDisplay();
    this.updateStats();

    // Mod seçici
    document.querySelectorAll('.pom-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.running) return;
        document.querySelectorAll('.pom-mode').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentMode = btn.dataset.mode;
        this.timeLeft = this.modes[this.currentMode].duration;
        this.updateDisplay();
      });
    });

    document.getElementById('pomStart').addEventListener('click', () => this.toggle());
    document.getElementById('pomReset').addEventListener('click', () => this.reset());
  },

  applySettings() {
    const s = DB.getSettings();
    this.modes.work.duration = Number(s.pomodoroWork || 25) * 60;
    this.modes.short.duration = Number(s.pomodoroShort || 5) * 60;
    this.modes.long.duration = Number(s.pomodoroLong || 15) * 60;
    if (!this.running) {
      this.timeLeft = this.modes[this.currentMode].duration;
      this.updateDisplay();
    }
  },

  toggle() {
    if (this.running) {
      clearInterval(this.interval);
      this.running = false;
      document.getElementById('pomStart').textContent = '▶ Devam';
      document.getElementById('pomTimer').classList.remove('pulse');
    } else {
      this.running = true;
      document.getElementById('pomStart').textContent = '⏸ Duraklat';
      document.getElementById('pomTimer').classList.add('pulse');
      this.interval = setInterval(() => this.tick(), 1000);
    }
  },

  tick() {
    this.timeLeft--;
    this.updateDisplay();
    if (this.timeLeft <= 0) {
      this.complete();
    }
  },

  complete() {
    clearInterval(this.interval);
    this.running = false;
    document.getElementById('pomStart').textContent = '▶ Başlat';
    document.getElementById('pomTimer').classList.remove('pulse');

    if (this.currentMode === 'work') {
      DB.addPomSession(25);
      this.updateStats();
      if (DB.getSettings().notifications) UI.toast('Pomodoro tamamlandı! 🍅 Mola zamanı.');
    } else {
      if (DB.getSettings().notifications) UI.toast('Mola bitti! Çalışmaya devam et 💪');
    }

    // Ses bildirimi (tarayıcı izni varsa)
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch {}

    this.reset();
  },

  reset() {
    clearInterval(this.interval);
    this.running = false;
    this.timeLeft = this.modes[this.currentMode].duration;
    document.getElementById('pomStart').textContent = '▶ Başlat';
    document.getElementById('pomTimer').classList.remove('pulse');
    this.updateDisplay();
  },

  updateDisplay() {
    const mins = String(Math.floor(this.timeLeft / 60)).padStart(2, '0');
    const secs = String(this.timeLeft % 60).padStart(2, '0');
    document.getElementById('pomTimer').textContent = `${mins}:${secs}`;
    document.getElementById('pomLabel').textContent = this.modes[this.currentMode].label;

    // Sayfa title'ını da güncelle (minimize edilmiş tab için)
    if (this.running) {
      document.title = `${mins}:${secs} — StudyAI`;
    } else {
      document.title = 'StudyAI — Yapay Zeka Destekli Ders Planlayıcı';
    }
  },

  updateStats() {
    const stats = DB.getPomStats();
    document.getElementById('pomCompleted').textContent = stats.completed;
    document.getElementById('pomTotalMin').textContent  = stats.totalMinutes;
  },
};
