/***** ตั้งค่า *****/
const SHEET_NAME = 'Codes';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const CHARS = LETTERS + DIGITS;
const CODE_LEN = 4;
const MAX_CODES = 100000;
const RATE_LIMIT_PER_MIN = 60;
const PUBLIC_ERRORS = ['rate_limited', 'exhausted', 'busy'];

// ไม่บันทึกเวลา, IP, ข้อมูลผู้ใช้ และไม่มี console.log
function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action !== 'generate') return json_({ ok: false, error: 'invalid_request' });
    return json_({ ok: true, code: generateCode_() });
  } catch (err) {
    const msg = PUBLIC_ERRORS.includes(err.message) ? err.message : 'server_error';
    return json_({ ok: false, error: msg });
  }
}

function doGet() {
  return json_({ ok: true, status: 'online' });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  sh.getRange('A:A').setNumberFormat('@'); // กันชีตแปลงรหัสอย่าง 1E23 เป็นตัวเลข
  return sh;
}

function generateCode_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('busy');
  try {
    // จำกัดจำนวนคำขอรวมต่อนาที โดยไม่ระบุว่าใครเป็นคนขอ
    const cache = CacheService.getScriptCache();
    const rlKey = 'rl_' + Math.floor(Date.now() / 60000);
    const count = Number(cache.get(rlKey) || 0);
    if (count >= RATE_LIMIT_PER_MIN) throw new Error('rate_limited');
    cache.put(rlKey, String(count + 1), 120);

    const sh = getSheet_();
    const last = sh.getLastRow();
    const used = new Set(
      last > 0 ? sh.getRange(1, 1, last, 1).getDisplayValues().flat() : []
    );
    if (used.size >= MAX_CODES) throw new Error('exhausted');

    let code;
    do { code = randomCode_(); } while (used.has(code));

    sh.getRange(last + 1, 1).setValue(code);
    sh.getRange(1, 1, last + 1, 1).sort(1); // เรียงตามตัวอักษร เพื่อไม่ให้ลำดับแถวบอกได้ว่าใครสุ่มก่อนหลัง
    SpreadsheetApp.flush();
    return code;
  } finally {
    lock.releaseLock();
  }
}

// สุ่มแบบเข้ารหัส (UUID + SHA-256) ทุกตัวอักษรมีโอกาสออกเท่ากัน
function randomCode_() {
  const limit = 256 - (256 % CHARS.length);
  while (true) {
    const bytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      Utilities.getUuid() + Utilities.getUuid()
    );
    let code = '';
    for (let i = 0; i < bytes.length && code.length < CODE_LEN; i++) {
      const v = bytes[i] & 0xff;
      if (v < limit) code += CHARS[v % CHARS.length];
    }
    if (code.length === CODE_LEN && /[A-Z]/.test(code) && /[0-9]/.test(code)) return code;
  }
}

// ใช้ล้างรหัสตอนทดสอบ ต้องกดรันเองจากหน้า editor เท่านั้น
function resetAllCodes() {
  getSheet_().clear();
}