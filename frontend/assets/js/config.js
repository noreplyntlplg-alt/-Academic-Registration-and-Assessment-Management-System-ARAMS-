/**
 * ARAMS - config.js
 * -----------------
 * แก้ค่า API_URL ให้เป็น Web app URL ที่ได้จากการ Deploy Apps Script
 * เช่น https://script.google.com/macros/s/XXXXXXXXXXXXXXXX/exec
 */
const API_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';

/**
 * เรียก API แบบ POST (สำหรับ action ที่มีข้อมูลอ่อนไหว เช่น login, createUser)
 * ใช้ Content-Type: text/plain เพื่อให้เบราว์เซอร์ส่งเป็น "simple request"
 * ซึ่ง Apps Script Web App รองรับโดยไม่ต้องทำ CORS preflight
 */
async function apiPost(action, payload) {
  const body = Object.assign({ action: action }, payload || {});
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  });
  return parseApiResponse_(res);
}

/** เรียก API แบบ GET (สำหรับดึงข้อมูลทั่วไป เช่น dashboard stats) */
async function apiGet(action, params) {
  const query = new URLSearchParams(Object.assign({ action: action }, params || {}));
  const res = await fetch(API_URL + '?' + query.toString());
  return parseApiResponse_(res);
}

async function parseApiResponse_(res) {
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ');
  }
  return json.data;
}

// ---- ช่วยจัดการ session ในเบราว์เซอร์ ----
const Session = {
  save(session) {
    localStorage.setItem('arams_session', JSON.stringify(session));
  },
  get() {
    const raw = localStorage.getItem('arams_session');
    return raw ? JSON.parse(raw) : null;
  },
  clear() {
    localStorage.removeItem('arams_session');
  },
  requireLoginOrRedirect() {
    const session = this.get();
    if (!session || !session.token) {
      window.location.href = 'index.html';
      return null;
    }
    return session;
  }
};

const ROLE_LABELS = {
  admin: 'ผู้ดูแลระบบ',
  director: 'ผู้อำนวยการ',
  academic: 'รองผู้อำนวยการ/ฝ่ายวิชาการ',
  teacher: 'ครู',
  student: 'นักเรียน',
  parent: 'ผู้ปกครอง'
};
