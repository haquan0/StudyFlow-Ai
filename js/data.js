/* =====================================================
  data.js — Veri yönetimi (localStorage CRUD)
  ===================================================== */

const DB = {
  VERSION: 2,
  _cache: {},
  authenticated: false,
  API_ENDPOINT: './api/tasks.php',

  KEYS: {
    COURSES: "studyai_courses",
    TASKS: "studyai_tasks",
    STREAK: "studyai_streak",
    LAST_DATE: "studyai_last_date",
    POM_STATS: "studyai_pom",
    WEEK_DATA: "studyai_week",
    THEME: "studyai_theme",
    DAILY_LOG: "studyai_daily_log",
    SESSION_HISTORY: "studyai_session_history",
    SETTINGS: "studyai_settings",
    ACHIEVEMENTS: "studyai_achievements",
    ANALYTICS: "studyai_analytics",
    VERSION: "studyai_version",
  },

  get(key) {
    if (Object.prototype.hasOwnProperty.call(this._cache, key)) return this._cache[key];
    try {
      const value = JSON.parse(localStorage.getItem(key)) || null;
      this._cache[key] = value;
      return value;
    } catch {
      return null;
    }
  },

  set(key, val) {
    this._cache[key] = val;
    localStorage.setItem(key, JSON.stringify(val));
  },

  uid(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  },

  dateKey(date = new Date()) {
    return new Date(date).toISOString().slice(0, 10);
  },

  formatToday() {
    return new Date().toDateString();
  },

  migrate() {
    const current = Number(this.get(this.KEYS.VERSION) || 1);
    if (current >= this.VERSION) return;

    const courses = this.getCourses().map((course) => ({
      ...course,
      dailyHours: Number(course.dailyHours || 0),
      completedHours: Number(course.completedHours || 0),
    }));
    this.saveCourses(courses);

    const tasks = this.getTasks().map((task) => ({
      ...task,
      duration: Number(task.duration || 0),
      durationMinutes: Number(task.durationMinutes || Number(task.duration || 0) * 60),
    }));
    this.saveTasks(tasks);

    this.set(this.KEYS.VERSION, this.VERSION);
  },

  getCourses() {
    return this.get(this.KEYS.COURSES) || [];
  },

  saveCourses(courses) {
    this.set(this.KEYS.COURSES, courses);
  },

  addCourse(course) {
    const courses = this.getCourses();
    const newCourse = {
      ...course,
      id: this.uid("course"),
      createdAt: new Date().toISOString(),
      completedHours: Number(course.completedHours || 0),
      dailyHours: Number(course.dailyHours || 2),
    };
    courses.push(newCourse);
    this.saveCourses(courses);
    if (this.authenticated) {
      this.syncToServer().catch(() => {});
    }
    return newCourse;
  },

  deleteCourse(id) {
    const courses = this.getCourses().filter((c) => c.id !== id);
    this.saveCourses(courses);
    const tasks = this.getTasks().filter((t) => t.courseId !== id);
    this.saveTasks(tasks);
    if (this.authenticated) {
      this.syncToServer().catch(() => {});
    }
  },

  updateCourse(id, updates) {
    const courses = this.getCourses().map((c) => (c.id === id ? { ...c, ...updates } : c));
    this.saveCourses(courses);
    if (this.authenticated) {
      this.syncToServer().catch(() => {});
    }
  },

  getTasks() {
    return this.get(this.KEYS.TASKS) || [];
  },

  saveTasks(tasks) {
    this.set(this.KEYS.TASKS, tasks);
  },

  getTodayTasks() {
    const today = this.formatToday();
    return this.getTasks().filter((t) => t.date === today);
  },

  addTask(task) {
    const tasks = this.getTasks();
    const hours = Number(task.duration || 1);
    const newTask = {
      ...task,
      id: this.uid("task"),
      date: this.formatToday(),
      done: false,
      duration: hours,
      durationMinutes: Math.round(hours * 60),
    };
    tasks.push(newTask);
    this.saveTasks(tasks);
    if (this.authenticated) {
      this.syncToServer().catch(() => {});
    }
    return newTask;
  },

  toggleTask(id) {
    const tasks = this.getTasks();
    const task = tasks.find((t) => t.id === id);
    if (!task) return null;

    task.done = !task.done;
    const delta = task.done ? Number(task.duration || 0) : -Number(task.duration || 0);
    this.addCompletedHours(task.courseId, delta);
    if (task.done) {
      this.trackAnalytics("completedTasks", 1);
      this.trackAnalytics("totalStudyHours", Number(task.duration || 0));
    }
    this.saveTasks(tasks);
    this.addSessionEntry({
      type: "task",
      title: task.name,
      courseId: task.courseId,
      minutes: Number(task.durationMinutes || 0),
      done: task.done,
    });
    if (this.authenticated) {
      this.syncToServer().catch(() => {});
    }
    return task;
  },

  addCompletedHours(courseId, hours) {
    const courses = this.getCourses();
    const course = courses.find((c) => c.id === courseId);
    if (course) {
      course.completedHours = Math.max(0, Number(course.completedHours || 0) + Number(hours || 0));
      this.saveCourses(courses);
    }
    this.addDailyHours(Number(hours || 0));
    this.addWeeklyHours(Number(hours || 0));
  },

  getStreak() {
    return this.get(this.KEYS.STREAK) || 0;
  },

  checkAndUpdateStreak() {
    const today = this.formatToday();
    const lastDate = this.get(this.KEYS.LAST_DATE);
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (lastDate === today) return this.getStreak();

    let streak = this.getStreak();
    streak = lastDate === yesterday ? streak + 1 : 1;

    this.set(this.KEYS.STREAK, streak);
    this.set(this.KEYS.LAST_DATE, today);
    return streak;
  },

  getWeekData() {
    const data = this.get(this.KEYS.WEEK_DATA);
    if (!data || data.week !== this.getWeekNumber()) {
      const fresh = { week: this.getWeekNumber(), hours: [0, 0, 0, 0, 0, 0, 0] };
      this.set(this.KEYS.WEEK_DATA, fresh);
      return fresh;
    }
    return data;
  },

  addWeeklyHours(hours) {
    const data = this.getWeekData();
    const dayIdx = new Date().getDay();
    data.hours[dayIdx] = Math.max(0, Number(data.hours[dayIdx] || 0) + Number(hours || 0));
    this.set(this.KEYS.WEEK_DATA, data);
  },

  getWeekNumber() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    return Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  },

  getDailyLog() {
    return this.get(this.KEYS.DAILY_LOG) || {};
  },

  addDailyHours(hours) {
    const key = this.dateKey();
    const log = this.getDailyLog();
    log[key] = Math.max(0, Number(log[key] || 0) + Number(hours || 0));
    this.set(this.KEYS.DAILY_LOG, log);
  },

  getLastNDaysLog(days = 7) {
    const log = this.getDailyLog();
    const labels = [];
    const values = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 86400000);
      const key = this.dateKey(d);
      labels.push(d.toLocaleDateString("tr-TR", { weekday: "short" }));
      values.push(Number(log[key] || 0).toFixed(1));
    }
    return { labels, values: values.map(Number) };
  },

  getPomStats() {
    return this.get(this.KEYS.POM_STATS) || { completed: 0, totalMinutes: 0 };
  },

  addPomSession(minutes) {
    const stats = this.getPomStats();
    stats.completed += 1;
    stats.totalMinutes += minutes;
    this.set(this.KEYS.POM_STATS, stats);
    this.addWeeklyHours(minutes / 60);
    this.addDailyHours(minutes / 60);
    this.addSessionEntry({ type: "pomodoro", title: "Pomodoro", minutes, done: true });
    this.trackAnalytics("pomodoroSessions", 1);
    this.trackAnalytics("totalStudyHours", minutes / 60);
    if (this.authenticated) {
      this.syncToServer().catch(() => {});
    }
  },

  getSessionHistory() {
    return this.get(this.KEYS.SESSION_HISTORY) || [];
  },

  addSessionEntry(entry) {
    const history = this.getSessionHistory();
    history.unshift({
      id: this.uid("session"),
      createdAt: new Date().toISOString(),
      ...entry,
    });
    this.set(this.KEYS.SESSION_HISTORY, history.slice(0, 80));
    if (this.authenticated) {
      this.syncToServer().catch(() => {});
    }
  },

  getTheme() {
    return this.get(this.KEYS.THEME) || "dark";
  },

  setTheme(theme) {
    this.set(this.KEYS.THEME, theme);
  },

  getSettings() {
    return this.get(this.KEYS.SETTINGS) || {
      aiProvider: "gemini",
      aiApiKey: "",
      pomodoroWork: 25,
      pomodoroShort: 5,
      pomodoroLong: 15,
      notifications: true,
    };
  },

  saveSettings(settings) {
    const merged = { ...this.getSettings(), ...settings };
    this.set(this.KEYS.SETTINGS, merged);
    if (this.authenticated) {
      this.syncToServer().catch(() => {});
    }
  },

  setAuthenticated(status) {
    this.authenticated = Boolean(status);
  },

  getSyncPayload() {
    return {
      courses: this.getCourses().map((course) => ({
        id: course.id,
        name: course.name,
        examDate: course.examDate,
        dailyHours: course.dailyHours,
        difficulty: course.difficulty,
        color: course.color,
        completedHours: course.completedHours,
      })),
      tasks: this.getTasks().map((task) => ({
        id: task.id,
        courseId: task.courseId,
        name: task.name,
        date: task.date,
        duration: task.duration,
        durationMinutes: task.durationMinutes,
        done: task.done,
      })),
      achievements: this.getAchievementsWithProgress().map((achievement) => ({
        id: achievement.id,
        unlockedAt: achievement.unlockedAt,
        progress: achievement.progress,
        metadata: { name: achievement.name, desc: achievement.desc },
      })),
      studySessions: this.getSessionHistory().map((session) => ({
        id: session.id,
        type: session.type,
        title: session.title,
        minutes: session.minutes,
        courseId: session.courseId,
        createdAt: session.createdAt,
      })),
      settings: this.getSettings(),
    };
  },

  async syncFromServer() {
    if (!this.authenticated) {
      return;
    }
    try {
      const response = await fetch(`${this.API_ENDPOINT}?type=full`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Sunucudan veri çekilemedi');
      }
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || 'Sunucu hatası');
      }
      const data = payload.data || {};
      if (Array.isArray(data.courses)) this.saveCourses(data.courses.map((course) => ({
        ...course,
        id: course.id,
        examDate: course.exam_date || course.examDate,
        dailyHours: Number(course.daily_hours || course.dailyHours || 2),
        difficulty: Number(course.difficulty || 2),
        color: course.color || '#7c3aed',
        completedHours: Number(course.completed_hours || course.completedHours || 0),
      })));
      if (Array.isArray(data.tasks)) this.saveTasks(data.tasks.map((task) => ({
        ...task,
        id: task.id,
        courseId: task.course_id || task.courseId,
        duration: Number(task.duration || 1),
        durationMinutes: Number(task.duration_minutes || task.durationMinutes || Math.round((task.duration || 1) * 60)),
        done: Boolean(task.done),
      })));
      if (Array.isArray(data.studySessions)) {
        this.set(this.KEYS.SESSION_HISTORY, data.studySessions.map((session) => ({
          id: session.id,
          type: session.type,
          title: session.title,
          minutes: Number(session.minutes || 0),
          courseId: session.course_id || session.courseId,
          createdAt: session.created_at || session.createdAt,
        })));
      }
      if (Array.isArray(data.achievements)) {
        const achievements = {};
        data.achievements.forEach((row) => {
          achievements[row.achievement_key || row.id] = {
            unlockedAt: row.unlocked_at || row.unlockedAt || null,
            progress: Number(row.progress || 0),
            metadata: row.metadata ? row.metadata : null,
          };
        });
        this.saveAchievementState(achievements);
      }
      if (data.settings && typeof data.settings === 'object') {
        this.set(this.KEYS.SETTINGS, data.settings);
      }
      UI.toast('Bulut verileri başarılı şekilde yüklendi.', 'success');
    } catch (error) {
      console.warn('Sync failed', error);
      throw error;
    }
  },

  async syncToServer() {
    if (!this.authenticated) {
      return;
    }
    try {
      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'sync', payload: this.getSyncPayload() }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Sunucuya gönderim hatası');
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Sunucu hatası');
      }
      return result;
    } catch (error) {
      console.warn('Sync to server failed', error);
    }
  },

  exportJSON() {
    const payload = {
      meta: {
        app: "StudyAI",
        version: this.VERSION,
        exportedAt: new Date().toISOString(),
      },
      data: {
        courses: this.getCourses(),
        tasks: this.getTasks(),
        streak: this.getStreak(),
        lastDate: this.get(this.KEYS.LAST_DATE),
        pomStats: this.getPomStats(),
        weekData: this.getWeekData(),
        theme: this.getTheme(),
        dailyLog: this.getDailyLog(),
        sessionHistory: this.getSessionHistory(),
        settings: this.getSettings(),
        achievements: this.getAchievementState(),
        analytics: this.getAnalyticsRaw(),
      },
    };
    return JSON.stringify(payload, null, 2);
  },

  importJSON(raw) {
    const parsed = JSON.parse(raw);
    const data = parsed?.data;
    if (!data) throw new Error("Geçersiz yedek dosyası");

    this.saveCourses(Array.isArray(data.courses) ? data.courses : []);
    this.saveTasks(Array.isArray(data.tasks) ? data.tasks : []);
    this.set(this.KEYS.STREAK, Number(data.streak || 0));
    this.set(this.KEYS.LAST_DATE, data.lastDate || null);
    this.set(this.KEYS.POM_STATS, data.pomStats || { completed: 0, totalMinutes: 0 });
    this.set(this.KEYS.WEEK_DATA, data.weekData || { week: this.getWeekNumber(), hours: [0, 0, 0, 0, 0, 0, 0] });
    this.set(this.KEYS.THEME, data.theme || "dark");
    this.set(this.KEYS.DAILY_LOG, data.dailyLog || {});
    this.set(this.KEYS.SESSION_HISTORY, data.sessionHistory || []);
    this.set(this.KEYS.SETTINGS, data.settings || this.getSettings());
    this.set(this.KEYS.ACHIEVEMENTS, data.achievements || {});
    this.set(this.KEYS.ANALYTICS, data.analytics || this.getAnalyticsRaw());
    this.set(this.KEYS.VERSION, this.VERSION);
  },

  getAnalyticsRaw() {
    return this.get(this.KEYS.ANALYTICS) || {
      totalStudyHours: 0,
      pomodoroSessions: 0,
      completedTasks: 0,
      aiUsageCount: 0,
    };
  },

  trackAnalytics(metric, delta = 1) {
    const data = this.getAnalyticsRaw();
    data[metric] = Number(data[metric] || 0) + Number(delta || 0);
    this.set(this.KEYS.ANALYTICS, data);
  },

  getAnalyticsSummary() {
    const raw = this.getAnalyticsRaw();
    const daily = this.getDailyLog();
    const bestEntry = Object.entries(daily).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
    return {
      totalStudyHours: Number(raw.totalStudyHours || 0).toFixed(1),
      totalPomodoro: Number(raw.pomodoroSessions || 0),
      completedTasks: Number(raw.completedTasks || 0),
      aiUsageCount: Number(raw.aiUsageCount || 0),
      bestDay: bestEntry ? bestEntry[0] : "—",
    };
  },

  ACHIEVEMENT_LIST: [
    { id: "streak_3", emoji: "🔥", name: "3 Gun Seri", desc: "3 gun ust uste aktif ol", check: () => DB.getStreak() >= 3 },
    { id: "streak_7", emoji: "⚡", name: "7 Gun Seri", desc: "7 gun ust uste aktif ol", check: () => DB.getStreak() >= 7 },
    { id: "first_task_done", emoji: "🎯", name: "Ilk Gorev", desc: "Ilk gorevini tamamla", check: (_c, t) => t.some((x) => x.done) },
    { id: "ten_hours", emoji: "📚", name: "10 Saat", desc: "Toplam 10 saat calis", check: (c) => c.reduce((s, x) => s + Number(x.completedHours || 0), 0) >= 10 },
    { id: "ai_plan", emoji: "🤖", name: "AI Plan", desc: "Ilk AI planini olustur", check: () => DB.getTasks().length >= 1 },
  ],

  getAchievementState() {
    return this.get(this.KEYS.ACHIEVEMENTS) || {};
  },

  saveAchievementState(state) {
    this.set(this.KEYS.ACHIEVEMENTS, state);
  },

  evaluateAchievements() {
    const courses = this.getCourses();
    const tasks = this.getTasks();
    const pom = this.getPomStats();
    const state = this.getAchievementState();
    const unlockedNow = [];

    this.ACHIEVEMENT_LIST.forEach((a) => {
      const passed = a.check(courses, tasks, pom);
      if (passed && !state[a.id]) {
        state[a.id] = { unlockedAt: new Date().toISOString() };
        unlockedNow.push(a);
      }
    });
    this.saveAchievementState(state);
    return unlockedNow;
  },

  getAchievementsWithProgress() {
    const state = this.getAchievementState();
    const courses = this.getCourses();
    const tasks = this.getTasks();
    const streak = this.getStreak();
    const doneTasks = tasks.filter((t) => t.done).length;
    const totalHours = courses.reduce((s, x) => s + Number(x.completedHours || 0), 0);

    const progressMap = {
      streak_3: Math.min(100, Math.round((streak / 3) * 100)),
      streak_7: Math.min(100, Math.round((streak / 7) * 100)),
      first_task_done: doneTasks > 0 ? 100 : 0,
      ten_hours: Math.min(100, Math.round((totalHours / 10) * 100)),
      ai_plan: this.getTasks().length > 0 ? 100 : 0,
    };

    return this.ACHIEVEMENT_LIST.map((a) => ({
      ...a,
      unlocked: Boolean(state[a.id]),
      progress: progressMap[a.id] || 0,
      unlockedAt: state[a.id]?.unlockedAt || null,
    }));
  },

  BADGES: [
    { id: "first_course", emoji: "📚", name: "İlk Ders", desc: "İlk dersi ekle", check: (c) => c.length >= 1 },
    { id: "five_courses", emoji: "🎓", name: "5 Ders", desc: "5 ders ekle", check: (c) => c.length >= 5 },
    { id: "first_task", emoji: "✅", name: "İlk Görev", desc: "Bir görevi tamamla", check: (_c, t) => t.filter((x) => x.done).length >= 1 },
    { id: "streak_3", emoji: "🔥", name: "3 Gün Seri", desc: "3 günlük seri yap", check: () => DB.getStreak() >= 3 },
    { id: "streak_7", emoji: "⚡", name: "7 Gün Seri", desc: "7 günlük seri yap", check: () => DB.getStreak() >= 7 },
    { id: "pomodoro_10", emoji: "🍅", name: "Pomodoro Pro", desc: "10 pomodoro tamamla", check: (_c, _t, p) => p.completed >= 10 },
    { id: "all_done", emoji: "🏆", name: "Bugün Tamam!", desc: "Tüm günlük görevleri bitir", check: (_c, t) => {
      const today = t.filter((x) => x.date === DB.formatToday());
      return today.length > 0 && today.every((x) => x.done);
    } },
  ],

  getEarnedBadges() {
    const c = this.getCourses();
    const t = this.getTasks();
    const p = this.getPomStats();
    return this.BADGES.map((b) => ({ ...b, earned: b.check(c, t, p) }));
  },
};
