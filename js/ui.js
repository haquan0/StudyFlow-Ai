/* =====================================================
  ui.js — Render, toast, empty-state ve dashboard UX
  ===================================================== */

const UI = {
  healthCache: null,
  healthFetchedAt: 0,
  quotePool: [
    "Basari, duzenli tekrar eden dogru aliskanliklarin toplamidir.",
    "Hedefini netlestir, sonra her gun kucuk adim at.",
    "Plan, motivasyon dalgalanirken bile seni yolda tutar.",
    "Bugun yaptigin calisma, yarinki ozguvenindir.",
  ],

  toast(msg, type = "success") {
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    const icons = { success: "✓", error: "✕", info: "ℹ" };
    el.innerHTML = `<span>${icons[type] || "✓"}</span> ${msg}`;
    document.body.appendChild(el);
    setTimeout(() => {
      el.classList.add("toast-exit");
      el.addEventListener("animationend", () => el.remove());
    }, 2800);
  },

  setUser(user) {
    const display = document.getElementById('userNameDisplay');
    const small = document.getElementById('userNameSmall');
    const avatar = document.querySelector('.user-avatar');
    if (display) display.textContent = user.name || 'StudyAI';
    if (small) small.textContent = user.name || 'StudyAI';
    if (avatar) avatar.textContent = (user.name || 'U').slice(0, 1).toUpperCase();
    document.body.classList.remove('auth-active');
  },

  toggleUserMenu() {
    const menu = document.getElementById('userDropdown');
    if (!menu) return;
    menu.classList.toggle('open');
  },

  showPage(name) {
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));

    const page = document.getElementById(`page-${name}`);
    if (page) page.classList.add("active");
    const navItem = document.querySelector(`[data-page="${name}"]`);
    if (navItem) navItem.classList.add("active");

    const titles = {
      dashboard: ["Dashboard", "Bugun ne calisacagini netlestir ve ilerlemeni takip et."],
      courses: ["Derslerim", "Tum derslerini tek panelden yonet."],
      planner: ["Planlayici", "Akıllı yerel algoritma ile gunluk calisma plani olustur."],
      pomodoro: ["Pomodoro", "Odak modu ile derin calisma yap."],
      stats: ["Istatistikler", "Calisma performansini analiz et."],
      calendar: ["Takvim", "Study timeline, sinavlar ve gunluk plan."],
      achievements: ["Basarilarim", "Kilidi acilan rozetler ve ilerleme."],
      settings: ["Ayarlar", "Pomodoro, bildirim ve veri yonetimi."],
    };
    const [title, sub] = titles[name] || ["StudyAI", ""];
    document.getElementById("pageTitle").textContent = title;
    document.getElementById("pageSub").textContent = sub;

    if (name === "dashboard") this.renderDashboard();
    if (name === "courses") this.renderCourses();
    if (name === "stats") this.renderStats();
    if (name === "planner") this.renderPlannerSettings();
    if (name === "calendar") this.renderCalendar();
    if (name === "achievements") this.renderAchievements();
    if (name === "settings") this.renderSettings();
  },

  renderDashboard() {
    const courses = DB.getCourses();
    const tasks = DB.getTodayTasks();
    const streak = DB.checkAndUpdateStreak();
    const doneTasks = tasks.filter((t) => t.done).length;
    const taskPct = tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0;
    const weeklyTarget = courses.reduce((sum, c) => sum + Number(c.dailyHours || 0) * 7, 0);
    const weeklyDone = courses.reduce((sum, c) => sum + Number(c.completedHours || 0), 0);
    const weeklyPct = weeklyTarget ? Math.min(100, Math.round((weeklyDone / weeklyTarget) * 100)) : 0;

    document.getElementById("totalCourses").textContent = courses.length;
    document.getElementById("streakCount").textContent = streak;
    document.getElementById("todayHours").textContent = `${courses.reduce((s, c) => s + Number(c.dailyHours || 0), 0).toFixed(1)}h`;
    document.getElementById("completedTasks").textContent = `${taskPct}%`;
    document.getElementById("progressPct").textContent = `${taskPct}%`;
    document.getElementById("progressFill").style.width = `${taskPct}%`;
    document.getElementById("taskBadge").textContent = `${tasks.length} gorev`;

    const nextExamEl = document.getElementById("nextExam");
    const next = [...courses].sort((a, b) => new Date(a.examDate) - new Date(b.examDate))[0];
    if (!next) nextExamEl.textContent = "—";
    else {
      const days = Math.ceil((new Date(next.examDate) - Date.now()) / 86400000);
      nextExamEl.textContent = days >= 0 ? `${days}g` : "Gecti";
    }

    document.getElementById("motivationalQuote").textContent = this.quotePool[new Date().getDate() % this.quotePool.length];
    document.getElementById("weeklyProgressText").textContent = `${weeklyPct}%`;
    document.getElementById("weeklyProgressFill").style.width = `${weeklyPct}%`;
    document.getElementById("successRate").textContent = `${Math.round((taskPct + weeklyPct) / 2)}%`;
    document.getElementById("goalCompletionRate").textContent = `${weeklyPct}%`;
    this.renderSystemStatus();
    this.renderAnalyticsSummary();

    this.renderTaskList(tasks);
    this.renderWeeklyGoals(courses);
    this.renderBadges();
    this.checkAndShowAchievements();
    this.renderSessionHistory();
    Charts.renderWeekly();
    Charts.renderDailyFocus();
  },

  async renderSystemStatus() {
    const systemEl = document.getElementById("systemStatus");
    const aiEl = document.getElementById("aiServiceStatus");
    if (!systemEl || !aiEl) return;

    const online = navigator.onLine;
    systemEl.textContent = online ? "Online" : "Offline";
    if (!online) {
      aiEl.textContent = "Offline";
      return;
    }

    const now = Date.now();
    if (!this.healthCache || now - this.healthFetchedAt > 60000) {
      try {
        const resp = await fetch("./api/health");
        if (resp.ok) {
          this.healthCache = await resp.json();
          this.healthFetchedAt = now;
        }
      } catch {
        this.healthCache = null;
      }
    }

    const ok = this.healthCache?.status === "ok";
    systemEl.textContent = ok ? "Healthy" : "Degraded";
    aiEl.textContent = this.healthCache?.activeProvider || "Yerel";
  },

  renderAnalyticsSummary() {
    const el = document.getElementById("analyticsSummary");
    if (!el) return;
    const a = DB.getAnalyticsSummary();
    el.innerHTML = `
      <div class="analytics-item"><span>Toplam Calisma</span><strong>${a.totalStudyHours}h</strong></div>
      <div class="analytics-item"><span>Pomodoro</span><strong>${a.totalPomodoro}</strong></div>
      <div class="analytics-item"><span>Tamamlanan Gorev</span><strong>${a.completedTasks}</strong></div>
      <div class="analytics-item"><span>AI Kullanim</span><strong>${a.aiUsageCount}</strong></div>
      <div class="analytics-item"><span>En Verimli Gun</span><strong>${a.bestDay}</strong></div>
    `;
  },

  checkAndShowAchievements() {
    const unlocked = DB.evaluateAchievements();
    unlocked.forEach((item) => this.showAchievementPopup(item));
  },

  renderTaskList(tasks) {
    const el = document.getElementById("todayTasks");
    if (!tasks.length) {
      el.innerHTML = `<div class="empty-state">
        <span>🚀</span>
        <p>Henuz ders eklemedin.<br/>Sag ustten ders ekleyerek onboarding'i tamamla.</p>
      </div>`;
      return;
    }
    const courses = DB.getCourses();
    el.innerHTML = tasks.map((t) => {
      const course = courses.find((c) => c.id === t.courseId);
      const color = course?.color || "var(--accent)";
      return `<div class="task-item ${t.done ? "done" : ""}" data-id="${t.id}" tabindex="0" role="button" aria-label="Gorev durumunu degistir">
        <div class="task-check">${t.done ? '<span class="tick-in">✓</span>' : ""}</div>
        <div class="task-body">
          <div class="task-name">${t.name}</div>
          <div class="task-meta" style="color:${color}">${course?.name || ""}</div>
        </div>
        <span class="task-duration">${Number(t.duration || 0).toFixed(1)}h</span>
      </div>`;
    }).join("");

    el.querySelectorAll(".task-item").forEach((item) => {
      const toggle = () => {
        const task = DB.toggleTask(item.dataset.id);
        this.renderDashboard();
        if (task?.done) this.toast("Gorev tamamlandi.");
      };
      item.addEventListener("click", toggle);
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") toggle();
      });
    });
  },

  renderWeeklyGoals(courses) {
    const el = document.getElementById("weeklyGoals");
    if (!courses.length) {
      el.innerHTML = '<div class="empty-state small"><p>Ders ekle, haftalik hedefler otomatik olussun.</p></div>';
      return;
    }
    el.innerHTML = courses.slice(0, 5).map((c) => {
      const target = Number(c.dailyHours || 0) * 7;
      const done = Number(c.completedHours || 0);
      const pct = target ? Math.min(100, Math.round((done / target) * 100)) : 0;
      return `<div class="weekly-goal-item">
        <div class="goal-color" style="background:${c.color}"></div>
        <div class="goal-info">
          <div class="goal-name">${c.name}</div>
          <div class="goal-hours">${done.toFixed(1)} / ${target.toFixed(1)}h</div>
        </div>
        <div class="goal-bar-wrap"><div class="goal-bar-fill" style="background:${c.color};width:${pct}%"></div></div>
      </div>`;
    }).join("");
  },

  renderBadges() {
    const badges = DB.getEarnedBadges();
    document.getElementById("badgesGrid").innerHTML = badges.map((b) => `
      <div class="badge-item ${b.earned ? "earned badge-pop" : "locked"}" title="${b.desc}">
        <span class="badge-emoji">${b.emoji}</span>
        <span class="badge-name">${b.name}</span>
      </div>`).join("");
  },

  renderAchievements() {
    const data = DB.getAchievementsWithProgress();
    const el = document.getElementById("achievementsGrid");
    if (!el) return;
    el.innerHTML = data.map((a) => `
      <article class="achievement-card ${a.unlocked ? "unlocked" : ""}">
        <div class="achievement-head">
          <span class="achievement-emoji">${a.emoji}</span>
          <div>
            <h3>${a.name}</h3>
            <p>${a.desc}</p>
          </div>
          <span class="achievement-state">${a.unlocked ? "Unlocked" : `${a.progress}%`}</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${a.progress}%"></div></div>
      </article>
    `).join("");
  },

  showAchievementPopup(item) {
    const popup = document.getElementById("achievementPopup");
    if (!popup) return;
    popup.innerHTML = `<div class="achievement-toast"><span>${item.emoji}</span><div><strong>Achievement Unlocked</strong><p>${item.name}</p></div></div>`;
    popup.classList.add("show");
    setTimeout(() => popup.classList.remove("show"), 2600);
  },

  renderCalendar() {
    const tasks = DB.getTasks();
    const courses = DB.getCourses();
    const timelineEl = document.getElementById("weeklyTimeline");
    const examsEl = document.getElementById("upcomingExams");
    const todayEl = document.getElementById("todayTimeline");
    if (!timelineEl || !examsEl || !todayEl) return;

    const weekBlocks = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(Date.now() + i * 86400000);
      const key = d.toDateString();
      const dayTasks = tasks.filter((t) => t.date === key);
      weekBlocks.push(`<div class="timeline-day ${i === 0 ? "today" : ""}">
        <h4>${d.toLocaleDateString("tr-TR", { weekday: "short", day: "2-digit", month: "2-digit" })}</h4>
        <p>${dayTasks.length} gorev</p>
      </div>`);
    }
    timelineEl.innerHTML = weekBlocks.join("");

    const upcoming = [...courses]
      .map((c) => ({ ...c, days: Math.ceil((new Date(c.examDate) - Date.now()) / 86400000) }))
      .sort((a, b) => a.days - b.days)
      .slice(0, 6);
    examsEl.innerHTML = upcoming.length
      ? upcoming.map((c) => `<div class="exam-item ${c.days <= 7 ? "urgent" : ""}">
          <div class="status-dot" style="background:${c.color}"></div>
          <strong>${c.name}</strong>
          <span>${c.days >= 0 ? `${c.days} gun` : "gecti"}</span>
        </div>`).join("")
      : '<div class="empty-state small"><p>Yaklasan sinav yok.</p></div>';

    const todayTasks = DB.getTodayTasks();
    todayEl.innerHTML = todayTasks.length
      ? todayTasks.map((t) => `<div class="timeline-task ${t.done ? "done" : ""}">
          <span>${t.name}</span>
          <small>${Number(t.duration || 0).toFixed(1)}h</small>
        </div>`).join("")
      : '<div class="empty-state small"><p>Bugun icin plan gorevi yok.</p></div>';
  },

  renderCourses() {
    const courses = DB.getCourses();
    const el = document.getElementById("coursesGrid");
    if (!courses.length) {
      el.innerHTML = `<div class="empty-state large"><span>📘</span><p>Henuz ders yok. Ilk dersi ekleyerek basla.</p></div>`;
      return;
    }

    const diffLabels = { 1: "Kolay", 2: "Orta", 3: "Zor", 4: "Cok Zor" };
    el.innerHTML = courses.map((c) => {
      const daysLeft = Math.ceil((new Date(c.examDate) - Date.now()) / 86400000);
      const target = Number(c.dailyHours || 0) * 7;
      const done = Number(c.completedHours || 0);
      const pct = target ? Math.min(100, Math.round((done / target) * 100)) : 0;
      return `<div class="course-card" style="--course-color:${c.color}" data-id="${c.id}">
        <div class="course-card-header">
          <span class="course-name">${c.name}</span>
          <div class="course-actions"><button class="course-action-btn delete-btn" data-id="${c.id}" aria-label="Dersi sil">🗑</button></div>
        </div>
        <div class="course-meta">
          <div class="course-meta-row"><span class="course-meta-icon">📅</span> Sinav: ${new Date(c.examDate).toLocaleDateString("tr-TR")} (${daysLeft >= 0 ? `${daysLeft} gun` : "gecti"})</div>
          <div class="course-meta-row"><span class="course-meta-icon">⏱</span> ${Number(c.dailyHours || 0).toFixed(1)} saat/gun</div>
          <div class="course-meta-row"><span class="course-difficulty diff-${c.difficulty}">${diffLabels[c.difficulty] || "Orta"}</span></div>
        </div>
        <div class="course-meta-row" style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Tamamlanan: ${done.toFixed(1)}h / ${target.toFixed(1)}h</div>
        <div class="course-progress-bar"><div class="course-progress-fill" style="width:${pct}%"></div></div>
      </div>`;
    }).join("");

    el.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!confirm("Bu dersi silmek istiyor musun?")) return;
        DB.deleteCourse(btn.dataset.id);
        this.renderCourses();
        this.renderDashboard();
        Charts.renderAll();
        this.toast("Ders silindi.", "info");
      });
    });
  },

  renderPlannerOutput(plan) {
    const el = document.getElementById("plannerOutput");
    if (!plan.length) {
      el.innerHTML = '<div class="empty-state large"><span>🧠</span><p>Plan olusturmak icin once ders eklemelisin.</p></div>';
      return;
    }
    const priorityLabel = { high: "Yuksek", mid: "Orta", low: "Dusuk" };
    el.innerHTML = plan.map((item) => `
      <div class="plan-card animate-in">
        <div class="plan-card-header">
          <div class="plan-course-dot" style="background:${item.color}"></div>
          <span class="plan-course-name">${item.courseName}</span>
          <span class="plan-priority priority-${item.priority}">${priorityLabel[item.priority] || "Orta"}</span>
        </div>
        <div class="plan-time">${Number(item.hours).toFixed(1)}<span>h/gun</span></div>
        <div class="plan-desc">${item.description || ""}</div>
        ${item.topics?.length ? `<div class="plan-topics">${item.topics.map((t) => `<span class="plan-topic">${t}</span>`).join("")}</div>` : ""}
      </div>`).join("");
  },

  renderStats() {
    const courses = DB.getCourses();
    Charts.renderDoughnut(courses);
    Charts.renderDifficulty(courses);

    const el = document.getElementById("statsTable");
    const diffLabels = { 1: "Kolay", 2: "Orta", 3: "Zor", 4: "Cok Zor" };
    if (!courses.length) {
      el.innerHTML = '<div class="empty-state"><p>Istatistik icin veri yok.</p></div>';
      return;
    }
    el.innerHTML = `
      <div class="stats-row header"><span>Ders</span><span>Sure</span><span>Tamam</span><span>Zorluk</span><span>Kalan</span></div>
      ${courses.map((c) => {
        const days = Math.ceil((new Date(c.examDate) - Date.now()) / 86400000);
        return `<div class="stats-row">
          <div class="stats-row-name"><div style="width:10px;height:10px;border-radius:50%;background:${c.color};flex-shrink:0"></div>${c.name}</div>
          <span>${Number(c.dailyHours || 0).toFixed(1)}h</span>
          <span>${Number(c.completedHours || 0).toFixed(1)}h</span>
          <span>${diffLabels[c.difficulty] || "Orta"}</span>
          <span style="color:${days < 7 ? "var(--danger)" : "var(--text-secondary)"}">${days >= 0 ? `${days} gun` : "gecti"}</span>
        </div>`;
      }).join("")}`;
  },

  renderSessionHistory() {
    const list = DB.getSessionHistory().slice(0, 6);
    const el = document.getElementById("sessionHistory");
    if (!el) return;
    if (!list.length) {
      el.innerHTML = '<div class="empty-state small"><p>Henuz session gecmisi yok.</p></div>';
      return;
    }
    el.innerHTML = list.map((s) => `<div class="history-item">
      <div><strong>${s.title}</strong><p>${new Date(s.createdAt).toLocaleString("tr-TR")}</p></div>
      <span>${Number(s.minutes || 0)} dk</span>
    </div>`).join("");
  },

  renderPlannerSettings() {
    const settings = DB.getSettings();
    const statusText = document.getElementById("aiStatusText");
    if (!statusText) return;
    statusText.textContent = "Planlayici, tarayici tabanli yerel algoritma ile calisir.";
  },

  renderSettings() {
    const s = DB.getSettings();
    document.getElementById("settingsWorkMin").value = s.pomodoroWork || 25;
    document.getElementById("settingsShortMin").value = s.pomodoroShort || 5;
    document.getElementById("settingsLongMin").value = s.pomodoroLong || 15;
    document.getElementById("settingsNotifications").checked = Boolean(s.notifications);
  },

  openModal() {
    document.getElementById("modalOverlay").classList.add("open");
    document.getElementById("courseName").focus();
  },

  closeModal() {
    document.getElementById("modalOverlay").classList.remove("open");
    document.getElementById("courseForm").reset();
    document.querySelectorAll(".diff-btn").forEach((b) => b.classList.remove("active"));
    document.querySelector('.diff-btn[data-level="2"]').classList.add("active");
    document.querySelectorAll(".color-dot").forEach((b) => b.classList.remove("active"));
    document.querySelector('.color-dot[data-color="#7c3aed"]').classList.add("active");
  },

  renderAISuggestion(text, motivation) {
    document.getElementById("aiSuggestion").innerHTML = `<p>${text}</p>`;
    document.getElementById("motivationText").textContent = motivation;
  },

  setAIThinking(loading, text = "AI dusunuyor...") {
    const el = document.getElementById("aiSuggestion");
    if (!el) return;
    if (loading) {
      el.innerHTML = `<div class="ai-thinking"><span class="spinner"></span><p>${text}</p></div>`;
    }
  },

  setPlannerLoading(loading, text = "Yukleniyor...") {
    const btn = document.getElementById("generatePlanBtn");
    if (!btn) return;
    btn.disabled = loading;
    btn.innerHTML = loading ? `<span class="spinner"></span> ${text}` : "⚡ Plan Olustur";
    if (loading) {
      document.getElementById("plannerOutput").innerHTML = `
      <div class="plan-card skeleton" style="height:160px"></div>
      <div class="plan-card skeleton" style="height:160px"></div>`;
    }
  },

  hideLoader() {
    const loader = document.getElementById("appLoader");
    if (!loader) return;
    loader.classList.add("hide");
    setTimeout(() => loader.remove(), 350);
  },
};
