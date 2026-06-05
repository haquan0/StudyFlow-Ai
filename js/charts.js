/* =====================================================
   charts.js — Chart.js grafik wrapper'ları
   Haftalık çalışma, ders dağılımı, zorluk analizi
   ===================================================== */

const Charts = {
  instances: {},
  signatures: {},

  // ─── Ortak renk paleti ────────────────────────────
  gridColor: () => getComputedStyle(document.documentElement)
    .getPropertyValue('--border').trim() || 'rgba(255,255,255,0.07)',

  textColor: () => getComputedStyle(document.documentElement)
    .getPropertyValue('--text-secondary').trim() || '#9898b0',

  destroy(key) {
    if (this.instances[key]) {
      this.instances[key].destroy();
      delete this.instances[key];
    }
  },

  shouldRender(key, signature) {
    if (this.signatures[key] === signature) return false;
    this.signatures[key] = signature;
    return true;
  },

  // ─── Haftalık çalışma bar chart ───────────────────
  renderWeekly() {
    const canvas = document.getElementById('weeklyChart');
    if (!canvas) return;

    const data    = DB.getWeekData();
    const labels  = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    const today   = new Date().getDay();
    const bgColors = labels.map((_, i) =>
      i === today ? 'rgba(124,58,237,0.85)' : 'rgba(124,58,237,0.25)'
    );
    const signature = JSON.stringify(data.hours);
    if (!this.shouldRender("weekly", signature)) return;
    this.destroy('weekly');

    this.instances['weekly'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Çalışma Saati',
          data: data.hours,
          backgroundColor: bgColors,
          borderRadius: 8,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.parsed.y.toFixed(1)} saat`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: this.gridColor() },
            ticks: { color: this.textColor(), font: { family: 'DM Sans', size: 12 } },
          },
          y: {
            grid: { color: this.gridColor() },
            ticks: { color: this.textColor(), font: { family: 'DM Sans', size: 12 },
              callback: v => v + 'h' },
            beginAtZero: true,
          },
        },
      },
    });
  },

  renderDailyFocus() {
    const canvas = document.getElementById("dailyChart");
    if (!canvas) return;
    const log = DB.getLastNDaysLog(7);
    const signature = JSON.stringify(log.values);
    if (!this.shouldRender("daily", signature)) return;
    this.destroy("daily");
    this.instances.daily = new Chart(canvas, {
      type: "line",
      data: {
        labels: log.labels,
        datasets: [{
          label: "Gunluk Calisma (saat)",
          data: log.values,
          borderColor: "#8b5cf6",
          backgroundColor: "rgba(139,92,246,0.2)",
          fill: true,
          tension: 0.35,
          pointRadius: 3,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: this.textColor() }, grid: { color: this.gridColor() } },
          y: { ticks: { color: this.textColor() }, grid: { color: this.gridColor() }, beginAtZero: true },
        },
      },
    });
  },

  // ─── Ders dağılımı doughnut ───────────────────────
  renderDoughnut(courses) {
    const canvas = document.getElementById('doughnutChart');
    if (!canvas) return;
    const signature = JSON.stringify(courses.map((c) => [c.name, c.dailyHours, c.color]));
    if (!this.shouldRender("doughnut", signature)) return;
    this.destroy('doughnut');

    if (!courses.length) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    this.instances['doughnut'] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: courses.map(c => c.name),
        datasets: [{
          data: courses.map(c => Number(c.dailyHours)),
          backgroundColor: courses.map(c => c.color),
          borderColor: 'transparent',
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: this.textColor(),
              font: { family: 'DM Sans', size: 12 },
              padding: 16,
              usePointStyle: true,
              pointStyle: 'circle',
            },
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.parsed}h/gun`,
            },
          },
        },
      },
    });
  },

  // ─── Zorluk analizi bar chart ─────────────────────
  renderDifficulty(courses) {
    const canvas = document.getElementById('difficultyChart');
    if (!canvas) return;
    const signature = JSON.stringify(courses.map((c) => [c.name, c.difficulty]));
    if (!this.shouldRender("difficulty", signature)) return;
    this.destroy('difficulty');

    const diffColors = {
      1: '#10b981', 2: '#3b82f6', 3: '#f59e0b', 4: '#ef4444'
    };
    const diffLabels = { 1: 'Kolay', 2: 'Orta', 3: 'Zor', 4: 'Çok Zor' };

    this.instances['difficulty'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: courses.map(c => c.name),
        datasets: [{
          label: 'Zorluk',
          data: courses.map(c => c.difficulty),
          backgroundColor: courses.map(c => diffColors[c.difficulty] || '#7c3aed'),
          borderRadius: 8,
          borderSkipped: false,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${diffLabels[ctx.parsed.x] || ctx.parsed.x}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: this.gridColor() },
            ticks: {
              color: this.textColor(),
              font: { family: 'DM Sans', size: 12 },
              callback: v => diffLabels[v] || '',
              stepSize: 1,
            },
            min: 0, max: 4,
          },
          y: {
            grid: { display: false },
            ticks: { color: this.textColor(), font: { family: 'DM Sans', size: 12 } },
          },
        },
      },
    });
  },

  // ─── Tüm grafikleri yenile ────────────────────────
  renderAll() {
    const courses = DB.getCourses();
    requestAnimationFrame(() => {
      this.renderWeekly();
      this.renderDailyFocus();
      this.renderDoughnut(courses);
      this.renderDifficulty(courses);
    });
  },
};
