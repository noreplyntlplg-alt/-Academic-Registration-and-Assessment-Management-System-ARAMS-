(function () {
  const session = Session.requireLoginOrRedirect();
  if (!session) return;

  renderUserChip();
  setupAdminControls();
  loadDashboardStats();

  document.getElementById('logoutBtn').addEventListener('click', async function () {
    try { await apiPost('logout', { token: session.token }); } catch (e) { /* ignore */ }
    Session.clear();
    window.location.href = 'index.html';
  });

  function renderUserChip() {
    document.getElementById('userFullName').textContent = session.full_name || session.username;
    document.getElementById('userRole').textContent = ROLE_LABELS[session.role] || session.role;
    const initial = (session.full_name || session.username || '?').trim().charAt(0);
    document.getElementById('avatarInitial').textContent = initial.toUpperCase();
  }

  async function loadDashboardStats() {
    const grid = document.getElementById('mainStatGrid');
    grid.innerHTML = '<p style="color:var(--text-muted);">กำลังโหลดข้อมูล...</p>';

    try {
      const stats = await apiGet('getDashboardStats', { token: session.token });
      renderStatCards(stats);
      renderPendingModules(stats.pendingModules);
    } catch (err) {
      grid.innerHTML = '<div class="form-error show">' + err.message + '</div>';
      if (/เซสชัน/.test(err.message)) {
        Session.clear();
        setTimeout(function () { window.location.href = 'index.html'; }, 1200);
      }
    }
  }

  function renderStatCards(stats) {
    const cards = [
      { icon: 'fa-user-graduate', label: 'นักเรียนทั้งหมด', value: stats.totalStudents, accent: true },
      { icon: 'fa-mars', label: 'นักเรียนชาย', value: stats.maleStudents },
      { icon: 'fa-venus', label: 'นักเรียนหญิง', value: stats.femaleStudents },
      { icon: 'fa-chalkboard-user', label: 'ครูทั้งหมด', value: stats.totalTeachers },
      { icon: 'fa-door-open', label: 'ห้องเรียนทั้งหมด', value: stats.totalClassrooms },
      { icon: 'fa-book-open', label: 'รายวิชาทั้งหมด', value: stats.totalSubjects }
    ];

    const grid = document.getElementById('mainStatGrid');
    grid.innerHTML = cards.map(function (c) {
      return (
        '<div class="stat-card' + (c.accent ? ' accent' : '') + '">' +
          '<div class="icon"><i class="fa-solid ' + c.icon + '"></i></div>' +
          '<div>' +
            '<div class="value">' + c.value + '</div>' +
            '<div class="label">' + c.label + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function renderPendingModules(pending) {
    const list = document.getElementById('pendingList');
    list.innerHTML = Object.values(pending || {}).map(function (text) {
      return '<li><i class="fa-solid fa-hourglass-half"></i>' + text + '</li>';
    }).join('');
  }

  // -------- เมนูจัดการผู้ใช้งาน (เฉพาะแอดมิน) --------
  function setupAdminControls() {
    const isAdmin = session.role === 'admin';
    const fab = document.getElementById('fabAddUser');
    const overlay = document.getElementById('userModalOverlay');
    const navUsers = document.getElementById('navUsers');

    if (!isAdmin) {
      navUsers.classList.add('disabled');
      navUsers.innerHTML = '<i class="fa-solid fa-users-gear"></i> จัดการผู้ใช้งาน <span class="soon-tag">สิทธิ์แอดมิน</span>';
      return;
    }

    fab.style.display = 'flex';
    navUsers.addEventListener('click', openModal);
    fab.addEventListener('click', openModal);
    document.getElementById('cancelUserModal').addEventListener('click', closeModal);

    document.getElementById('addUserForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const errorBox = document.getElementById('userFormError');
      errorBox.classList.remove('show');

      const payload = {
        token: session.token,
        full_name: document.getElementById('newFullName').value.trim(),
        username: document.getElementById('newUsername').value.trim(),
        password: document.getElementById('newPassword').value,
        role: document.getElementById('newRole').value
      };

      const btn = document.getElementById('saveUserBtn');
      btn.disabled = true;
      try {
        await apiPost('createUser', payload);
        closeModal();
        document.getElementById('addUserForm').reset();
        alert('เพิ่มผู้ใช้งาน "' + payload.username + '" เรียบร้อยแล้ว');
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.add('show');
      } finally {
        btn.disabled = false;
      }
    });

    function openModal() { overlay.classList.add('show'); }
    function closeModal() { overlay.classList.remove('show'); }
  }
})();
