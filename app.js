/**
 * Admission Exam Tracker & Live Countdown Engine
 * Vanilla Architecture with LocalStorage Persistence
 */

(function () {
  'use strict';

  // Storage Keys
  const STORAGE_EXAMS_KEY = 'admission_exams_data_v1';
  const STORAGE_NOTICE_KEY = 'admission_notice_text_v1';
  const ADMIN_PIN_KEY = 'admission_admin_pin_v1';
  const DEFAULT_PIN = '6732';

  // Seed Dummy Data (Dynamically offset so timer always starts with ticking numbers)
  function getInitialExamsData() {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    return [
      {
        id: 'exam_du_a',
        uniName: 'ঢাকা বিশ্ববিদ্যালয়',
        unitName: 'বিজ্ঞান অনুষদ ("ক" ইউনিট)',
        category: 'A Unit',
        examDateTime: new Date(now + 12 * dayMs + 4 * 3600000).toISOString(),
        applyRange: '১৫ সেপ্টেম্বর – ২০ অক্টোবর ২০২৪',
        status: 'Confirmed',
        circularUrl: 'https://admission.eis.du.ac.bd'
      },
      {
        id: 'exam_medical',
        uniName: 'জাতীয় মেডিকেল ভর্তি পরীক্ষা',
        unitName: 'এমবিবিএস (MBBS) কোর্স',
        category: 'Medical',
        examDateTime: new Date(now + 18 * dayMs + 7 * 3600000).toISOString(),
        applyRange: '০১ অক্টোবর – ২৫ অক্টোবর ২০২৪',
        status: 'Confirmed',
        circularUrl: 'http://dgme.teletalk.com.bd'
      },
      {
        id: 'exam_buet',
        uniName: 'বুয়েট (BUET)',
        unitName: 'প্রাক-নির্বাচনী ও মূল প্রকৌশল',
        category: 'Engineering',
        examDateTime: new Date(now + 26 * dayMs + 2 * 3600000).toISOString(),
        applyRange: '১০ অক্টোবর – ০২ নভেম্বর ২০২৪',
        status: 'Confirmed',
        circularUrl: 'https://www.buet.ac.bd'
      },
      {
        id: 'exam_du_b',
        uniName: 'ঢাকা বিশ্ববিদ্যালয়',
        unitName: 'কলা ও সমাজবিজ্ঞান ("খ" ইউনিট)',
        category: 'B Unit',
        examDateTime: new Date(now + 34 * dayMs + 5 * 3600000).toISOString(),
        applyRange: '১৫ সেপ্টেম্বর – ২০ অক্টোবর ২০২৪',
        status: 'Tentative',
        circularUrl: 'https://admission.eis.du.ac.bd'
      },
      {
        id: 'exam_du_c',
        uniName: 'ঢাকা বিশ্ববিদ্যালয়',
        unitName: 'ব্যবসায় শিক্ষা অনুষদ ("গ" ইউনিট)',
        category: 'C Unit',
        examDateTime: new Date(now + 42 * dayMs + 3 * 3600000).toISOString(),
        applyRange: '১৫ সেপ্টেম্বর – ২০ অক্টোবর ২০২৪',
        status: 'Tentative',
        circularUrl: 'https://admission.eis.du.ac.bd'
      }
    ];
  }

  // Application State
  let state = {
    activeCategory: 'All',
    exams: [],
    notice: 'মেডিকেল ও ঢাবি ক ইউনিটের ভর্তি পরীক্ষার তারিখ প্রকাশিত হয়েছে। প্রস্তুতি জোরদার করুন!'
  };

  // DOM Selectors Cache
  const elements = {
    topNoticeText: document.getElementById('topNoticeText'),
    categoryCapsule: document.getElementById('categoryCapsule'),
    categoryPills: document.querySelectorAll('.cat-pill'),
    examCardsGrid: document.getElementById('examCardsGrid'),
    adminFabBtn: document.getElementById('adminFabBtn'),
    pinModal: document.getElementById('pinModal'),
    pinForm: document.getElementById('pinForm'),
    adminPinInput: document.getElementById('adminPinInput'),
    closePinModal: document.getElementById('closePinModal'),
    pinErrorMessage: document.getElementById('pinErrorMessage'),
    adminPanelModal: document.getElementById('adminPanelModal'),
    closeAdminModal: document.getElementById('closeAdminModal'),
    noticeUpdateForm: document.getElementById('noticeUpdateForm'),
    adminNoticeInput: document.getElementById('adminNoticeInput'),
    addExamForm: document.getElementById('addExamForm'),
    adminExamList: document.getElementById('adminExamList'),
    toastNotification: document.getElementById('toastNotification')
  };

  // Convert English digits to Bengali digits
  function toBengaliNumerals(num) {
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().padStart(2, '0').split('').map(d => bengaliDigits[d] || d).join('');
  }

  // Calculate Difference Breakdown
  function calculateTimeRemaining(targetIsoString) {
    const targetDate = new Date(targetIsoString).getTime();
    const now = Date.now();
    const diff = targetDate - now;

    if (diff <= 0) {
      return { total: diff, days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }

    const seconds = Math.floor((diff / 1000) % 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    return { total: diff, days, hours, minutes, seconds, isExpired: false };
  }

  // Toast Notifier
  let toastTimer;
  function showToast(message) {
    elements.toastNotification.textContent = message;
    elements.toastNotification.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      elements.toastNotification.classList.add('hidden');
    }, 3200);
  }

  // LocalStorage I/O Handlers
  function loadData() {
    const savedExams = localStorage.getItem(STORAGE_EXAMS_KEY);
    const savedNotice = localStorage.getItem(STORAGE_NOTICE_KEY);

    state.exams = savedExams ? JSON.parse(savedExams) : getInitialExamsData();
    if (!savedExams) {
      localStorage.setItem(STORAGE_EXAMS_KEY, JSON.stringify(state.exams));
    }

    if (savedNotice) {
      state.notice = savedNotice;
    } else {
      localStorage.setItem(STORAGE_NOTICE_KEY, state.notice);
    }
  }

  function saveExams() {
    localStorage.setItem(STORAGE_EXAMS_KEY, JSON.stringify(state.exams));
  }

  function saveNotice(newNotice) {
    state.notice = newNotice;
    localStorage.setItem(STORAGE_NOTICE_KEY, newNotice);
  }

  // View Renderers
  function renderNotice() {
    elements.topNoticeText.textContent = state.notice;
    elements.adminNoticeInput.value = state.notice;
  }

  function getSortedAndFilteredExams() {
    // 1. Filter by category
    let list = state.exams.filter(exam => {
      if (state.activeCategory === 'All') return true;
      return exam.category === state.activeCategory;
    });

    // 2. Smart Sort: Closest upcoming exam first
    const now = Date.now();
    list.sort((a, b) => {
      const diffA = new Date(a.examDateTime).getTime() - now;
      const diffB = new Date(b.examDateTime).getTime() - now;

      // Put expired exams at the very bottom
      if (diffA < 0 && diffB >= 0) return 1;
      if (diffB < 0 && diffA >= 0) return -1;
      return diffA - diffB;
    });

    return list;
  }

  function renderExams() {
    const filteredList = getSortedAndFilteredExams();
    elements.examCardsGrid.innerHTML = '';

    if (filteredList.length === 0) {
      elements.examCardsGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text-dim);">
          <p style="font-size: 1.2rem;">এই ক্যাটাগরিতে কোনো পরীক্ষার তথ্য পাওয়া যায়নি।</p>
        </div>
      `;
      return;
    }

    filteredList.forEach((exam, index) => {
      const isFeatured = index === 0 && calculateTimeRemaining(exam.examDateTime).total > 0;
      const statusClass = exam.status.toLowerCase() === 'confirmed' ? 'confirmed' : 'tentative';
      const statusLabel = exam.status.toLowerCase() === 'confirmed' ? 'Confirmed' : 'Tentative';

      const card = document.createElement('article');
      card.className = `exam-card glass-card ${isFeatured ? 'featured-card' : ''}`;
      card.id = `card_${exam.id}`;

      card.innerHTML = `
        <div class="card-top-row">
          <div class="uni-meta">
            <h2 class="uni-name">${exam.uniName}</h2>
            <span class="unit-tag">${exam.unitName}</span>
          </div>
          <span class="status-badge ${statusClass}">
            <span class="badge-dot"></span>
            ${statusLabel}
          </span>
        </div>

        <div class="timer-container" data-target="${exam.examDateTime}">
          <div class="timer-segment">
            <div class="timer-digit" data-unit="days">০০</div>
            <div class="timer-label">দিন</div>
          </div>
          <div class="timer-segment">
            <div class="timer-digit" data-unit="hours">০০</div>
            <div class="timer-label">ঘণ্টা</div>
          </div>
          <div class="timer-segment">
            <div class="timer-digit" data-unit="minutes">০০</div>
            <div class="timer-label">মিনিট</div>
          </div>
          <div class="timer-segment">
            <div class="timer-digit" data-unit="seconds">০০</div>
            <div class="timer-label">সেকেন্ড</div>
          </div>
        </div>

        <div class="card-meta-details">
          <div class="meta-row">
            <span class="meta-icon">📅</span>
            <span>আবেদনের সময়: <strong>${exam.applyRange}</strong></span>
          </div>
          <div class="meta-row">
            <span class="meta-icon">🎯</span>
            <span>ক্যাটাগরি: <strong>${exam.category}</strong></span>
          </div>
        </div>

        <a href="${exam.circularUrl}" target="_blank" rel="noopener noreferrer" class="circular-action-btn">
          সার্কুলার দেখুন ↗
        </a>
      `;

      elements.examCardsGrid.appendChild(card);
    });

    updateTimerDisplay();
  }

  // Live Timer Tick Loop
  function updateTimerDisplay() {
    const timerBoxes = document.querySelectorAll('.timer-container');
    timerBoxes.forEach(box => {
      const targetIso = box.getAttribute('data-target');
      const time = calculateTimeRemaining(targetIso);

      const daysElem = box.querySelector('[data-unit="days"]');
      const hoursElem = box.querySelector('[data-unit="hours"]');
      const minsElem = box.querySelector('[data-unit="minutes"]');
      const secsElem = box.querySelector('[data-unit="seconds"]');

      if (time.isExpired) {
        daysElem.textContent = '০০';
        hoursElem.textContent = '০০';
        minsElem.textContent = '০০';
        secsElem.textContent = '০০';
      } else {
        daysElem.textContent = toBengaliNumerals(time.days);
        hoursElem.textContent = toBengaliNumerals(time.hours);
        minsElem.textContent = toBengaliNumerals(time.minutes);
        secsElem.textContent = toBengaliNumerals(time.seconds);
      }
    });
  }

  // Admin Exam Management List
  function renderAdminExamList() {
    elements.adminExamList.innerHTML = '';
    if (state.exams.length === 0) {
      elements.adminExamList.innerHTML = '<p style="color: var(--text-dim); font-size: 0.85rem;">কোনো পরীক্ষা সংরক্ষিত নেই।</p>';
      return;
    }

    state.exams.forEach(exam => {
      const item = document.createElement('div');
      item.className = 'admin-list-item';
      item.innerHTML = `
        <div class="item-info">
          <strong>${exam.uniName} (${exam.unitName})</strong>
          <span>${exam.category} | ${new Date(exam.examDateTime).toLocaleDateString('bn-BD')}</span>
        </div>
        <button class="delete-btn" data-id="${exam.id}">ডিলিট</button>
      `;
      elements.adminExamList.appendChild(item);
    });

    // Delete Event Binding
    elements.adminExamList.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idToDelete = e.target.getAttribute('data-id');
        state.exams = state.exams.filter(item => item.id !== idToDelete);
        saveExams();
        renderAdminExamList();
        renderExams();
        showToast('পরীক্ষা তালিকা থেকে মুছে ফেলা হয়েছে!');
      });
    });
  }

  // Category Filter Click Handler
  elements.categoryCapsule.addEventListener('click', (e) => {
    if (!e.target.classList.contains('cat-pill')) return;
    elements.categoryPills.forEach(pill => pill.classList.remove('active'));
    e.target.classList.add('active');
    state.activeCategory = e.target.getAttribute('data-category');
    renderExams();
  });

  // Admin Security Logic
  elements.adminFabBtn.addEventListener('click', () => {
    elements.pinErrorMessage.classList.add('hidden');
    elements.adminPinInput.value = '';
    elements.pinModal.classList.remove('hidden');
    elements.adminPinInput.focus();
  });

  elements.closePinModal.addEventListener('click', () => {
    elements.pinModal.classList.add('hidden');
  });

  elements.pinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const enteredPin = elements.adminPinInput.value.trim();
    const storedPin = localStorage.getItem(ADMIN_PIN_KEY) || DEFAULT_PIN;

    if (enteredPin === storedPin) {
      elements.pinModal.classList.add('hidden');
      elements.adminPanelModal.classList.remove('hidden');
      renderAdminExamList();
      renderNotice();
    } else {
      elements.pinErrorMessage.classList.remove('hidden');
      elements.adminPinInput.select();
    }
  });

  elements.closeAdminModal.addEventListener('click', () => {
    elements.adminPanelModal.classList.add('hidden');
  });

  // Admin: Update Notice Handler
  elements.noticeUpdateForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const updatedNotice = elements.adminNoticeInput.value.trim();
    if (updatedNotice) {
      saveNotice(updatedNotice);
      renderNotice();
      showToast('টপ নোটিস সফলভাবে হালনাগাদ হয়েছে!');
    }
  });

  // Admin: Add New Exam Handler
  elements.addExamForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const newExam = {
      id: 'exam_' + Date.now(),
      uniName: document.getElementById('examUniName').value.trim(),
      unitName: document.getElementById('examUnitName').value.trim(),
      category: document.getElementById('examCategory').value,
      status: document.getElementById('examStatus').value,
      examDateTime: new Date(document.getElementById('examDateTime').value).toISOString(),
      applyRange: document.getElementById('examApplyRange').value.trim(),
      circularUrl: document.getElementById('examCircularLink').value.trim()
    };

    state.exams.push(newExam);
    saveExams();
    renderExams();
    renderAdminExamList();
    elements.addExamForm.reset();
    showToast('নতুন পরীক্ষার তথ্য যুক্ত করা হয়েছে!');
  });

  // Global Initializer
  function init() {
    loadData();
    renderNotice();
    renderExams();

    // Start 1-second interval loop for countdown precision
    setInterval(updateTimerDisplay, 1000);
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
// ==========================================
// Developer Watermark Badge (SAMIN YASIR)
// ==========================================
(function injectDeveloperBadge() {
  const badge = document.createElement('div');
  badge.innerHTML = `
    <div style="
      position: fixed;
      top: 18px;
      left: 20px;
      z-index: 99;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 14px 6px 8px;
      background: rgba(18, 24, 38, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 100px;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
      cursor: default;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    " onmouseover="this.style.transform='translateY(-2px)'; this.style.borderColor='rgba(56, 189, 248, 0.4)';" 
       onmouseout="this.style.transform='translateY(0)'; this.style.borderColor='rgba(255, 255, 255, 0.12)';">
       
      <div style="
        width: 28px;
        height: 28px;
        background: linear-gradient(135deg, #06b6d4, #6366f1);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.75rem;
        font-weight: 800;
        color: #fff;
        box-shadow: 0 0 12px rgba(99, 102, 241, 0.5);
      ">SY</div>

      <div style="display: flex; flex-direction: column; line-height: 1.15;">
        <span style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-family: monospace;">Developer</span>
        <span style="font-size: 0.88rem; font-weight: 700; color: #ffffff; letter-spacing: 0.4px;">SAMIN YASIR</span>
      </div>
    </div>
  `;
  document.body.appendChild(badge);
})();
})();