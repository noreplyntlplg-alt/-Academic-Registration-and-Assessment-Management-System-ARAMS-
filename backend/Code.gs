/**
 * ARAMS - Academic Registration and Assessment Management System
 * ============================================================
 * Code.gs — Web App API หลัก (เฟส 1: โครงสร้าง + Login + Dashboard)
 * ------------------------------------------------------------
 * วิธี Deploy:
 *  1. เปิด Google Sheet ที่จะใช้เป็นฐานข้อมูล -> Extensions -> Apps Script
 *  2. วางไฟล์นี้และ SetupSheets.gs ลงในโปรเจกต์
 *  3. รัน setupARAMS() หนึ่งครั้ง (เมนู Run) เพื่อสร้างชีตและบัญชีแอดมิน
 *  4. Deploy -> New deployment -> Type: Web app
 *       - Execute as: Me
 *       - Who has access: Anyone
 *  5. คัดลอก Web app URL ไปใส่ใน frontend/assets/js/config.js (API_URL)
 *
 * หมายเหตุเรื่อง CORS: Apps Script Web App ไม่รองรับ preflight (OPTIONS)
 * ดังนั้นฝั่ง frontend ต้องเรียกแบบ "simple request" เท่านั้น
 * (Content-Type: text/plain สำหรับ POST, และ query string สำหรับ GET)
 * ============================================================
 */

const SESSION_TTL_HOURS = 12;

function doGet(e) {
  return handleRequest_(e.parameter || {});
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    body = e.parameter || {};
  }
  return handleRequest_(body);
}

function handleRequest_(params) {
  const action = params.action || '';
  let result;

  try {
    switch (action) {
      case 'ping':
        result = ok_({ message: 'ARAMS API พร้อมใช้งาน', time: new Date().toISOString() });
        break;
      case 'login':
        result = ok_(login_(params.username, params.password));
        break;
      case 'logout':
        result = ok_(logout_(params.token));
        break;
      case 'validateSession':
        result = ok_(requireSession_(params.token));
        break;
      case 'getDashboardStats':
        requireSession_(params.token);
        result = ok_(getDashboardStats_());
        break;
      case 'createUser':
        result = ok_(createUser_(requireSession_(params.token), params));
        break;
      default:
        result = fail_('ไม่รู้จักคำสั่ง: ' + action, 404);
    }
  } catch (err) {
    result = fail_(err.message || String(err), 401);
  }

  return jsonOutput_(result);
}

// ---------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------

function login_(username, password) {
  if (!username || !password) {
    throw new Error('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
  }

  const sheet = sheet_('Users');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const idx = indexMap_(headers);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[idx.username] === username) {
      if (row[idx.status] !== 'active') {
        throw new Error('บัญชีนี้ถูกระงับการใช้งาน');
      }
      if (row[idx.password_hash] !== hashPassword_(password)) {
        throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }

      const session = {
        token: Utilities.getUuid(),
        user_id: row[idx.user_id],
        username: row[idx.username],
        role: row[idx.role],
        ref_id: row[idx.ref_id],
        full_name: row[idx.full_name]
      };
      createSession_(session);
      sheet.getRange(i + 1, idx.last_login_at + 1).setValue(new Date().toISOString());

      return session;
    }
  }
  throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
}

function logout_(token) {
  const sheet = sheet_('Sessions');
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === token) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return { loggedOut: true };
}

function createSession_(session) {
  const sheet = sheet_('Sessions');
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  sheet.appendRow([
    session.token, session.user_id, session.username, session.role,
    session.ref_id, session.full_name, now.toISOString(), expires.toISOString()
  ]);
}

/** ตรวจสอบ token และคืนข้อมูล session ถ้าถูกต้องและยังไม่หมดอายุ */
function requireSession_(token) {
  if (!token) throw new Error('กรุณาเข้าสู่ระบบ (ไม่พบ token)');

  const sheet = sheet_('Sessions');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const idx = indexMap_(headers);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[idx.token] === token) {
      if (new Date(row[idx.expires_at]) < new Date()) {
        throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      }
      return {
        user_id: row[idx.user_id],
        username: row[idx.username],
        role: row[idx.role],
        ref_id: row[idx.ref_id],
        full_name: row[idx.full_name]
      };
    }
  }
  throw new Error('เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่');
}

// ---------------------------------------------------------------
// USERS (ฟังก์ชันพื้นฐานสำหรับแอดมิน - จะขยายเต็มรูปแบบในเฟสระบบสิทธิ์)
// ---------------------------------------------------------------

function createUser_(session, params) {
  if (session.role !== 'admin') {
    throw new Error('เฉพาะผู้ดูแลระบบเท่านั้นที่เพิ่มผู้ใช้งานได้');
  }
  const allowedRoles = ['admin', 'director', 'academic', 'teacher', 'student', 'parent'];
  if (allowedRoles.indexOf(params.role) === -1) {
    throw new Error('บทบาทไม่ถูกต้อง');
  }
  if (!params.username || !params.password || !params.full_name) {
    throw new Error('กรุณากรอกข้อมูลให้ครบถ้วน');
  }

  const sheet = sheet_('Users');
  const rows = sheet.getDataRange().getValues();
  const existingUsernames = rows.slice(1).map(function (r) { return r[1]; });
  if (existingUsernames.indexOf(params.username) !== -1) {
    throw new Error('ชื่อผู้ใช้นี้มีอยู่แล้ว');
  }

  sheet.appendRow([
    Utilities.getUuid(),
    params.username,
    hashPassword_(params.password),
    params.role,
    params.ref_id || '',
    params.full_name,
    'active',
    new Date().toISOString(),
    ''
  ]);

  return { created: true, username: params.username };
}

// ---------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------

function getDashboardStats_() {
  const students = sheet_('Students').getDataRange().getValues();
  const sIdx = indexMap_(students[0] || []);
  const studentRows = students.slice(1);

  const activeStudents = studentRows.filter(function (r) {
    return r[sIdx.status] === 'กำลังศึกษา' || r[sIdx.status] === '';
  });
  const male = activeStudents.filter(function (r) { return r[sIdx.gender] === 'ชาย'; }).length;
  const female = activeStudents.filter(function (r) { return r[sIdx.gender] === 'หญิง'; }).length;

  const teachers = sheet_('Teachers').getDataRange().getValues();
  const tIdx = indexMap_(teachers[0] || []);
  const activeTeachers = teachers.slice(1).filter(function (r) {
    return r[tIdx.status] === 'active' || r[tIdx.status] === '';
  });

  const classrooms = sheet_('Classrooms').getDataRange().getValues().slice(1);
  const subjects = sheet_('Subjects').getDataRange().getValues();
  const subIdx = indexMap_(subjects[0] || []);
  const activeSubjects = subjects.slice(1).filter(function (r) {
    return r[subIdx.status] === 'active' || r[subIdx.status] === '';
  });

  return {
    totalStudents: activeStudents.length,
    maleStudents: male,
    femaleStudents: female,
    totalTeachers: activeTeachers.length,
    totalClassrooms: classrooms.length,
    totalSubjects: activeSubjects.length,
    // สถิติต่อไปนี้จะเปิดใช้งานในเฟสถัดไป (บันทึกคะแนน / งานมาเรียน)
    pendingModules: {
      grades: 'รอโมดูลบันทึกคะแนน (เฟส 3)',
      remedial: 'รอโมดูลแก้ผลการเรียน (เฟส 4)',
      attendance: 'รอโมดูลงานมาเรียน (เฟส 4)'
    }
  };
}

// ---------------------------------------------------------------
// UTILITIES
// ---------------------------------------------------------------

function sheet_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('ไม่พบชีต "' + name + '" กรุณารัน setupARAMS() ก่อน');
  return sheet;
}

function indexMap_(headers) {
  const map = {};
  headers.forEach(function (h, i) { map[h] = i; });
  return map;
}

function hashPassword_(password) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return digest.map(function (b) {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function ok_(data) {
  return { success: true, data: data };
}

function fail_(message, code) {
  return { success: false, error: message, code: code || 400 };
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
