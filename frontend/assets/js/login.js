(function () {
  const form = document.getElementById('loginForm');
  const errorBox = document.getElementById('formError');
  const submitBtn = document.getElementById('submitBtn');

  // ถ้ามี session ที่ยังไม่หมดอายุอยู่แล้ว ให้เด้งไปหน้า dashboard ทันที
  const existing = Session.get();
  if (existing && existing.token) {
    window.location.href = 'dashboard.html';
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    hideError();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    setLoading(true);
    try {
      const session = await apiPost('login', { username, password });
      Session.save(session);
      window.location.href = 'dashboard.html';
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  });

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.add('show');
  }

  function hideError() {
    errorBox.classList.remove('show');
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.querySelector('span').textContent = isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ';
  }
})();
