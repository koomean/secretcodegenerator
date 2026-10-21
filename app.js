// ใส่ URL ที่ได้จากการ Deploy Web App (ลงท้ายด้วย /exec)
const API_URL = 'https://script.google.com/macros/s/AKfycbwG1WYLYkuXAtIRjBspF4ydTHSeWD9sirg5LE-bZbSzaSuwL9EkiQRyhDExQTznvZGB/exec';

const $ = id => document.getElementById(id);
const ERRORS = {
  rate_limited: 'ตอนนี้มีคนใช้งานเยอะ กรุณารอสักครู่แล้วลองใหม่',
  exhausted: 'รหัสถูกใช้หมดแล้ว',
  busy: 'ระบบไม่ว่าง กรุณาลองใหม่',
};

$('genBtn').addEventListener('click', generate);
$('copyBtn').addEventListener('click', copyCode);

async function generate() {
  const btn = $('genBtn');
  const hasCode = $('code').textContent !== '----';
  if (hasCode && !confirm('รหัสเดิมจะถูกทิ้งและใช้ไม่ได้อีก ต้องการสุ่มใหม่ใช่ไหม?')) return;

  btn.disabled = true;
  btn.textContent = 'กำลังสุ่ม...';
  $('msg').textContent = '';

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // ใช้ text/plain เพื่อเลี่ยงปัญหา CORS preflight
      body: JSON.stringify({ action: 'generate' }),
      cache: 'no-store',
      credentials: 'omit',          // ไม่ส่งคุกกี้หรือบัญชี Google ไปด้วย
      referrerPolicy: 'no-referrer',
      redirect: 'follow',
    });
    const data = await res.json();
    if (!data.ok) throw new Error(ERRORS[data.error] || 'เกิดข้อผิดพลาด กรุณาลองใหม่');

    $('code').textContent = data.code;
    $('copyBtn').hidden = false;
    $('msg').textContent = 'จดหรือคัดลอกรหัสไว้ทันที ถ้าปิดหน้านี้ไป จะไม่มีใครกู้รหัสคืนให้ได้';
    btn.textContent = 'สุ่มใหม่';
  } catch (err) {
    $('msg').textContent = err instanceof TypeError
      ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่'
      : err.message;
    btn.textContent = hasCode ? 'สุ่มใหม่' : 'ลองอีกครั้ง';
  } finally {
    btn.disabled = false;
  }
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText($('code').textContent);
    $('msg').textContent = 'คัดลอกแล้ว';
  } catch {
    $('msg').textContent = 'คัดลอกไม่สำเร็จ กรุณาจดรหัสเอง';
  }
}