/**
 * ==========================================================================
 * Project: Admission Exam Tracker & Live Countdown Engine
 * Developer: SAMIN YASIR
 * Version: 2.0 (Integrated Live Edit, Admin Security & Watermark)
 * ==========================================================================
 */

(function () {
  'use strict';

  // Storage Keys
  const STORAGE_EXAMS_KEY = 'admission_exams_data_v1';
  const STORAGE_NOTICE_KEY = 'admission_notice_text_v1';
  const ADMIN_PIN_KEY = 'admission_admin_pin_v1';
  const DEFAULT_PIN = '1234';

  // Global State
  let state = {
    activeCategory: 'All',
    exams: [],
    notice: 'মেডিকেল ও ঢাবি ক ইউনিটের ভর্তি পরীক্ষার তারিখ প্রকাশিত হয়েছে। প্রস্তুতি জোরদার করুন!'
  };

  // Track if an exam is currently being edited (null = new exam, string = editing ID)
  let editingExamId = null;

  // Initial Seed Dummy Data (Dynamically offset so countdown always starts ticking)
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

  // DOM Elements Cache
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

  // Convert English Numbers to Bengali Numerals
  function toBengaliNumerals(num) {
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().padStart(2, '0').split('').map(d => bengaliDigits[d] || d).join('');
  }

  // Calculate Remaining Time Difference
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

  // Toast Notification System
  let toastTimer;
  function showToast(message) {
    if (!elements.toastNotification) return;
    elements.toastNotification.textContent = message;
    elements.toastNotification.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      elements.toastNotification.classList.add('hidden');
    }, 3200);
  }

  // Inject Developer Watermark (SAMIN YASIR) on Top Left Corner
  function injectDeveloperWatermark() {
    if (document.getElementById('saminDevBadge')) return;

    const devBadge = document.createElement('aside');
    devBadge.id = 'saminDevBadge';
    devBadge.style.cssText = `
      position: fixed;
      top: 16px;
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
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: default;
      user-select: none;
    `;

    devBadge.innerHTML = `
      <div style="
        width: 28px;
        height: 28px;
        background: linear-gradient(135deg, #06b6d4, #6366f1);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: monospace;
        font-size: 0.75rem;
        font-weight: 800;
        color: #ffffff;
        box-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
      ">SY</div>
      <div style="display: flex; flex-direction: column; line-height: 1.15;">
        <span style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-family: monospace;">Developer</span>
        <span style="font-size: 0.88rem; font-weight: 700; color: #ffffff; letter-spacing: 0.4px;">SAMIN YASIR</span>
      </div>
    `;

    devBadge.addEventListener('mouseenter', () => {
      devBadge.style.transform = 'translateY(-2px)';
      devBadge.style.borderColor = 'rgba(56, 189, 248, 0.4)';
    });

    devBadge.addEventListener('mouseleave', () => {
      devBadge.style.transform = 'translateY(0)';
      devBadge.style.borderColor = 'rgba(255, 255, 255, 0.12)';
    });

    document.body.appendChild(devBadge);
  }

  // LocalStorage I/O Operations
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

  // Render Top Notice
  function renderNotice() {
    if (elements.topNoticeText) elements.topNoticeText.textContent = state.notice;
    if (elements.adminNoticeInput) elements.adminNoticeInput.value = state.notice;
  }

  // Filter and Smart Sort Logic
  function getSortedAndFilteredExams() {
    let list = state.exams.filter(exam => {
      if (state.activeCategory === 'All') return true;
      return exam.category === state.activeCategory;
    });

    const now = Date.now();
    list.sort((a, b) => {
      const diffA = new Date(a.examDateTime).getTime() - now;
      const diffB = new Date(b.examDateTime).getTime() - now;

      // Push expired exams to the bottom
      if (diffA < 0 && diffB >= 0) return 1;
      if (diffB < 0 && diffA >= 0) return -1;
      return diffA - diffB;
    });

    return list;
  }

  // Render Main Cards
  function renderExams() {
    if (!elements.examCardsGrid) return;
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

  // Live Timer Count Tick
  function updateTimerDisplay() {
    const timerBoxes = document.querySelectorAll('.timer-container');
    timerBoxes.forEach(box => {
      const targetIso = box.getAttribute('data-target');
      const time = calculateTimeRemaining(targetIso);

      const daysElem = box.querySelector('[data-unit="days"]');
      const hoursElem = box.querySelector('[data-unit="hours"]');
      const minsElem = box.querySelector('[data-unit="minutes"]');
      const secsElem = box.querySelector('[data-unit="seconds"]');

      if (!daysElem) return;

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

  // Admin Exam List (Includes Both Edit ✎ and Delete ✕ Handlers)
  function renderAdminExamList() {
    if (!elements.adminExamList) return;
    elements.adminExamList.innerHTML = '';

    if (state.exams.length === 0) {
      elements.adminExamList.innerHTML = '<p style="color: var(--text-dim); font-size: 0.85rem;">কোনো পরীক্ষা সংরক্ষিত নেই।</p>';
      return;
    }

    state.exams.forEach(exam => {
      const item = document.createElement('div');
      item.className = 'admin-list-item';
      item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; margin-bottom: 8px;';
      
      item.innerHTML = `
        <div class="item-info" style="display: flex; flex-direction: column;">
          <strong style="font-size: 0.95rem; color: #fff;">${exam.uniName} (${exam.unitName})</strong>
          <span style="font-size: 0.8rem; color: #94a3b8;">${exam.category} | ${new Date(exam.examDateTime).toLocaleDateString('bn-BD')}</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="edit-btn-action" data-id="${exam.id}" style="
            background: rgba(14, 165, 233, 0.15);
            color: #38bdf8;
            border: 1px solid rgba(14, 165, 233, 0.35);
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 0.82rem;
            cursor: pointer;
            transition: all 0.2s;
          ">এডিট ✎</button>
          
          <button class="delete-btn-action" data-id="${exam.id}" style="
            background: rgba(239, 68, 68, 0.15);
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.35);
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 0.82rem;
            cursor: pointer;
            transition: all 0.2s;
          ">ডিলিট ✕</button>
        </div>
      `;
      elements.adminExamList.appendChild(item);
    });

    // 1. Edit Button Click Handler
    elements.adminExamList.querySelectorAll('.edit-btn-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idToEdit = e.currentTarget.getAttribute('data-id');
        const targetExam = state.exams.find(item => item.id === idToEdit);
        if (!targetExam) return;

        editingExamId = targetExam.id;

        // Populate Form with existing data
        document.getElementById('examUniName').value = targetExam.uniName;
        document.getElementById('examUnitName').value = targetExam.unitName;
        document.getElementById('examCategory').value = targetExam.category;
        document.getElementById('examStatus').value = targetExam.status;

        // Convert UTC/ISO to local format for <input type="datetime-local">
        const dt = new Date(targetExam.examDateTime);
        dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
        document.getElementById('examDateTime').value = dt.toISOString().slice(0, 16);

        document.getElementById('examApplyRange').value = targetExam.applyRange;
        document.getElementById('examCircularLink').value = targetExam.circularUrl;

        // Highlight Submit Button for Edit Mode
        const submitBtn = elements.addExamForm.querySelector('button[type="submit"]');
        submitBtn.textContent = 'আপডেট সংরক্ষণ করুন ✓';
        submitBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';

        elements.addExamForm.scrollIntoView({ behavior: 'smooth' });
        showToast('তথ্যগুলো ফর্মে আনা হয়েছে, পরিবর্তন করে সেভ করুন।');
      });
    });

    // 2. Delete Button Click Handler
    elements.adminExamList.querySelectorAll('.delete-btn-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idToDelete = e.currentTarget.getAttribute('data-id');
        state.exams = state.exams.filter(item => item.id !== idToDelete);

        // If currently editing item is deleted, reset the form
        if (editingExamId === idToDelete) {
          elements.addExamForm.reset();
          editingExamId = null;
          const submitBtn = elements.addExamForm.querySelector('button[type="submit"]');
          submitBtn.textContent = 'পরীক্ষা যুক্ত করুন';
          submitBtn.style.background = '';
        }

        saveExams();
        renderAdminExamList();
        renderExams();
        showToast('পরীক্ষা তালিকা থেকে মুছে ফেলা হয়েছে!');
      });
    });
  }

  // Category Capsule Filter Selection
  if (elements.categoryCapsule) {
    elements.categoryCapsule.addEventListener('click', (e) => {
      if (!e.target.classList.contains('cat-pill')) return;
      elements.categoryPills.forEach(pill => pill.classList.remove('active'));
      e.target.classList.add('active');
      state.activeCategory = e.target.getAttribute('data-category');
      renderExams();
    });
  }

  // Admin FAB Trigger Click
  if (elements.adminFabBtn) {
    elements.adminFabBtn.addEventListener('click', () => {
      elements.pinErrorMessage.classList.add('hidden');
      elements.adminPinInput.value = '';
      elements.pinModal.classList.remove('hidden');
      elements.adminPinInput.focus();
    });
  }

  // Close Modals
  if (elements.closePinModal) {
    elements.closePinModal.addEventListener('click', () => {
      elements.pinModal.classList.add('hidden');
    });
  }

  if (elements.closeAdminModal) {
    elements.closeAdminModal.addEventListener('click', () => {
      elements.adminPanelModal.classList.add('hidden');
    });
  }

  // PIN Verification Handler
  if (elements.pinForm) {
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
  }

  // Notice Update Submission
  if (elements.noticeUpdateForm) {
    elements.noticeUpdateForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const updatedNotice = elements.adminNoticeInput.value.trim();
      if (updatedNotice) {
        saveNotice(updatedNotice);
        renderNotice();
        showToast('টপ নোটিস সফলভাবে হালনাগাদ হয়েছে!');
      }
    });
  }

  // Unified Add / Edit Exam Submission
  if (elements.addExamForm) {
    elements.addExamForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const examData = {
        uniName: document.getElementById('examUniName').value.trim(),
        unitName: document.getElementById('examUnitName').value.trim(),
        category: document.getElementById('examCategory').value,
        status: document.getElementById('examStatus').value,
        examDateTime: new Date(document.getElementById('examDateTime').value).toISOString(),
        applyRange: document.getElementById('examApplyRange').value.trim(),
        circularUrl: document.getElementById('examCircularLink').value.trim()
      };

      if (editingExamId) {
        // Update Existing Exam Record
        const index = state.exams.findIndex(item => item.id === editingExamId);
        if (index !== -1) {
          state.exams[index] = { ...state.exams[index], ...examData };
          showToast('পরীক্ষার তথ্য সফলভাবে আপডেট হয়েছে!');
        }
        editingExamId = null;
      } else {
        // Add New Exam Record
        state.exams.push({
          id: 'exam_' + Date.now(),
          ...examData
        });
        showToast('নতুন পরীক্ষার তথ্য যুক্ত করা হয়েছে!');
      }

      // Reset Form and Restore Submit Button state
      elements.addExamForm.reset();
      const submitBtn = elements.addExamForm.querySelector('button[type="submit"]');
      submitBtn.textContent = 'পরীক্ষা যুক্ত করুন';
      submitBtn.style.background = '';

      saveExams();
      renderExams();
      renderAdminExamList();
    });
  }

  // Admin PIN Change Handler (If element exists in HTML)
  const changePinForm = document.getElementById('changePinForm');
  if (changePinForm) {
    changePinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const currentPin = document.getElementById('currentPinInput').value.trim();
      const newPin = document.getElementById('newPinInput').value.trim();
      const storedPin = localStorage.getItem(ADMIN_PIN_KEY) || DEFAULT_PIN;

      if (currentPin !== storedPin) {
        showToast('বর্তমান পিনটি সঠিক নয়!');
        return;
      }
      if (newPin.length !== 4 || isNaN(newPin)) {
        showToast('নতুন পিন অবশ্যই ৪ ডিজিটের সংখ্যা হতে হবে!');
        return;
      }

      localStorage.setItem(ADMIN_PIN_KEY, newPin);
      changePinForm.reset();
      showToast('অ্যাডমিন পিন সফলভাবে পরিবর্তন হয়েছে!');
    });
  }

  // App Initialization
  function init() {
    loadData();
    injectDeveloperWatermark();
    renderNotice();
    renderExams();

    // 1-second interval loop for countdown precision
    setInterval(updateTimerDisplay, 1000);
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();