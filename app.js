// ========================================================
// นำ URL ของ Web App จาก Google Apps Script มาใส่ตรงนี้
// ========================================================
const API_URL = "https://script.google.com/macros/s/AKfycbwgG8bb9gooS7ITQ-K1LLBYr4CoNXHyU3E_bGwQQ4V26mWm44StrAa0yKScM4jmmbCdBQ/exec"; 

// --- ระบบ Authentication ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const btn = document.getElementById('btn-login');
    const msg = document.getElementById('login-msg');

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังตรวจสอบ...';
    btn.disabled = true;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: "LOGIN",
                payload: { username: user, password: pass }
            })
        });
        const result = await response.json();

        if (result.status === "success") {
            // เก็บข้อมูล User ลง Session
            sessionStorage.setItem('arams_user', JSON.stringify(result.user));
            initApp(); // เริ่มแอปพลิเคชัน
        } else {
            msg.innerText = result.message;
        }
    } catch (error) {
        msg.innerText = "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์";
    } finally {
        btn.innerHTML = 'เข้าสู่ระบบ';
        btn.disabled = false;
    }
});

function initApp() {
    const userJson = sessionStorage.getItem('arams_user');
    if (!userJson) return;

    const user = JSON.parse(userJson);
    
    // อัพเดท UI
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    document.getElementById('user-fullname').innerText = user.FullName;
    document.getElementById('user-role').innerText = user.Role;

    // โหลดข้อมูลเริ่มต้น (Dashboard & Students)
    loadStudentData();
}

function logout() {
    sessionStorage.removeItem('arams_user');
    document.getElementById('app-container').classList.add('hidden');
    document.getElementById('login-container').classList.remove('hidden');
    document.getElementById('login-form').reset();
    document.getElementById('login-msg').innerText = "";
}

// --- ระบบ Navigation (SPA Routing) ---
function switchMenu(moduleName) {
    // ลบ Active จากเมนูทั้งหมด
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
    // เพิ่ม Active ให้เมนูที่ถูกคลิก
    event.currentTarget.classList.add('active');

    // ซ่อนทุก Module
    document.querySelectorAll('.module-section').forEach(sec => sec.classList.add('hidden'));
    
    // แสดง Module ที่เลือก
    document.getElementById(`module-${moduleName}`).classList.remove('hidden');

    // เปลี่ยน Title ด้านบน
    const titles = {
        'dashboard': 'หน้าหลัก / Dashboard',
        'students': 'งานทะเบียนนักเรียน'
    };
    document.getElementById('page-title').innerText = titles[moduleName] || 'ARAMS';
}

// --- โมดูลทะเบียนนักเรียน (CRUD Example) ---
async function loadStudentData() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "GET_STUDENTS" })
        });
        const result = await response.json();
        
        const tbody = document.getElementById('student-table-body');
        tbody.innerHTML = '';

        if (result.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">ไม่พบข้อมูลนักเรียน</td></tr>';
            return;
        }

        // อัพเดทสถิติใน Dashboard ไปด้วย
        document.getElementById('stat-total-students').innerText = result.data.length;

        result.data.forEach(student => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${student.StudentID}</td>
                <td>${student.Prefix}${student.FirstName} ${student.LastName}</td>
                <td>ม.${student.Class}</td>
                <td>${student.Room}</td>
                <td><span style="color: ${student.Status === 'ปกติ' ? 'green' : 'orange'}">${student.Status}</span></td>
                <td>
                    <button class="icon-btn text-primary"><i class="fas fa-edit"></i></button>
                    <button class="icon-btn text-danger"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error loading students:", error);
    }
}

// เช็คสถานะ Login เมื่อเปิดหน้าเว็บ
window.onload = () => {
    if (sessionStorage.getItem('arams_user')) {
        initApp();
    }
};
