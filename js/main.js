// js/main.js
window.addEventListener('DOMContentLoaded', () => {
  const INACTIVITY_LIMIT = 10 * 60 * 1000;
  function login(name) {
      // 관리자 로그인 시 admin.html로 리디렉트
      if (name === 'admin') {
        window.location.href = 'admin.html';
        return;
      }
      currentUser = name;
      localStorage.setItem('app_current', name);
      showApp();

  // 유틸
  const getUsers = () => JSON.parse(localStorage.getItem('app_users')||'[]');
  const saveUsers = u => localStorage.setItem('app_users', JSON.stringify(u));
  const getData = () => JSON.parse(localStorage.getItem('app_data')||'{}');
  const saveData = d => localStorage.setItem('app_data', JSON.stringify(d));
  const updateActivity = () => localStorage.setItem('lastActivity', Date.now());

  // DOM 요소
  const authDiv = document.getElementById('auth');
  const formLogin = document.getElementById('formLogin');
  const formRegister = document.getElementById('formRegister');
  const appDiv = document.getElementById('app');
  const historyDiv = document.getElementById('history');
  const welcome = document.getElementById('welcome');
  const timerEl = document.getElementById('timer');
  const calBody = document.getElementById('calendar');
  const monthLabel = document.getElementById('monthLabel');
  const selDatesEl = document.getElementById('selectedDates');
  const selCountEl = document.getElementById('selCount');
  const applyBtn = document.getElementById('applyBtn');
  const myList = document.getElementById('myList');

  let currentUser = localStorage.getItem('app_current')||'';
  let cur = new Date();
  let selected = [];
  let timerInterval;

  // 타이머
  function startTimer() {
    function tick() {
      const last = +localStorage.getItem('lastActivity') || 0;
      const diff = INACTIVITY_LIMIT - (Date.now() - last);
      if (diff <= 0) { alert('자동 로그아웃 됩니다.'); logout(); return; }
      const m = String(Math.floor(diff/60000)).padStart(2,'0');
      const s = String(Math.floor((diff%60000)/1000)).padStart(2,'0');
      timerEl.textContent = `${m}:${s}`;
    }
    tick();
    return setInterval(tick, 1000);
  }

  // 뷰 전환
  function showAuth() {
    authDiv.classList.remove('hidden');
    appDiv.classList.add('hidden');
    historyDiv.classList.add('hidden');
    clearInterval(timerInterval);
  }
  function showApp() {
    if (!currentUser) return showAuth();
    authDiv.classList.add('hidden');
    appDiv.classList.remove('hidden');
    historyDiv.classList.remove('hidden');
    welcome.textContent = `${currentUser} 선생님 🐥`;
    updateActivity();
    timerInterval = startTimer();
    renderCalendar();
    renderMyList();
    updateSelectionUI();
  }

  // 로그인/로그아웃
  function login(name) {
    currentUser = name;
    localStorage.setItem('app_current', name);
    showApp();
  }
  function logout() {
    localStorage.removeItem('app_current');
    currentUser = '';
    showAuth();
  }

  // 이벤트 바인딩
  formRegister.onsubmit = e => {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const pw = document.getElementById('regPw').value;
    if (!allowedNames.includes(name)) {
      alert('허용된 이름이 아닙니다.'); return;
    }
    const users = getUsers();
    if (users.find(u=>u.name===name)) { alert('이미 존재하는 이름입니다.'); return; }
    users.push({name, pw}); saveUsers(users);
    alert('가입 완료');
    formRegister.classList.add('hidden');
    formLogin.classList.remove('hidden');
  };
  formLogin.onsubmit = e => {
    e.preventDefault();
    const name = document.getElementById('loginName').value.trim();
    const pw = document.getElementById('loginPw').value;
    const u = getUsers().find(u=>u.name===name && u.pw===pw);
    if (!u) { alert('로그인 실패'); return; }
    login(name);
  };
  document.getElementById('showLogin').onclick = () => { formLogin.classList.remove('hidden'); formRegister.classList.add('hidden'); showAuth(); };
  document.getElementById('showRegister').onclick = () => { formRegister.classList.remove('hidden'); formLogin.classList.add('hidden'); showAuth(); };
  document.getElementById('logout').onclick = logout;

  // 네비게이션
  document.getElementById('prev').onclick = () => { cur.setMonth(cur.getMonth()-1); renderCalendar(); };
  document.getElementById('next').onclick = () => { cur.setMonth(cur.getMonth()+1); renderCalendar(); };
  applyBtn.onclick = () => applySelected();

  // 신청 처리
  function applySelected() {
    const data = getData();
    const year = cur.getFullYear(), month = cur.getMonth();
    const exist = countThisMonth(currentUser, data, year, month);
    if (exist + selected.length > 8) {
      alert(`한 달 최대 8일(현재 ${exist}일) 초과`);
      return;
    }
    selected.forEach(ds => {
      const arr = data[ds] || [];
      if (arr.length < 3 && !arr.includes(currentUser)) arr.push(currentUser);
      data[ds] = arr;
    });
    saveData(data);
    selected = [];
    renderCalendar(); renderMyList(); updateSelectionUI();
  }

  function countThisMonth(user, data, year, month) {
    return Object.entries(data).filter(([date, arr]) => {
      if (!arr.includes(user)) return false;
      const [y, m] = date.split('-').map(Number);
      return y === year && m-1 === month;
    }).length;
  }

  // 달력 렌더링
  function renderCalendar() {
    calBody.innerHTML = '';
    monthLabel.textContent = `${cur.getFullYear()}년 ${cur.getMonth()+1}월`;
    const firstDay = new Date(cur.getFullYear(),cur.getMonth(),1).getDay();
    const days = new Date(cur.getFullYear(),cur.getMonth()+1,0).getDate();
    let row = document.createElement('tr');
    for (let i=0;i<firstDay;i++) row.appendChild(makeCell(''));
    const data = getData();
    for (let d=1; d<=days; d++) {
      if ((firstDay+d-1)%7===0 && d!==1) { calBody.appendChild(row); row=document.createElement('tr'); }
      const ds = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const arr = data[ds]||[];
      row.appendChild(makeCell(d, false, ds, arr));
    }
    while (row.children.length < 7) row.appendChild(makeCell(''));
    calBody.appendChild(row);
    updateSelectionUI();
  }

  // 셀 생성 및 선택 로직 (연속 제한 포함)
  function makeCell(day, disabled=false, ds='', arr=[]) {
    const td = document.createElement('td');
    td.className = disabled ? 'disabled p-2' : 'p-2';
    if (!disabled && day) {
      if (arr.includes(currentUser)) {
        td.classList.add('bg-red-100');
        td.onclick = () => alert('이미 신청한 날짜입니다.');
      } else {
        td.classList.add('cursor-pointer','hover:bg-blue-50');
        td.onclick = () => toggleSelect(ds);
      }
    }
    td.innerHTML = disabled ? '' : `<div>${day}</div><div class="count text-sm text-gray-600">${arr.length}/3</div>`;
    return td;
  }

  function isConsecutive(dates) {
    const ds = dates.map(d => new Date(d).setHours(0,0,0,0));
    const uniq = Array.from(new Set(ds)).sort((a,b)=>a-b);
    let run = 1;
    for (let i=1; i<uniq.length; i++) {
      if (uniq[i] - uniq[i-1] === 86400000) { run++; if (run>3) return false; } else run=1;
    }
    return true;
  }

  function toggleSelect(ds) {
    const idx = selected.indexOf(ds);
    const data = getData();
    const existing = Object.keys(data).filter(date=>{
      const arr = data[date]; if (!arr.includes(currentUser)) return false;
      const [y,m] = date.split('-').map(Number);
      return y===cur.getFullYear() && m-1===cur.getMonth();
    });
    let temp = idx >=0 ? selected.filter(d=>d!==ds) : [...selected, ds];
    if (!isConsecutive(existing.concat(temp))) {
      alert('연속 신청은 최대 3일까지만 가능합니다.'); return;
    }
    if (idx>=0) selected.splice(idx,1); else { if (selected.length>=3) { alert('최대 3일 선택 가능합니다.'); return; } selected.push(ds); }
    updateSelectionUI();
  }

  function updateSelectionUI() {
    document.querySelectorAll('#calendar td').forEach(td=>td.classList.remove('bg-blue-200'));
    selected.forEach(ds=>{
      document.querySelectorAll('#calendar td').forEach(td=>{ if(td.innerText.startsWith(String(Number(ds.slice(-2))))) td.classList.add('bg-blue-200'); });
    });
    selDatesEl.textContent = selected.join(', ')||'없음';
    selCountEl.textContent = selected.length;
    applyBtn.disabled = selected.length===0;
  }

  function renderMyList() {
    myList.innerHTML = '';
    const data = getData();
    Object.keys(data).filter(date=>data[date].includes(currentUser)).sort().forEach(date=>{
      const li = document.createElement('li');
      li.className = 'flex justify-between items-center';
      li.innerHTML = `<span>${date}</span><button class="text-red-500">X</button>`;
      li.querySelector('button').onclick = () => {
        if(!confirm('취소할까요?')) return;
        data[date] = data[date].filter(n=>n!==currentUser);
        if(!data[date].length) delete data[date];
        saveData(data); renderCalendar(); renderMyList();
      };
      myList.appendChild(li);
    });
  }

  ['click','keydown','mousemove'].forEach(evt=>document.addEventListener(evt,updateActivity));
  if (currentUser) { updateActivity(); showApp(); } else showAuth();
});
