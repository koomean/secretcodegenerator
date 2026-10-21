'use strict';

(() => {
  /* ===== ตั้งค่า: ใส่ URL ของ Apps Script ที่ลงท้ายด้วย /exec ===== */
  const API_URL = 'https://script.google.com/macros/s/AKfycbwG1WYLYkuXAtIRjBspF4ydTHSeWD9sirg5LE-bZbSzaSuwL9EkiQRyhDExQTznvZGB/exec';

  const REQUEST_TIMEOUT_MS = 30000;
  const CODE_PATTERN = /^[A-Z0-9]{4}$/;
  const API_PATTERN = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
  const LANG_KEY = 'scg_lang';
  const PLACEHOLDER = '----';

  // กันเว็บอื่นเอาหน้านี้ไปฝังใน iframe (Clickjacking) เพราะ CSP ใน meta tag ใช้ frame-ancestors ไม่ได้
  if (window.top !== window.self) {
    document.documentElement.textContent = '';
    return;
  }

  const I18N = {
    th: {
      pageTitle: 'Secret Code Generator | สุ่มรหัสลับ',
      subtitle: 'สุ่มรหัสลับ 4 หลักที่ไม่ซ้ำกับใคร',
      yourCode: 'รหัสของคุณ',
      generate: 'สุ่มรหัส',
      regenerate: 'สุ่มใหม่',
      generating: 'กำลังสุ่ม...',
      copy: 'คัดลอก',
      copied: 'คัดลอกรหัสแล้ว',
      copyFailed: 'คัดลอกไม่สำเร็จ ระบบเลือกรหัสไว้ให้แล้ว กรุณาคัดลอกหรือจดด้วยตนเอง',
      ready: 'กดปุ่มด้านล่างเพื่อรับรหัสของคุณ',
      success: 'จดหรือคัดลอกรหัสไว้ทันที หากออกจากหน้านี้ จะไม่มีใครกู้รหัสคืนให้ได้',
      confirmRegen: 'รหัสเดิมจะถูกทิ้งและใช้ไม่ได้อีก ต้องการสุ่มใหม่ใช่หรือไม่?',
      note1: 'รหัสไม่ซ้ำกับผู้ใช้คนอื่น แม้จะใช้คนละอุปกรณ์',
      note2: 'ระบบไม่บันทึกชื่อ เวลา IP หรือข้อมูลอุปกรณ์',
      note3: 'รหัสของคุณจะไม่ถูกบันทึกไว้ในเบราว์เซอร์นี้',
      github: 'ตรวจสอบ Source Code บน GitHub',
      githubNote: 'โค้ดทั้งหมดเปิดเผยให้ทุกคนตรวจสอบได้ เพื่อความโปร่งใสและความปลอดภัย',
      langLabel: 'ภาษา',
      err_rate_limited: 'ขณะนี้มีผู้ใช้งานจำนวนมาก กรุณารอสักครู่แล้วลองใหม่',
      err_exhausted: 'รหัสถูกใช้ครบจำนวนแล้ว',
      err_busy: 'ระบบไม่ว่าง กรุณาลองใหม่อีกครั้ง',
      err_timeout: 'หมดเวลาการเชื่อมต่อ กรุณาลองใหม่',
      err_network: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต',
      err_generic: 'เกิดข้อผิดพลาด กรุณาลองใหม่',
      err_config: 'ระบบยังไม่ได้ตั้งค่า (ไม่พบ API URL)',
    },
    en: {
      pageTitle: 'Secret Code Generator',
      subtitle: 'Generate a unique 4-character secret code',
      yourCode: 'Your code',
      generate: 'Generate code',
      regenerate: 'Generate new code',
      generating: 'Generating...',
      copy: 'Copy',
      copied: 'Code copied to clipboard',
      copyFailed: 'Copy failed. The code is selected, please copy or write it down manually',
      ready: 'Press the button below to get your code',
      success: 'Write down or copy your code now. Once you leave this page, no one can recover it.',
      confirmRegen: 'Your current code will be discarded and cannot be used again. Generate a new one?',
      note1: 'Every code is unique, even across different devices',
      note2: 'No names, timestamps, IP addresses or device data are stored',
      note3: 'Your code is never saved in this browser',
      github: 'Verify source code on GitHub',
      githubNote: 'All code is open for public review to ensure transparency and security',
      langLabel: 'Language',
      err_rate_limited: 'Too many requests right now. Please wait a moment and try again.',
      err_exhausted: 'All available codes have been issued.',
      err_busy: 'The server is busy. Please try again.',
      err_timeout: 'The request timed out. Please try again.',
      err_network: 'Unable to reach the server. Please check your connection.',
      err_generic: 'Something went wrong. Please try again.',
      err_config: 'This site is not configured yet (missing API URL).',
    },
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    code: $('code'), codeBox: $('codeBox'), spinner: $('spinner'),
    genBtn: $('genBtn'), copyBtn: $('copyBtn'), msg: $('msg'), langSwitch: $('langSwitch'),
  };

  let lang = detectLang();
  let hasCode = false;
  let loading = false;
  let msgKey = 'ready';
  let msgError = false;

  /* ---------- ภาษา ---------- */
  function detectLang() {
    try {
      const saved = localStorage.getItem(LANG_KEY); // เก็บเฉพาะภาษาที่เลือก ไม่เก็บรหัส
      if (saved === 'th' || saved === 'en') return saved;
    } catch (_) { /* โหมดส่วนตัวบางเบราว์เซอร์ใช้ localStorage ไม่ได้ */ }

    const list = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || 'en'];
    for (const l of list) {
      const c = String(l).toLowerCase().slice(0, 2);
      if (c === 'th' || c === 'en') return c;
    }
    return 'en';
  }

  const t = (key) => I18N[lang][key];
  const hasKey = (key) => Object.prototype.hasOwnProperty.call(I18N.en, key);

  function setLang(next) {
    if (next !== 'th' && next !== 'en') return;
    lang = next;
    try { localStorage.setItem(LANG_KEY, next); } catch (_) {}
    render();
  }

  /* ---------- แสดงผล (ใช้ textContent ทั้งหมด ไม่มี innerHTML) ---------- */
  function render() {
    document.documentElement.lang = lang;
    document.title = t('pageTitle');
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    els.langSwitch.setAttribute('aria-label', t('langLabel'));
    document.querySelectorAll('.lang-btn').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    });
    els.spinner.setAttribute('aria-label', t('generating'));
    els.genBtn.textContent = loading ? t('generating') : hasCode ? t('regenerate') : t('generate');
    els.msg.textContent = msgKey ? t(msgKey) : '';
    els.msg.classList.toggle('is-error', msgError);
  }

  function setMsg(key, isError = false) {
    msgKey = key;
    msgError = isError;
    render();
  }

  function setLoading(on) {
    loading = on;
    els.genBtn.disabled = on;
    els.codeBox.setAttribute('aria-busy', String(on));
    els.spinner.hidden = !on;
    els.code.hidden = on;
    els.copyBtn.hidden = on || !hasCode;
    render();
  }

  function showCode(code) {
    hasCode = true;
    els.code.textContent = code;
    els.code.classList.remove('is-empty', 'reveal');
    void els.code.offsetWidth; // รีสตาร์ตแอนิเมชัน
    els.code.classList.add('reveal');
  }

  function clearCode() {
    hasCode = false;
    els.code.textContent = PLACEHOLDER;
    els.code.classList.add('is-empty');
    els.copyBtn.hidden = true;
  }

  /* ---------- สุ่มรหัส ---------- */
  class AppError extends Error {
    constructor(key) { super(key); this.key = key; }
  }

  async function generate() {
    if (loading) return;
    if (hasCode && !window.confirm(t('confirmRegen'))) return;

    msgKey = '';
    msgError = false;
    setLoading(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // เลี่ยง CORS preflight
        body: JSON.stringify({ action: 'generate' }),
        cache: 'no-store',
        credentials: 'omit',          // ไม่ส่งคุกกี้หรือบัญชี Google
        referrerPolicy: 'no-referrer',
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!res.ok) throw new AppError('err_generic');

      const data = await res.json();
      if (!data || data.ok !== true) {
        const key = 'err_' + String(data && data.error);
        throw new AppError(hasKey(key) ? key : 'err_generic');
      }
      // ตรวจรูปแบบรหัสก่อนแสดงผลทุกครั้ง
      if (typeof data.code !== 'string' || !CODE_PATTERN.test(data.code)) {
        throw new AppError('err_generic');
      }

      showCode(data.code);
      msgKey = 'success';
      msgError = false;
    } catch (err) {
      msgKey = err instanceof AppError ? err.key
        : err.name === 'AbortError' ? 'err_timeout'
        : err instanceof TypeError ? 'err_network'
        : 'err_generic';
      msgError = true;
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  /* ---------- คัดลอก ---------- */
  async function copyCode() {
    const code = els.code.textContent;
    if (!hasCode || !CODE_PATTERN.test(code)) return;
    try {
      await navigator.clipboard.writeText(code);
      setMsg('copied');
    } catch (_) {
      const range = document.createRange();
      range.selectNodeContents(els.code);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      setMsg('copyFailed', true);
    }
  }

  /* ---------- เริ่มต้น ---------- */
  els.genBtn.addEventListener('click', generate);
  els.copyBtn.addEventListener('click', copyCode);
  els.langSwitch.addEventListener('click', (e) => {
    const btn = e.target.closest('.lang-btn');
    if (btn) setLang(btn.dataset.lang);
  });

  // ล้างรหัสออกจากหน้าเมื่อออกจากหน้า กันคนที่ใช้เครื่องต่อกดย้อนกลับ (Back) แล้วเห็นรหัส
  window.addEventListener('pagehide', () => {
    clearCode();
    msgKey = 'ready';
    msgError = false;
    render();
  });

  if (!API_PATTERN.test(API_URL)) {
    msgKey = 'err_config';
    msgError = true;
    els.genBtn.disabled = true;
  }

  render();
})();