/* =====================================================
  ai.js — Yerel akıllı planlayıcı ve öneri motoru
  ===================================================== */

const AI = {
  getCoursePriority(course) {
    const daysLeft = Math.max(0, Math.ceil((new Date(course.examDate) - Date.now()) / 86400000));
    return daysLeft * 0.65 + (5 - Number(course.difficulty || 2)) * 0.35;
  },

  getTopCourse(courses) {
    return [...courses].sort((a, b) => this.getCoursePriority(a) - this.getCoursePriority(b))[0];
  },

  async generateDailySuggestion() {
    const courses = DB.getCourses();
    if (!courses.length) {
      UI.renderAISuggestion(
        "Henuz ders eklemedin. Once bir ders olusturalim, sonra bugun ne calisman gerektigini netlestirelim.",
        "Buyuk hedefler, kucuk ama duzenli adimlarla tamamlanir."
      );
      return;
    }

    const top = this.getTopCourse(courses);
    const daysLeft = Math.ceil((new Date(top.examDate) - Date.now()) / 86400000);
    UI.setAIThinking(true, "Akıllı öneri hazırlanıyor...");
    DB.trackAnalytics("aiUsageCount", 1);

    UI.renderAISuggestion(this.localSuggestion(top, daysLeft), this.localMotivation());
    UI.setAIThinking(false);
  },

  async generateFullPlan() {
    const courses = DB.getCourses();
    if (!courses.length) {
      UI.renderPlannerOutput([]);
      return;
    }

    UI.setPlannerLoading(true, "Plan olusturuluyor...");
    DB.trackAnalytics("aiUsageCount", 1);

    const plan = this.localPlan(courses);
    UI.renderPlannerOutput(plan);
    this.createTasksFromPlan(plan);
    UI.toast("Akıllı plan hazir. Gorevler guncellendi.");
    UI.setPlannerLoading(false);
  },

  createTasksFromPlan(plan) {
    const courses = DB.getCourses();
    const tasks = DB.getTasks().filter((t) => t.date !== DB.formatToday());
    DB.saveTasks(tasks);

    plan.forEach((item) => {
      const course = courses.find((c) => c.name === item.courseName);
      if (!course) return;
      DB.addTask({
        name: `${item.courseName} calis`,
        courseId: course.id,
        duration: Number(item.hours || 1),
      });
    });
  },

  getSettings() {
    return DB.getSettings();
  },

  localSuggestion(course, daysLeft) {
    const urgency = daysLeft < 3 ? "Kritik" : daysLeft < 7 ? "Acil" : "Dengeli";
    return `${urgency} odak: Bugun ${course.name} dersiyle basla. ${Math.max(
      1,
      Number(course.dailyHours || 2)
    )} saat hedef koy ve son 30 dakikayi soru cozume ayir.`;
  },

  localMotivation() {
    const msgs = [
      "Baslamak, en zor bolumu bitirmek demektir.",
      "Planli calisma, sinav stresini azaltir.",
      "Her gun kucuk ilerleme buyuk fark yaratir.",
      "Disiplin, motivasyon yokken de seni ileri tasir.",
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
  },

  localPlan(courses) {
    const diffWeight = { 1: 0.8, 2: 1, 3: 1.35, 4: 1.75 };
    return courses
      .map((c) => {
        const daysLeft = Math.max(1, Math.ceil((new Date(c.examDate) - Date.now()) / 86400000));
        const urgency = daysLeft < 4 ? 1.7 : daysLeft < 8 ? 1.35 : 1.1;
        const hours = Math.round(Math.min(8, Number(c.dailyHours || 2) * (diffWeight[c.difficulty] || 1) * urgency) * 2) / 2;
        const priority = daysLeft < 5 || c.difficulty >= 3 ? "high" : daysLeft < 14 ? "mid" : "low";
        return {
          courseName: c.name,
          color: c.color,
          hours,
          priority,
          description: `${c.name} icin tekrar + soru cozum odakli calisma.`,
          topics: ["Konu tekrari", "Soru cozumu", "Hata analizi"],
        };
      })
      .sort((a, b) => ({ high: 0, mid: 1, low: 2 }[a.priority] - { high: 0, mid: 1, low: 2 }[b.priority]));
  },
};
