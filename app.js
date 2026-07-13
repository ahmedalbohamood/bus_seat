(function () {
  'use strict';

  var STORAGE_KEY = 'bus-seating-chart-v4';
  var LANG_KEY = 'bus-seating-chart-lang';

  /* ---------- translations ---------- */
  var STRINGS = {
    en: {
      title: 'Bus Seating Chart',
      subtitle: 'Tap a seat to add a passenger',
      statLeftLabel: 'seats left',
      statFilledLabel: 'filled',
      statFoldedLabel: 'folded',
      statTotalLabel: 'total',
      clearNames: 'Clear names',
      clearNamesTitle: 'Remove all passenger names',
      generatePdf: 'Generate PDF',
      pdfBtnTitle: 'Generate a printable passenger manifest',
      driver: 'Driver',
      doorVertical: 'door',
      hint: 'Tap a seat to name it · tap again to edit · use the ✕ to clear · use the fold switch to remove the middle seat for extra space',
      footer: 'Your changes are saved automatically on this device.',
      namePlaceholder: 'Passenger name',
      cancel: 'Cancel',
      remove: 'Remove',
      save: 'Save',
      manifestTitle: 'Passenger Manifest',
      seatCol: 'Seat',
      passengerCol: 'Passenger',
      seatWord: 'Seat',
      middleSuffix: ' (middle)',
      midSuffix: ' (mid)',
      emptyPrefix: 'Empty · ',
      removePassenger: 'Remove passenger',
      foldedAwayPrefix: 'Folded away · ',
      busDoor: 'Bus door',
      doorTag: 'door',
      seatDown: 'seat down',
      foldedWord: 'folded',
      frontTag: 'front',
      backTag: 'back bench',
      noPassengers: 'No passengers assigned yet.',
      confirmClear: 'Remove all passenger names? Seat folds are kept.',
      generated: 'Generated',
      filledWord: 'filled',
      activeSeats: 'active seats',
      emptyWord: 'empty',
      langToggleLabel: 'العربية'
    },
    ar: {
      title: 'مخطط مقاعد الحافلة',
      subtitle: 'اضغط على مقعد لإضافة راكب',
      statLeftLabel: 'مقاعد متبقية',
      statFilledLabel: 'مشغولة',
      statFoldedLabel: 'مطوية',
      statTotalLabel: 'الإجمالي',
      clearNames: 'مسح الأسماء',
      clearNamesTitle: 'إزالة جميع أسماء الركاب',
      generatePdf: 'إنشاء PDF',
      pdfBtnTitle: 'إنشاء بيان ركاب قابل للطباعة',
      driver: 'السائق',
      doorVertical: 'باب',
      hint: 'اضغط على المقعد لتسميته · اضغط مرة أخرى للتعديل · استخدم ✕ للمسح · استخدم مفتاح الطي لإزالة المقعد الأوسط لمساحة إضافية',
      footer: 'يتم حفظ تغييراتك تلقائيًا على هذا الجهاز.',
      namePlaceholder: 'اسم الراكب',
      cancel: 'إلغاء',
      remove: 'إزالة',
      save: 'حفظ',
      manifestTitle: 'بيان الركاب',
      seatCol: 'المقعد',
      passengerCol: 'الراكب',
      seatWord: 'مقعد',
      middleSuffix: ' (أوسط)',
      midSuffix: ' (أوسط)',
      emptyPrefix: 'فارغ · ',
      removePassenger: 'إزالة الراكب',
      foldedAwayPrefix: 'مطوي · ',
      busDoor: 'باب الحافلة',
      doorTag: 'باب',
      seatDown: 'مقعد مفتوح',
      foldedWord: 'مطوي',
      frontTag: 'أمامي',
      backTag: 'المقعد الخلفي',
      noPassengers: 'لم يتم تعيين ركاب بعد.',
      confirmClear: 'هل تريد إزالة جميع أسماء الركاب؟ سيتم الاحتفاظ بحالة الطي.',
      generated: 'تم الإنشاء',
      filledWord: 'مشغولة',
      activeSeats: 'مقاعد فعّالة',
      emptyWord: 'فارغ',
      langToggleLabel: 'English'
    }
  };

  var lang = localStorage.getItem(LANG_KEY) === 'ar' ? 'ar' : 'en';
  function t(key) { return STRINGS[lang][key]; }

  // Tokens: S = seat, F = optional fold seat, G = aisle gap, D = door.
  // Row 1 lost its second seat (single + fold + single) so the whole
  // bus lands on exactly 30 seats: 3 + 4 + 3(door row) + 4*4 + 4(back) = 30.
  var ROW_DEFS = [
    { type: 'mid', pattern: ['S', 'G', 'F', 'G', 'S'] },
    { type: 'mid', pattern: ['S', 'S', 'G', 'F', 'G', 'S'] },
    { type: 'door', pattern: ['S', 'S', 'G', 'F', 'G', 'D'] },
    { type: 'mid', pattern: ['S', 'S', 'G', 'F', 'G', 'S'] },
    { type: 'mid', pattern: ['S', 'S', 'G', 'F', 'G', 'S'] },
    { type: 'mid', pattern: ['S', 'S', 'G', 'F', 'G', 'S'] },
    { type: 'mid', pattern: ['S', 'S', 'G', 'F', 'G', 'S'] },
    { type: 'back', pattern: ['S', 'S', 'S', 'S'] }
  ];

  var TOTAL_SEATS = ROW_DEFS.reduce(function (sum, r) {
    return sum + r.pattern.filter(function (t) { return t === 'S' || t === 'F'; }).length;
  }, 0); // 30

  /* ---------- state ---------- */
  // seats: array of { id, row, posInRow, isMid, name, folded }
  var seats = [];

  function buildDefaultSeats() {
    var list = [];
    var n = 1;
    ROW_DEFS.forEach(function (rowDef, rowIndex) {
      var seatIndexInRow = 0;
      rowDef.pattern.forEach(function (token) {
        if (token !== 'S' && token !== 'F') return;
        list.push({
          id: 'S' + n,
          row: rowIndex,
          posInRow: seatIndexInRow,
          isMid: token === 'F',
          name: '',
          folded: false
        });
        n++;
        seatIndexInRow++;
      });
    });
    return list;
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return buildDefaultSeats();
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length !== TOTAL_SEATS) {
        return buildDefaultSeats();
      }
      return parsed;
    } catch (e) {
      return buildDefaultSeats();
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seats));
  }

  seats = load();

  /* ---------- dom refs ---------- */
  var rowsEl = document.getElementById('rows');
  var statLeft = document.getElementById('statLeft');
  var statFilled = document.getElementById('statFilled');
  var statFolded = document.getElementById('statFolded');
  var statTotal = document.getElementById('statTotal');
  var progressFill = document.getElementById('progressFill');
  var pdfBtn = document.getElementById('pdfBtn');
  var clearAllBtn = document.getElementById('clearAllBtn');
  var langBtn = document.getElementById('langBtn');
  var langBtnLabel = document.getElementById('langBtnLabel');
  var pageTitle = document.getElementById('pageTitle');

  var popoverBackdrop = document.getElementById('popoverBackdrop');
  var popoverLabel = document.getElementById('popoverLabel');
  var nameInput = document.getElementById('nameInput');
  var popoverSave = document.getElementById('popoverSave');
  var popoverCancel = document.getElementById('popoverCancel');
  var popoverClear = document.getElementById('popoverClear');

  var activeSeatId = null;

  /* ---------- helpers ---------- */
  function getSeat(id) {
    for (var i = 0; i < seats.length; i++) if (seats[i].id === id) return seats[i];
    return null;
  }

  function initials(name) {
    var parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map(function (p) { return p.charAt(0).toUpperCase(); }).join('');
  }

  function seatLabel(seat) {
    return t('seatWord') + ' ' + seat.id.replace('S', '');
  }

  /* ---------- language ---------- */
  function applyLanguage() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    pageTitle.textContent = t('title');

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.title = t(el.getAttribute('data-i18n-title'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });

    langBtnLabel.textContent = t('langToggleLabel');
  }

  langBtn.addEventListener('click', function () {
    lang = lang === 'en' ? 'ar' : 'en';
    localStorage.setItem(LANG_KEY, lang);
    applyLanguage();
    render();
  });

  /* ---------- rendering ---------- */
  function render() {
    rowsEl.innerHTML = '';

    ROW_DEFS.forEach(function (rowDef, rowIndex) {
      var rowEl = document.createElement('div');
      rowEl.className = 'row row-' + rowDef.type;

      if (rowDef.type === 'back') {
        var tag2 = document.createElement('span');
        tag2.className = 'row-tag';
        tag2.textContent = t('backTag');
        rowEl.appendChild(tag2);
      }

      var rowSeats = seats.filter(function (s) { return s.row === rowIndex; })
                           .sort(function (a, b) { return a.posInRow - b.posInRow; });
      var cursor = 0;

      rowDef.pattern.forEach(function (token) {
        if (token === 'G') {
          var gap = document.createElement('div');
          gap.className = 'aisle-gap';
          rowEl.appendChild(gap);
          return;
        }
        if (token === 'D') {
          var door = document.createElement('div');
          door.className = 'door-marker';
          door.title = t('busDoor');
          door.innerHTML = '<span>🚪</span><span>' + t('doorTag') + '</span>';
          rowEl.appendChild(door);
          return;
        }
        var seat = rowSeats[cursor++];
        if (seat.isMid) {
          rowEl.appendChild(buildMidCell(seat));
        } else {
          rowEl.appendChild(buildSeatEl(seat));
        }
      });

      rowsEl.appendChild(rowEl);
    });

    updateStats();
    renderPrintSheet();
    save();
  }

  function buildSeatEl(seat) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'seat' + (seat.name ? ' filled' : '');
    el.dataset.id = seat.id;
    el.title = seat.name ? seat.name : t('emptyPrefix') + seatLabel(seat);

    var num = document.createElement('span');
    num.className = 'seat-num';
    num.textContent = seat.id.replace('S', '');
    el.appendChild(num);

    if (seat.name) {
      var ini = document.createElement('span');
      ini.className = 'seat-initials';
      ini.textContent = initials(seat.name);
      el.appendChild(ini);

      var nm = document.createElement('span');
      nm.className = 'seat-name';
      nm.textContent = seat.name;
      el.appendChild(nm);

      var clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'seat-clear';
      clearBtn.textContent = '✕';
      clearBtn.title = t('removePassenger');
      clearBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        seat.name = '';
        render();
      });
      el.appendChild(clearBtn);
    } else {
      var icon = document.createElement('span');
      icon.className = 'seat-icon';
      icon.textContent = '💺';
      el.appendChild(icon);
    }

    el.addEventListener('click', function () { openPopover(seat.id); });
    return el;
  }

  function buildMidCell(seat) {
    var wrap = document.createElement('div');
    wrap.className = 'mid-cell';

    var seatEl = buildSeatEl(seat);
    seatEl.classList.add('mid');
    if (seat.folded) {
      seatEl.classList.add('folded');
      seatEl.title = t('foldedAwayPrefix') + seatLabel(seat);
    }
    wrap.appendChild(seatEl);

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'fold-toggle' + (!seat.folded ? ' down' : '');
    toggle.innerHTML = '<span class="fold-switch"></span><span>' + (seat.folded ? t('foldedWord') : t('seatDown')) + '</span>';
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      seat.folded = !seat.folded;
      if (seat.folded) seat.name = '';
      render();
    });
    wrap.appendChild(toggle);

    return wrap;
  }

  function updateStats() {
    var total = seats.length;
    var folded = seats.filter(function (s) { return s.isMid && s.folded; }).length;
    var filled = seats.filter(function (s) { return !s.folded && s.name; }).length;
    var active = total - folded;
    var left = active - filled;

    statLeft.textContent = left;
    statFilled.textContent = filled;
    statFolded.textContent = folded;
    statTotal.textContent = total;

    var pct = active > 0 ? Math.round((filled / active) * 100) : 0;
    progressFill.style.width = pct + '%';
  }

  /* ---------- popover ---------- */
  function openPopover(seatId) {
    var seat = getSeat(seatId);
    if (!seat || seat.folded) return;
    activeSeatId = seatId;
    popoverLabel.textContent = seatLabel(seat) + (seat.isMid ? t('middleSuffix') : '');
    nameInput.value = seat.name || '';
    popoverClear.style.display = seat.name ? 'inline-flex' : 'none';
    popoverBackdrop.classList.add('open');
    setTimeout(function () { nameInput.focus(); }, 30);
  }

  function closePopover() {
    popoverBackdrop.classList.remove('open');
    activeSeatId = null;
  }

  function commitPopover() {
    var seat = getSeat(activeSeatId);
    if (!seat) return;
    seat.name = nameInput.value.trim();
    closePopover();
    render();
  }

  popoverSave.addEventListener('click', commitPopover);
  popoverCancel.addEventListener('click', closePopover);
  popoverClear.addEventListener('click', function () {
    var seat = getSeat(activeSeatId);
    if (seat) seat.name = '';
    closePopover();
    render();
  });
  nameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') commitPopover();
    if (e.key === 'Escape') closePopover();
  });
  popoverBackdrop.addEventListener('click', function (e) {
    if (e.target === popoverBackdrop) closePopover();
  });

  /* ---------- clear all ---------- */
  clearAllBtn.addEventListener('click', function () {
    var anyFilled = seats.some(function (s) { return s.name; });
    if (!anyFilled) return;
    if (!confirm(t('confirmClear'))) return;
    seats.forEach(function (s) { s.name = ''; });
    render();
  });

  /* ---------- print / pdf ---------- */
  function renderPrintSheet() {
    var meta = document.getElementById('printMeta');
    var busEl = document.getElementById('printBus');
    var tbody = document.getElementById('printTableBody');

    var total = seats.length;
    var folded = seats.filter(function (s) { return s.isMid && s.folded; }).length;
    var filled = seats.filter(function (s) { return !s.folded && s.name; }).length;
    var active = total - folded;

    var now = new Date();
    meta.textContent = t('generated') + ' ' + now.toLocaleDateString() + ' ' + now.toLocaleTimeString() +
      '  ·  ' + filled + ' ' + t('filledWord') + ' / ' + active + ' ' + t('activeSeats') +
      ' / ' + folded + ' ' + t('foldedWord') + ' / ' + total + ' ' + t('statTotalLabel');

    busEl.innerHTML = '';
    var sorted = seats.slice().sort(function (a, b) { return a.row - b.row || a.posInRow - b.posInRow; });
    var lastRow = null;
    sorted.forEach(function (seat) {
      if (lastRow !== null && seat.row !== lastRow) {
        var brk = document.createElement('div');
        brk.className = 'print-row-break';
        busEl.appendChild(brk);
      }
      lastRow = seat.row;

      var cell = document.createElement('div');
      cell.className = 'print-seat' + (seat.folded ? ' folded' : (seat.name ? '' : ' empty'));
      var b = document.createElement('b');
      b.textContent = seat.id.replace('S', '#');
      cell.appendChild(b);
      var span = document.createElement('span');
      span.textContent = seat.folded ? t('foldedWord') : (seat.name || t('emptyWord'));
      cell.appendChild(span);
      busEl.appendChild(cell);
    });

    tbody.innerHTML = '';
    var withNames = sorted.filter(function (s) { return s.name; });
    if (withNames.length === 0) {
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = 2;
      td.textContent = t('noPassengers');
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      withNames.forEach(function (seat) {
        var tr = document.createElement('tr');
        var tdSeat = document.createElement('td');
        tdSeat.textContent = seatLabel(seat) + (seat.isMid ? t('midSuffix') : '');
        var tdName = document.createElement('td');
        tdName.textContent = seat.name;
        tr.appendChild(tdSeat);
        tr.appendChild(tdName);
        tbody.appendChild(tr);
      });
    }
  }

  pdfBtn.addEventListener('click', function () {
    renderPrintSheet();
    window.print();
  });

  /* ---------- init ---------- */
  applyLanguage();
  render();
})();
