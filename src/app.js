// ==========================================================================
// STATE MANAGEMENT & LOCAL STORAGE
// ==========================================================================
const DEFAULT_HABITS = [
  {
    id: 'h1',
    name: 'Drink 16 fl oz of Water',
    color: '#a78bfa',
    goal: 30,
    activeDays: [1, 2, 3, 4, 5, 6, 0], // Every day
    history: {}
  },
  {
    id: 'h2',
    name: 'Play Tennis / Exercise',
    color: '#60a5fa',
    goal: 10,
    activeDays: [1, 3, 5], // Mon, Wed, Fri
    history: {}
  },
  {
    id: 'h3',
    name: 'Read 10 Pages of a Book',
    color: '#f87171',
    goal: 20,
    activeDays: [1, 2, 3, 4, 5, 6, 0],
    history: {}
  },
  {
    id: 'h4',
    name: 'Mindful Meditation',
    color: '#34d399',
    goal: 15,
    activeDays: [1, 2, 3, 4, 5, 6, 0],
    history: {}
  }
];

class HabitTrackerApp {
  constructor() {
    this.habits = [];
    this.currentDate = new Date(); // Tracks the currently viewed month/year in dashboard
    this.today = new Date();      // Static reference to today
    this.config = {
      isWidgetMode: true,
      alwaysOnTop: true,
      theme: 'theme-obsidian'
    };
    
    this.init();
  }

  async init() {
    // Load config and data from main process
    if (window.electronAPI) {
      try {
        const loadedConfig = await window.electronAPI.getConfig();
        if (loadedConfig) {
          this.config = { ...this.config, ...loadedConfig };
        }
        
        const loadedHabits = await window.electronAPI.loadHabits();
        if (loadedHabits && Array.isArray(loadedHabits) && loadedHabits.length > 0) {
          this.habits = loadedHabits;
        } else {
          this.habits = this.generateSampleHistory(DEFAULT_HABITS);
          await this.saveHabits();
        }
      } catch (err) {
        console.error('Failed to load from Electron API, using fallback data', err);
        this.loadFallbackData();
      }
    } else {
      this.loadFallbackData();
    }

    // Apply configuration
    this.applyAlwaysOnTopUI(this.config.alwaysOnTop);
    
    // Set UI mode
    this.setWindowMode(this.config.isWidgetMode);
    
    // Set Theme
    this.applyTheme(this.config.theme);

    // Setup event listeners
    this.setupEventListeners();

    // Render App
    this.render();
    
    // Render settings
    this.renderSettingsHabits();
    
    // Initialize Lucide Icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // Generates some realistic sample history for the current and previous months
  generateSampleHistory(habits) {
    const today = new Date();
    const result = JSON.parse(JSON.stringify(habits));
    
    result.forEach(h => {
      // Set some random checkmarks in the last 40 days
      for (let i = 1; i <= 40; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = this.formatDate(date);
        
        // Match active day of week
        if (h.activeDays.includes(date.getDay())) {
          // 65% chance of completing the habit
          if (Math.random() < 0.65) {
            h.history[dateStr] = true;
          }
        }
      }
    });
    
    return result;
  }

  loadFallbackData() {
    // Local storage fallback for browser testing
    const localHabits = localStorage.getItem('habits');
    if (localHabits) {
      this.habits = JSON.parse(localHabits);
    } else {
      this.habits = this.generateSampleHistory(DEFAULT_HABITS);
      localStorage.setItem('habits', JSON.stringify(this.habits));
    }
  }

  async saveHabits() {
    if (window.electronAPI) {
      await window.electronAPI.saveHabits(this.habits);
    } else {
      localStorage.setItem('habits', JSON.stringify(this.habits));
    }
  }

  // ==========================================================================
  // RENDER INTERFACE
  // ==========================================================================
  render() {
    // Update dates in header
    this.updateDateDisplays();

    if (this.config.isWidgetMode) {
      this.renderWidgetView();
    } else {
      this.renderDashboardView();
    }
  }

  updateDateDisplays() {
    // Today date displays
    const optionsDay = { weekday: 'long' };
    const optionsDate = { month: 'long', day: 'numeric', year: 'numeric' };
    
    document.getElementById('widget-date-day').innerText = this.today.toLocaleDateString('en-US', optionsDay);
    document.getElementById('widget-date-full').innerText = this.today.toLocaleDateString('en-US', optionsDate);

    // Dashboard Month/Year display
    const monthYearStr = this.currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    document.getElementById('current-month-year').innerText = monthYearStr;
  }

  // Renders the small widget UI
  renderWidgetView() {
    const todayStr = this.formatDate(this.today);
    const dayOfWeek = this.today.getDay();
    const quickList = document.getElementById('quick-habits-list');
    quickList.innerHTML = '';

    // Filter habits active for today
    const activeToday = this.habits.filter(h => h.activeDays.includes(dayOfWeek));

    if (activeToday.length === 0) {
      quickList.innerHTML = `
        <div class="empty-state">
          <i data-lucide="plus-circle"></i>
          <p>No habits active for today.</p>
          <button class="btn-primary btn-sm" id="widget-add-habit-empty-btn">Add Habit</button>
        </div>
      `;
      document.getElementById('widget-add-habit-empty-btn')?.addEventListener('click', () => this.openSettings('tab-add-new'));
      
      this.updateWidgetProgress(0, 0);
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    let completedCount = 0;

    activeToday.forEach(h => {
      const isCompleted = h.history[todayStr] === true;
      if (isCompleted) completedCount++;

      const streak = this.calculateStreak(h);
      const monthlyProgress = this.calculateMonthlyCompletedCount(h, this.today.getMonth(), this.today.getFullYear());

      const item = document.createElement('div');
      item.className = `widget-habit-item ${isCompleted ? 'completed' : ''}`;
      item.style.setProperty('--habit-color', h.color);
      item.style.setProperty('--habit-glow', this.hexToRgba(h.color, 0.4));
      
      item.innerHTML = `
        <div class="widget-habit-left">
          <button class="habit-checkbox-btn" aria-label="Toggle Complete">
            <i data-lucide="check"></i>
          </button>
          <div class="widget-habit-info">
            <span class="widget-habit-name">${h.name}</span>
            ${streak > 1 ? `
              <span class="widget-habit-streak">
                <i data-lucide="flame"></i> ${streak} day streak
              </span>
            ` : ''}
          </div>
        </div>
        <div class="widget-habit-stats">
          ${monthlyProgress}/${h.goal}
        </div>
      `;

      // Toggle status on entire item click or checkbox click
      item.addEventListener('click', async (e) => {
        // Prevent double click trigger if checkbox is clicked directly
        e.stopPropagation();
        await this.toggleHabitStatus(h.id, todayStr);
      });

      quickList.appendChild(item);
    });

    this.updateWidgetProgress(completedCount, activeToday.length);
    if (window.lucide) window.lucide.createIcons();
  }

  updateWidgetProgress(completed, total) {
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    // Update text
    document.getElementById('widget-percent').innerText = `${percent}%`;
    document.getElementById('widget-completed-count').innerText = completed;
    document.getElementById('widget-total-count').innerText = total;

    // Update Motivation Subtext
    const motivationEl = document.getElementById('widget-motivation');
    if (percent === 100) {
      motivationEl.innerText = "Amazing! All done for today! 🎉";
    } else if (percent >= 75) {
      motivationEl.innerText = "Almost there! Keep it up! 💪";
    } else if (percent >= 50) {
      motivationEl.innerText = "Halfway done, doing great! 👍";
    } else if (percent > 0) {
      motivationEl.innerText = "Great start, keep moving! 🚀";
    } else {
      motivationEl.innerText = "Let's complete your first habit! ✨";
    }

    // Update SVG Stroke Offset
    // Circumference = 2 * PI * r = 2 * 3.14159 * 45 = 282.74
    const circle = document.getElementById('widget-progress-fill');
    if (circle) {
      const circumference = 282.74;
      const offset = circumference - (percent / 100) * circumference;
      circle.style.strokeDashoffset = offset;
    }
  }

  // Renders the full monthly spreadsheet dashboard UI
  renderDashboardView() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth(); // 0-indexed
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // 1. Render Table Date Headers
    this.renderTableHeaders(year, month, daysInMonth);

    // 2. Render Habit Rows
    const tbody = document.getElementById('spreadsheet-body');
    tbody.innerHTML = '';

    if (this.habits.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${daysInMonth + 3}" style="padding: 40px; text-align: center; color: var(--text-muted);">
            <i data-lucide="clipboard-list" style="width: 48px; height: 48px; stroke-width: 1.5; margin-bottom: 12px; opacity: 0.6;"></i>
            <p style="font-size: 14px;">No habits defined yet. Click "Manage Habits" to add your first habit!</p>
          </td>
        </tr>
      `;
      this.renderEmptyFooter(daysInMonth);
      this.renderWeeklyStatsSummary(daysInMonth, year, month);
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    this.habits.forEach(h => {
      const row = document.createElement('tr');
      row.className = 'habit-row';
      row.style.setProperty('--habit-color', h.color);

      // A. Sticky Name Column
      let rowHtml = `
        <td class="sticky-col">
          <div class="habit-row-name-container">
            <span class="habit-icon-indicator" style="--habit-color: ${h.color}"></span>
            <span class="habit-row-title-text" title="${h.name}">${h.name}</span>
          </div>
        </td>
      `;

      // B. Checkboxes for Days
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = this.formatDate(new Date(year, month, day));
        const isChecked = h.history[dateStr] === true;
        const weekNum = this.getWeekNumberInMonth(day);
        
        rowHtml += `
          <td class="day-cell" data-day="${day}">
            <div class="grid-checkbox ${isChecked ? `checked w${weekNum}` : ''}" data-habit-id="${h.id}" data-date="${dateStr}">
              <div class="chk-box">
                <i data-lucide="check"></i>
              </div>
            </div>
          </td>
        `;
      }

      // C. Sticky Goal Column
      rowHtml += `
        <td class="goal-col">
          <input type="number" class="goal-input" data-habit-id="${h.id}" value="${h.goal}" min="1" max="31">
        </td>
      `;

      // D. Sticky Progress Column
      const monthlyCompletions = this.calculateMonthlyCompletedCount(h, month, year);
      const progressPercent = Math.min(Math.round((monthlyCompletions / h.goal) * 100), 100);
      
      rowHtml += `
        <td class="progress-col">
          <div class="progress-cell-wrapper">
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
            </div>
            <div class="progress-text">
              <span>${progressPercent}%</span>
              <span>${monthlyCompletions}/${h.goal}</span>
            </div>
          </div>
        </td>
      `;

      row.innerHTML = rowHtml;

      // Event listener for toggle click
      row.querySelectorAll('.grid-checkbox').forEach(box => {
        box.addEventListener('click', async () => {
          const habitId = box.dataset.habitId;
          const date = box.dataset.date;
          await this.toggleHabitStatus(habitId, date);
        });
      });

      // Event listener for goal changes
      row.querySelector('.goal-input').addEventListener('change', async (e) => {
        const habitId = e.target.dataset.habitId;
        const newGoal = parseInt(e.target.value) || 1;
        await this.updateHabitGoal(habitId, newGoal);
      });

      tbody.appendChild(row);
    });

    // 3. Render Table Footer Statistics (Dynamic counts per day and week charts)
    this.renderTableFooter(year, month, daysInMonth);

    // 4. Render Bottom Weekly Stats Dashboard
    this.renderWeeklyStatsSummary(daysInMonth, year, month);

    // 5. Render Analytics & Insights Section
    this.renderAnalytics(year, month, daysInMonth);

    if (window.lucide) window.lucide.createIcons();
  }

  // Helper to get week number (1 to 5) for partitioning the spreadsheet columns
  getWeekNumberInMonth(day) {
    if (day <= 7) return 1;
    if (day <= 14) return 2;
    if (day <= 21) return 3;
    if (day <= 28) return 4;
    return 5;
  }

  renderTableHeaders(year, month, daysInMonth) {
    // Generate dates row cells
    const dateHeadersRow = document.getElementById('date-headers-row');
    dateHeadersRow.innerHTML = '';

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'narrow' }); // M, T, W...
      
      const th = document.createElement('th');
      const weekNum = this.getWeekNumberInMonth(day);
      th.className = `date-cell-hdr w${weekNum}-color`;
      th.innerHTML = `
        <div style="font-size: 11px; font-weight: 800;">${day}</div>
        <div style="font-size: 9px; font-weight: 500; color: var(--text-secondary); opacity: 0.8; margin-top: 1px;">${dayName}</div>
      `;
      dateHeadersRow.appendChild(th);
    }

    // Dynamic colspan for week 5 depending on number of days in month (28, 29, 30, or 31)
    const w5Colspan = daysInMonth - 28;
    const weekHeadersRow = document.getElementById('week-headers-row');
    
    // Reconstruct the week headers row with dynamic colspan
    weekHeadersRow.innerHTML = `
      <th class="sticky-col habit-col-header" rowspan="2">Habits</th>
      <th colspan="7" class="week-hdr week-1-color">Week 1</th>
      <th colspan="7" class="week-hdr week-2-color">Week 2</th>
      <th colspan="7" class="week-hdr week-3-color">Week 3</th>
      <th colspan="7" class="week-hdr week-4-color">Week 4</th>
      ${w5Colspan > 0 ? `<th colspan="${w5Colspan}" class="week-hdr week-5-color">Week 5</th>` : ''}
      <th class="goal-col-header" rowspan="2">Goal</th>
      <th class="progress-col-header" rowspan="2">Progress</th>
    `;
  }

  renderTableFooter(year, month, daysInMonth) {
    const tfoot = document.getElementById('spreadsheet-footer');
    tfoot.innerHTML = '';

    // Calculate completions and incompletes per day
    const completedCounts = Array(daysInMonth + 1).fill(0);
    const incompleteCounts = Array(daysInMonth + 1).fill(0);

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = this.formatDate(new Date(year, month, day));
      this.habits.forEach(h => {
        if (h.history[dateStr] === true) {
          completedCounts[day]++;
        } else {
          incompleteCounts[day]++;
        }
      });
    }

    // A. "Habits Completed" Row
    const compRow = document.createElement('tr');
    compRow.className = 'summary-row habits-completed-row';
    let compHtml = `<td class="sticky-col">Habits Completed</td>`;
    for (let day = 1; day <= daysInMonth; day++) {
      compHtml += `<td class="summary-val">${completedCounts[day]}</td>`;
    }
    compHtml += `<td class="goal-col"></td><td class="progress-col"></td>`;
    compRow.innerHTML = compHtml;
    tfoot.appendChild(compRow);

    // B. "Habits Incomplete" Row
    const incompRow = document.createElement('tr');
    incompRow.className = 'summary-row habits-incomplete-row';
    let incompHtml = `<td class="sticky-col">Habits Incomplete</td>`;
    for (let day = 1; day <= daysInMonth; day++) {
      incompHtml += `<td class="summary-val">${incompleteCounts[day]}</td>`;
    }
    incompHtml += `<td class="goal-col"></td><td class="progress-col"></td>`;
    incompRow.innerHTML = incompHtml;
    tfoot.appendChild(incompRow);
  }

  renderEmptyFooter(daysInMonth) {
    const tfoot = document.getElementById('spreadsheet-footer');
    tfoot.innerHTML = `
      <tr class="summary-row">
        <td class="sticky-col">Habits Completed</td>
        ${Array(daysInMonth).fill('<td>-</td>').join('')}
        <td class="goal-col"></td><td class="progress-col"></td>
      </tr>
    `;
  }

  // Renders the bottom weekly donut summaries (matches user spreadsheet bottom section)
  renderWeeklyStatsSummary(daysInMonth, year, month) {
    const container = document.getElementById('weekly-donut-container');
    container.innerHTML = '';

    const weeks = [
      { name: 'Week 1', start: 1, end: 7, class: 'w1-color', border: 'var(--w1-accent)' },
      { name: 'Week 2', start: 8, end: 14, class: 'w2-color', border: 'var(--w2-accent)' },
      { name: 'Week 3', start: 15, end: 21, class: 'w3-color', border: 'var(--w3-accent)' },
      { name: 'Week 4', start: 22, end: 28, class: 'w4-color', border: 'var(--w4-accent)' },
      { name: 'Week 5', start: 29, end: daysInMonth, class: 'w5-color', border: 'var(--w5-accent)' }
    ];

    weeks.forEach((w, idx) => {
      // If Week 5 has no days in the current month (e.g. leap years or if we had a weird month layout)
      if (w.start > daysInMonth) return;

      const numDays = w.end - w.start + 1;
      const totalPossible = this.habits.length * numDays;
      
      let completedCount = 0;
      for (let d = w.start; d <= w.end; d++) {
        const dateStr = this.formatDate(new Date(year, month, d));
        this.habits.forEach(h => {
          if (h.history[dateStr] === true) completedCount++;
        });
      }

      const incompleteCount = Math.max(0, totalPossible - completedCount);
      const percent = totalPossible > 0 ? Math.round((completedCount / totalPossible) * 100) : 0;

      // Create dynamic SVG circular chart
      // Circumference = 2 * PI * r = 2 * 3.14159 * 20 = 125.66
      const circ = 125.66;
      const offset = circ - (percent / 100) * circ;

      const card = document.createElement('div');
      card.className = 'weekly-stat-card';
      card.innerHTML = `
        <div class="stat-chart-wrapper">
          <svg class="mini-donut-svg" width="50" height="50">
            <circle class="mini-donut-bg" stroke="rgba(255,255,255,0.06)" stroke-width="5" fill="transparent" r="20" cx="25" cy="25" />
            <circle class="mini-donut-fill" stroke="${w.border}" stroke-width="5" fill="transparent" r="20" cx="25" cy="25" 
              stroke-dasharray="${circ}" stroke-dashoffset="${offset}" />
          </svg>
          <div style="position: absolute; display: flex; align-items: center; justify-content: center;">
            <span class="mini-donut-text" style="color: ${w.border}">${percent}%</span>
          </div>
        </div>
        <div class="stat-info">
          <span class="week-title" style="color: ${w.border}">${w.name}</span>
          <span class="week-detail">Completions: <strong style="color: var(--text-primary);">${completedCount}</strong></span>
          <span class="week-detail">Incomplete: <strong style="color: var(--text-primary);">${incompleteCount}</strong></span>
        </div>
      `;

      container.appendChild(card);
    });
  }

  // ==========================================================================
  // ANALYTICS & INSIGHTS RENDERING
  // ==========================================================================
  renderAnalytics(year, month, daysInMonth) {
    if (this.habits.length === 0) return;

    this.renderHeatmap();
    this.renderTrendChart(year, month, daysInMonth);
    this.renderInsights();
  }

  renderHeatmap() {
    const grid = document.getElementById('heatmap-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // Last 30 days
    const daysToShow = 30;
    const today = new Date(this.today);
    
    // We want to show oldest to newest (left to right, top to bottom)
    const dates = [];
    for (let i = daysToShow - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dates.push(d);
    }

    dates.forEach(date => {
      const dateStr = this.formatDate(date);
      let completedCount = 0;
      let activeCount = 0;

      this.habits.forEach(h => {
        if (h.activeDays.includes(date.getDay())) activeCount++;
        if (h.history[dateStr]) completedCount++;
      });

      let level = 0;
      if (activeCount > 0) {
        const percent = completedCount / activeCount;
        if (percent > 0) level = 1;
        if (percent >= 0.33) level = 2;
        if (percent >= 0.66) level = 3;
        if (percent >= 1) level = 4;
      }

      const cell = document.createElement('div');
      cell.className = `heatmap-cell level-${level}`;
      
      const displayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const tooltipText = activeCount === 0 
        ? `${displayDate}: Rest Day` 
        : `${displayDate}: ${completedCount}/${activeCount} completed`;
        
      cell.setAttribute('data-tooltip', tooltipText);
      grid.appendChild(cell);
    });
  }

  renderTrendChart(year, month, daysInMonth) {
    const pathFill = document.getElementById('chart-area-path');
    const pathLine = document.getElementById('chart-line-path');
    const labelsContainer = document.getElementById('chart-dates-labels');
    
    if (!pathFill || !pathLine || !labelsContainer) return;

    const width = 500;
    const height = 150;
    
    // Get daily completions for the month
    const dailyData = [];
    let maxCompletions = 1; // Avoid divide by 0
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = this.formatDate(new Date(year, month, day));
      let count = 0;
      this.habits.forEach(h => {
        if (h.history[dateStr]) count++;
      });
      dailyData.push(count);
      if (count > maxCompletions) maxCompletions = count;
    }

    // Build SVG paths
    let dLine = '';
    let dFill = '';

    const stepX = width / Math.max(1, (daysInMonth - 1));
    
    dailyData.forEach((val, idx) => {
      const x = idx * stepX;
      // Y is inverted (0 is top, 150 is bottom)
      // Leave some padding at top (20px)
      const padding = 20;
      const graphHeight = height - padding;
      const y = height - ((val / maxCompletions) * graphHeight);
      
      if (idx === 0) {
        dLine += `M ${x},${y} `;
        dFill += `M ${x},${height} L ${x},${y} `;
      } else {
        // Simple bezier curve smoothing
        const prevX = (idx - 1) * stepX;
        const prevY = height - ((dailyData[idx - 1] / maxCompletions) * graphHeight);
        const cpX1 = prevX + (stepX / 2);
        const cpY1 = prevY;
        const cpX2 = x - (stepX / 2);
        const cpY2 = y;
        
        dLine += `C ${cpX1},${cpY1} ${cpX2},${cpY2} ${x},${y} `;
        dFill += `C ${cpX1},${cpY1} ${cpX2},${cpY2} ${x},${y} `;
      }
    });

    // Close fill path
    dFill += `L ${width},${height} Z`;

    pathLine.setAttribute('d', dLine);
    pathFill.setAttribute('d', dFill);

    // Labels (Start, Middle, End of month)
    labelsContainer.innerHTML = `
      <span>1st</span>
      <span>15th</span>
      <span>${daysInMonth}th</span>
    `;
  }

  renderInsights() {
    // Total Checked
    let totalChecked = 0;
    
    // Best Streak across all habits
    let maxStreak = 0;

    // Completions by day of week (0=Sun, 6=Sat)
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    this.habits.forEach(h => {
      const hKeys = Object.keys(h.history);
      totalChecked += hKeys.length;
      
      const streak = this.calculateStreak(h);
      if (streak > maxStreak) maxStreak = streak;

      hKeys.forEach(dateStr => {
        if (h.history[dateStr] === true) {
          const d = new Date(dateStr + "T00:00:00"); // Force local timezone parsing
          dayCounts[d.getDay()]++;
        }
      });
    });

    let bestDayIdx = 0;
    let bestDayVal = 0;
    dayCounts.forEach((count, idx) => {
      if (count > bestDayVal) {
        bestDayVal = count;
        bestDayIdx = idx;
      }
    });

    // Consistency Rate (All time completed / All time active days since habit creation)
    // For simplicity of this demo, we calculate for the last 30 days
    let recentActive = 0;
    let recentCompleted = 0;
    const today = new Date(this.today);
    
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = this.formatDate(d);
      
      this.habits.forEach(h => {
        if (h.activeDays.includes(d.getDay())) recentActive++;
        if (h.history[dateStr]) recentCompleted++;
      });
    }

    const consistencyRate = recentActive > 0 ? Math.round((recentCompleted / recentActive) * 100) : 0;

    document.getElementById('insight-completion-rate').innerText = `${consistencyRate}%`;
    document.getElementById('insight-total-checked').innerText = totalChecked;
    document.getElementById('insight-best-streak').innerText = `${maxStreak} days`;
    document.getElementById('insight-most-consistent').innerText = bestDayVal > 0 ? dayNames[bestDayIdx] : 'N/A';
  }

  // ==========================================================================
  // HABIT MUTATIONS
  // ==========================================================================
  async toggleHabitStatus(habitId, dateStr) {
    const habit = this.habits.find(h => h.id === habitId);
    if (!habit) return;

    if (habit.history[dateStr] === true) {
      delete habit.history[dateStr];
    } else {
      habit.history[dateStr] = true;
    }

    await this.saveHabits();
    this.render();
  }

  async updateHabitGoal(habitId, newGoal) {
    const habit = this.habits.find(h => h.id === habitId);
    if (!habit) return;

    habit.goal = Math.max(1, Math.min(newGoal, 31));
    await this.saveHabits();
    this.render();
  }

  async createNewHabit(name, goal, color, activeDays) {
    const newHabit = {
      id: 'h_' + Date.now(),
      name: name.trim(),
      goal: Math.max(1, Math.min(goal, 31)),
      color: color,
      activeDays: activeDays,
      history: {}
    };

    this.habits.push(newHabit);
    await this.saveHabits();
    this.render();
    this.renderSettingsHabits();
  }

  async deleteHabit(habitId) {
    this.habits = this.habits.filter(h => h.id !== habitId);
    await this.saveHabits();
    this.render();
    this.renderSettingsHabits();
  }

  async moveHabitOrder(habitId, direction) {
    const index = this.habits.findIndex(h => h.id === habitId);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= this.habits.length) return;

    // Swap elements
    const temp = this.habits[index];
    this.habits[index] = this.habits[targetIndex];
    this.habits[targetIndex] = temp;

    await this.saveHabits();
    this.render();
    this.renderSettingsHabits();
  }

  // ==========================================================================
  // CONFIGURATION & THEMES
  // ==========================================================================
  setWindowMode(isWidget) {
    this.config.isWidgetMode = isWidget;
    
    // Toggle body classes
    if (isWidget) {
      document.body.className = `${this.config.theme} widget-active`;
      document.getElementById('toggle-mode-icon').setAttribute('data-lucide', 'maximize-2');
      document.getElementById('always-on-top-btn').style.display = 'flex';
    } else {
      document.body.className = `${this.config.theme} dashboard-active`;
      document.getElementById('toggle-mode-icon').setAttribute('data-lucide', 'minimize-2');
      document.getElementById('always-on-top-btn').style.display = 'none';
    }

    if (window.lucide) window.lucide.createIcons();

    // Call electron resizing
    if (window.electronAPI) {
      window.electronAPI.toggleMode(isWidget);
    }
  }

  applyAlwaysOnTopUI(value) {
    this.config.alwaysOnTop = value;
    const btn = document.getElementById('always-on-top-btn');
    const toggle = document.getElementById('always-on-top-toggle');
    
    if (value) {
      btn.className = 'control-btn pin-active';
      if (toggle) toggle.checked = true;
    } else {
      btn.className = 'control-btn pin-inactive';
      if (toggle) toggle.checked = false;
    }

    if (window.electronAPI) {
      window.electronAPI.toggleAlwaysOnTop(value);
    }
  }

  applyTheme(themeName) {
    this.config.theme = themeName;
    
    // Update body class
    document.body.className = `${themeName} ${this.config.isWidgetMode ? 'widget-active' : 'dashboard-active'}`;
    
    // Update active state on theme cards
    document.querySelectorAll('.theme-card').forEach(card => {
      if (card.dataset.theme === themeName) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    // Save to config
    if (window.electronAPI) {
      window.electronAPI.saveConfig(this.config);
    } else {
      localStorage.setItem('config', JSON.stringify(this.config));
    }
  }

  // ==========================================================================
  // VIEW CONTROLLERS (MODALS & TABS)
  // ==========================================================================
  openSettings(activeTab = 'tab-habits') {
    const modal = document.getElementById('settings-modal');
    modal.classList.add('active');
    
    // Set active tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
      if (btn.dataset.tab === activeTab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      if (content.id === activeTab) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  }

  closeSettings() {
    document.getElementById('settings-modal').classList.remove('active');
  }

  renderSettingsHabits() {
    const container = document.getElementById('habit-manager-list');
    container.innerHTML = '';

    if (this.habits.length === 0) {
      container.innerHTML = `<p style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 13px;">No habits created yet.</p>`;
      return;
    }

    this.habits.forEach((h, index) => {
      const item = document.createElement('div');
      item.className = 'manager-item';
      item.innerHTML = `
        <div class="manager-item-left">
          <span class="manager-color-dot" style="--dot-color: ${h.color}; background-color: ${h.color};"></span>
          <div style="display: flex; flex-direction: column;">
            <span class="manager-name">${h.name}</span>
            <span class="manager-goal">Goal: ${h.goal} days/mo</span>
          </div>
        </div>
        <div class="manager-actions">
          <button class="icon-btn-secondary btn-sm-action move-up-btn" ${index === 0 ? 'disabled' : ''} title="Move Up">
            <i data-lucide="chevron-up"></i>
          </button>
          <button class="icon-btn-secondary btn-sm-action move-down-btn" ${index === this.habits.length - 1 ? 'disabled' : ''} title="Move Down">
            <i data-lucide="chevron-down"></i>
          </button>
          <button class="icon-btn-danger btn-sm-action delete-btn" title="Delete Habit">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `;

      // Wire up buttons
      item.querySelector('.move-up-btn').addEventListener('click', () => this.moveHabitOrder(h.id, 'up'));
      item.querySelector('.move-down-btn').addEventListener('click', () => this.moveHabitOrder(h.id, 'down'));
      item.querySelector('.delete-btn').addEventListener('click', () => {
        if (confirm(`Are you sure you want to delete "${h.name}"?`)) {
          this.deleteHabit(h.id);
        }
      });

      container.appendChild(item);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // ==========================================================================
  // EVENT LISTENERS WIRE-UP
  // ==========================================================================
  setupEventListeners() {
    // Window Controls
    document.getElementById('minimize-btn').addEventListener('click', () => {
      if (window.electronAPI) window.electronAPI.minimizeApp();
    });

    document.getElementById('maximize-window-btn').addEventListener('click', () => {
      if (window.electronAPI) window.electronAPI.maximizeApp();
    });

    document.getElementById('close-btn').addEventListener('click', () => {
      if (window.electronAPI) window.electronAPI.closeApp();
    });

    // Double click title bar to maximize (only in dashboard mode)
    document.getElementById('title-bar').addEventListener('dblclick', (e) => {
      if (e.target.closest('.window-controls')) return;
      if (!this.config.isWidgetMode && window.electronAPI) {
        window.electronAPI.maximizeApp();
      }
    });

    // Handle maximized status callback from main process
    if (window.electronAPI && window.electronAPI.onWindowMaximized) {
      window.electronAPI.onWindowMaximized((isMaximized) => {
        const icon = document.getElementById('maximize-icon');
        if (icon) {
          icon.setAttribute('data-lucide', isMaximized ? 'copy' : 'square');
          if (window.lucide) window.lucide.createIcons();
        }
      });
    }

    document.getElementById('always-on-top-btn').addEventListener('click', () => {
      this.applyAlwaysOnTopUI(!this.config.alwaysOnTop);
    });

    // Expand/Shrink Mode Toggle
    document.getElementById('toggle-mode-btn').addEventListener('click', () => {
      this.setWindowMode(!this.config.isWidgetMode);
      this.render();
    });

    document.getElementById('widget-expand-btn').addEventListener('click', () => {
      this.setWindowMode(false);
      this.render();
    });

    document.getElementById('shrink-to-widget-btn').addEventListener('click', () => {
      this.setWindowMode(true);
      this.render();
    });

    // Settings Modal
    document.getElementById('widget-settings-btn').addEventListener('click', () => this.openSettings('tab-habits'));
    document.getElementById('dashboard-settings-btn').addEventListener('click', () => this.openSettings('tab-habits'));
    document.getElementById('close-settings-btn').addEventListener('click', () => this.closeSettings());
    
    // Tab switching inside modal
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openSettings(btn.dataset.tab);
      });
    });

    // Month Navigation (Prev/Next)
    document.getElementById('prev-month-btn').addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.render();
    });

    document.getElementById('next-month-btn').addEventListener('click', () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.render();
    });

    // Form submission: Create Habit
    document.getElementById('create-habit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('habit-name-input').value;
      const goal = parseInt(document.getElementById('habit-goal-input').value) || 20;
      
      const colorOption = document.querySelector('input[name="habit-color"]:checked');
      const color = colorOption ? colorOption.value : '#a78bfa';

      const activeDaysCheckboxes = document.querySelectorAll('input[name="active-days"]:checked');
      const activeDays = Array.from(activeDaysCheckboxes).map(cb => parseInt(cb.value));

      if (activeDays.length === 0) {
        alert('Please select at least one active day of the week.');
        return;
      }

      await this.createNewHabit(name, goal, color, activeDays);
      
      // Reset form and go back to habits list tab
      document.getElementById('create-habit-form').reset();
      this.openSettings('tab-habits');
    });

    // Always-on-top toggle inside settings
    const topToggle = document.getElementById('always-on-top-toggle');
    if (topToggle) {
      topToggle.addEventListener('change', (e) => {
        this.applyAlwaysOnTopUI(e.target.checked);
      });
    }

    // Theme switching
    document.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', () => {
        this.applyTheme(card.dataset.theme);
      });
    });

    // Data Management buttons
    const exportBtn = document.getElementById('export-data-btn');
    if (exportBtn) exportBtn.addEventListener('click', () => this.exportData());
    
    const importBtn = document.getElementById('import-data-btn');
    if (importBtn) {
      importBtn.addEventListener('click', () => {
        document.getElementById('import-file-input').click();
      });
    }
    
    const importInput = document.getElementById('import-file-input');
    if (importInput) importInput.addEventListener('change', (e) => this.importData(e));
    
    const resetBtn = document.getElementById('reset-data-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('WARNING: This will delete all your habits and progress history. Are you sure?')) {
          this.resetAllData();
        }
      });
    }
  }

  // ==========================================================================
  // DATA MANAGEMENT HELPERS (EXPORT / IMPORT / RESET)
  // ==========================================================================
  exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.habits, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `habits_backup_${this.formatDate(new Date())}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (Array.isArray(imported)) {
          // Quick validation
          const isValid = imported.every(h => h.id && h.name && Array.isArray(h.activeDays) && h.history);
          if (isValid) {
            this.habits = imported;
            await this.saveHabits();
            this.render();
            this.renderSettingsHabits();
            alert('Habits data imported successfully!');
            this.closeSettings();
          } else {
            alert('Invalid backup file structure.');
          }
        } else {
          alert('Backup must be a JSON array of habits.');
        }
      } catch (err) {
        alert('Failed to parse backup file: ' + err.message);
      }
    };
    reader.readAsText(file);
    // Reset file input value so it can be triggered again
    event.target.value = '';
  }

  async resetAllData() {
    this.habits = this.generateSampleHistory(DEFAULT_HABITS);
    await this.saveHabits();
    this.render();
    this.renderSettingsHabits();
    alert('App data reset to default sample values.');
    this.closeSettings();
  }

  // ==========================================================================
  // UTILITY FORMULAS
  // ==========================================================================
  formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  calculateMonthlyCompletedCount(habit, month, year) {
    let count = 0;
    // Iterate through all days in month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = this.formatDate(new Date(year, month, day));
      if (habit.history[dateStr] === true) {
        count++;
      }
    }
    return count;
  }

  calculateStreak(habit) {
    let streak = 0;
    let checkDate = new Date(this.today);

    while (true) {
      const dateStr = this.formatDate(checkDate);
      const isCompleted = habit.history[dateStr] === true;
      const isActiveDay = habit.activeDays.includes(checkDate.getDay());

      if (isCompleted) {
        streak++;
      } else if (isActiveDay) {
        // If it was an active day but they didn't do it, streak breaks
        // EXCEPT: if checkDate is today, they still have time to complete it, so don't break yet
        if (dateStr !== this.formatDate(this.today)) {
          break;
        }
      }
      // If it wasn't an active day, we skip it without breaking streak

      // Move to yesterday
      checkDate.setDate(checkDate.getDate() - 1);
      
      // Safeguard break (don't trace back forever)
      if (streak > 365) break;
    }
    return streak;
  }

  hexToRgba(hex, alpha = 1) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    if (!result) return `rgba(167, 139, 250, ${alpha})`; // fallback lavender

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}

// Instantiate App on window load
let app;
window.addEventListener('DOMContentLoaded', () => {
  app = new HabitTrackerApp();
  // Expose app to window for inline onclick triggers
  window.app = app;
});
