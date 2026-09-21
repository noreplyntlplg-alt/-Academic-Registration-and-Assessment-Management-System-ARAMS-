/**
 * ARAMS - Academic Registration and Assessment Management System
 * ============================================================
 * SetupSheets.gs
 * ------------------------------------------------------------
 * รันฟังก์ชัน setupARAMS() เพียงครั้งเดียว (จากเมนู Run ใน Apps Script
 * Editor) เพื่อสร้างชีตทั้งหมดของระบบ พร้อมสร้างหัวตาราง (header)
 * ให้อัตโนมัติ จัดรูปแบบหัวตาราง และสร้างบัญชีผู้ดูแลระบบเริ่มต้น
 *
 * ปลอดภัย: หากรันซ้ำ ฟังก์ชันจะไม่ลบข้อมูลที่มีอยู่แล้ว - จะข้ามชีต
 * ที่มีอยู่แล้วไป (ยกเว้นจะเรียก resetARAMS() ซึ่งจะลบทุกอย่างทิ้ง)
 * ============================================================
 */

// ---- นิยามโครงสร้างชีตทั้งหมดของระบบ (เพิ่มชีตใหม่ที่นี่ในเฟสถัดไป) ----
const SHEET_SCHEMA = {
  Users: [
    'user_id', 'username', 'password_hash', 'role', 'ref_id',
    'full_name', 'status', 'created_at', 'last_login_at'
  ],
  Students: [
    'student_id', 'citizen_id', 'prefix', 'first_name', 'last_name',
    'birthdate', 'gender', 'level', 'room', 'academic_year',
    'photo_url', 'address', 'parent_name', 'parent_phone', 'phone',
    'status', 'created_at'
  ],
  Teachers: [
    'teacher_id', 'prefix', 'first_name', 'last_name', 'subject_group',
    'phone', 'email', 'status', 'created_at'
  ],
  Classrooms: [
    'classroom_id', 'level', 'room', 'academic_year',
    'homeroom_teacher_id', 'created_at'
  ],
  Subjects: [
    'subject_code', 'subject_name', 'subject_group', 'subject_type',
    'credit', 'hours_per_week', 'level', 'status', 'created_at'
  ],
  Settings: ['key', 'value'],
  Sessions: [
    'token', 'user_id', 'username', 'role', 'ref_id', 'full_name',
    'created_at', 'expires_at'
  ]
};

// ค่าตั้งต้นของโรงเรียน (แก้ไขได้ภายหลังในหน้าตั้งค่าระบบ เฟสท้ายๆ)
const DEFAULT_SETTINGS = {
  school_name: 'โรงเรียนตัวอย่าง',
  address: '',
  phone: '',
  website: '',
  logo_url: '',
  current_academic_year: String(new Date().getFullYear() + 543),
  current_semester: '1'
};

// บัญชีผู้ดูแลระบบเริ่มต้นตามที่กำหนด
const DEFAULT_ADMIN = {
  username: 'sxaiq54',
  password: 'Sxxnga2011',
  full_name: 'ผู้ดูแลระบบ',
  role: 'admin'
};

function setupARAMS() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(SHEET_SCHEMA).forEach(function (sheetName) {
    let sheet = ss.getSheetByName(sheetName);
    const isNew = !sheet;
    if (isNew) {
      sheet = ss.insertSheet(sheetName);
    }
    writeHeaderRow_(sheet, SHEET_SCHEMA[sheetName]);
  });

  // ลบ Sheet1 เริ่มต้นของ Google ถ้ายังไม่ได้ใช้งานและมีชีตอื่นแล้ว
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  seedSettings_();
  seedDefaultAdmin_();

  SpreadsheetApp.flush();
  Logger.log('ARAMS setup complete: sheets = ' + Object.keys(SHEET_SCHEMA).join(', '));
}

/** สร้าง/จัดรูปแบบแถวหัวตารางให้อัตโนมัติ โดยไม่ทับข้อมูลแถวอื่น */
function writeHeaderRow_(sheet, headers) {
  const range = sheet.getRange(1, 1, 1, headers.length);
  range.setValues([headers]);
  range.setFontWeight('bold');
  range.setFontColor('#FFFFFF');
  range.setBackground('#1B3A5C');
  range.setFontFamily('TH Sarabun New');
  range.setFontSize(12);
  range.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function seedSettings_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  const existing = sheet.getDataRange().getValues();
  const existingKeys = existing.slice(1).map(function (row) { return row[0]; });

  Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
    if (existingKeys.indexOf(key) === -1) {
      sheet.appendRow([key, DEFAULT_SETTINGS[key]]);
    }
  });
}

function seedDefaultAdmin_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  const usernames = data.slice(1).map(function (row) { return row[1]; });

  if (usernames.indexOf(DEFAULT_ADMIN.username) !== -1) {
    return; // มีอยู่แล้ว ไม่สร้างซ้ำ
  }

  sheet.appendRow([
    Utilities.getUuid(),
    DEFAULT_ADMIN.username,
    hashPassword_(DEFAULT_ADMIN.password),
    DEFAULT_ADMIN.role,
    '',
    DEFAULT_ADMIN.full_name,
    'active',
    new Date().toISOString(),
    ''
  ]);
}

/**
 * อันตราย: ลบทุกชีตและข้อมูลทั้งหมดของระบบ แล้วสร้างใหม่ทั้งหมด
 * ใช้เฉพาะตอนพัฒนา/ทดสอบเท่านั้น ห้ามรันบนระบบจริงที่มีข้อมูลแล้ว
 */
function resetARAMS() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEET_SCHEMA).forEach(function (sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) ss.deleteSheet(sheet);
  });
  ss.insertSheet('Sheet1');
  setupARAMS();
}
