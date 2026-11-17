/* ==========================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   ทำงานตาม element ที่พบในหน้านั้นๆ:
   - #product-list  → หน้า product.html
   - #orderForm     → หน้า order.html
   - #ordersTable   → หน้า admin.html
   ========================================================== */

const PRODUCTS_URL = 'products.json';

const ORDER_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbz-xdszBIUHfxMr24LC_KoJJgQhRzPa37SAeFpJHsKyWY4wMbN2_ccg4yzKIm3ZJOfy/exec';

const ORDERS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRzSQKmwprakelka42qMrgHrAsew4923fx_CZ7uocltNC2ZAcblo6tzMA9fHA9H3KfoWnVOSwnn16_A/pub?gid=0&single=true&output=csv';

const MOODS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'fresh', label: 'Fresh' },
  { key: 'sweet', label: 'Sweet' },
  { key: 'confident', label: 'Confident' },
  { key: 'romance', label: 'Romance' }
];

/* ---------- Helpers ---------- */

// สร้าง element โดยใช้ textContent เสมอ (ป้องกัน HTML injection)
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatPrice(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('th-TH') + ' บาท' : String(value);
}

/* ==========================================================
   1) หน้า product.html
   ========================================================== */

function initProductPage() {
  const list = document.getElementById('product-list');
  const filterBar = document.getElementById('filter-bar');
  if (!list) return;

  let products = [];
  let activeMood = 'all';

  function createCard(p) {
    const card = el('article', 'card');
    card.dataset.mood = p.mood;

    const media = el('div', 'card__media');
    const img = el('img');
    img.src = p.image;
    img.alt = p.name;
    img.loading = 'lazy';
    media.appendChild(img);

    const body = el('div', 'card__body');
    const title = el('h3', 'card__title', p.name);
    body.appendChild(title);
    body.appendChild(el('span', 'mood-rule'));

    if (p.size) {
      body.appendChild(el('p', 'card__meta', p.size));
    }

    body.appendChild(el('p', 'card__price', formatPrice(p.price)));

    // ชื่อสินค้าที่ส่งไปหน้าสั่งซื้อ = ชื่อ + ไซส์ (ถ้ามี)
    const itemLabel = p.size ? p.name + ' ' + p.size : p.name;
    const orderLink = el('a', 'btn', 'สั่งซื้อ');
    orderLink.href =
      'order.html?item=' + encodeURIComponent(itemLabel) +
      '&price=' + encodeURIComponent(p.price);
    body.appendChild(orderLink);

    card.appendChild(media);
    card.appendChild(body);
    return card;
  }

  function render() {
    list.replaceChildren();
    const visible = activeMood === 'all'
      ? products
      : products.filter(p => p.mood === activeMood);

    if (visible.length === 0) {
      list.appendChild(el('p', 'muted', 'ยังไม่มีสินค้าในหมวดนี้'));
      return;
    }
    visible.forEach(p => list.appendChild(createCard(p)));
  }

  function setMood(key) {
    activeMood = key;
    if (filterBar) {
      filterBar.querySelectorAll('button').forEach(btn => {
        btn.setAttribute('aria-pressed', String(btn.dataset.filter === key));
      });
    }
    render();
  }

  function buildFilterBar() {
    if (!filterBar) return;
    filterBar.classList.add('filter');
    filterBar.replaceChildren();

    MOODS.forEach(m => {
      const btn = el('button');
      btn.type = 'button';
      btn.dataset.filter = m.key;
      if (m.key !== 'all') {
        btn.dataset.mood = m.key; // ให้เส้นใต้ปุ่มที่เลือกใช้สี mood
        btn.appendChild(el('span', 'mood-dot'));
      }
      btn.appendChild(document.createTextNode(m.label));
      btn.addEventListener('click', () => setMood(m.key));
      filterBar.appendChild(btn);
    });
  }

  buildFilterBar();
  list.appendChild(el('p', 'muted', 'กำลังโหลดสินค้า...'));

  fetch(PRODUCTS_URL)
    .then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(data => {
      products = data;
      // ?mood=xxx → กรองอัตโนมัติ (ถ้าค่าไม่ถูกต้องให้แสดงทั้งหมด)
      const param = (new URLSearchParams(window.location.search).get('mood') || '').toLowerCase();
      const valid = MOODS.some(m => m.key === param);
      setMood(valid ? param : 'all');
    })
    .catch(error => {
      console.error(error);
      list.replaceChildren(el('p', 'muted', 'โหลดสินค้าไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง'));
    });
}

/* ==========================================================
   2) หน้า order.html
   ========================================================== */

function initOrderPage() {
  const form = document.getElementById('orderForm');
  if (!form) return;

  // เติมค่าจาก URL parameter ลงช่อง items และ total ทันที
  const params = new URLSearchParams(window.location.search);
  const item = params.get('item');
  const price = params.get('price');

  const itemsInput = document.getElementById('items');
  const totalInput = document.getElementById('total');

  if (itemsInput && item !== null) itemsInput.value = item;
  if (totalInput && price !== null) totalInput.value = price;

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    const payload = {
      customerName: document.getElementById('customerName').value,
      contact: document.getElementById('contact').value,
      items: document.getElementById('items').value,
      total: document.getElementById('total').value,
      note: document.getElementById('note').value
    };

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true; // กันกดซ้ำระหว่างส่ง

    fetch(ORDER_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      if (submitBtn) submitBtn.disabled = false;
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
  });
}

/* ==========================================================
   3) หน้า admin.html
   ========================================================== */

// แปลง CSV เป็น array ของแถว รองรับ "..." , "" (escape) และขึ้นบรรทัดใหม่ในช่อง
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // ตัด BOM

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  // แถวสุดท้ายที่ไม่มีขึ้นบรรทัดใหม่ปิดท้าย
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');
  if (!tbody) return;

  const COLUMNS = 6;

  function showMessage(message) {
    const tr = el('tr');
    const td = el('td', 'muted', message);
    td.colSpan = COLUMNS;
    tr.appendChild(td);
    tbody.replaceChildren(tr);
  }

  showMessage('กำลังโหลดข้อมูล...');

  fetch(ORDERS_CSV_URL, { cache: 'no-store' })
    .then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(text => {
      const rows = parseCSV(text)
        .slice(1) // ข้ามแถวหัวตาราง
        .filter(r => r.some(cell => cell.trim() !== ''))
        .reverse(); // แถวใหม่ถูกต่อท้ายชีตเสมอ → กลับลำดับให้ล่าสุดขึ้นก่อน

      if (rows.length === 0) {
        showMessage('ยังไม่มีคำสั่งซื้อ');
        return;
      }

      const fragment = document.createDocumentFragment();
      rows.forEach(r => {
        const tr = el('tr');
        for (let i = 0; i < COLUMNS; i++) {
          tr.appendChild(el('td', '', r[i] !== undefined ? r[i] : ''));
        }
        fragment.appendChild(tr);
      });
      tbody.replaceChildren(fragment);
    })
    .catch(error => {
      console.error(error);
      showMessage('โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง');
    });
}

/* ---------- Init ---------- */

document.addEventListener('DOMContentLoaded', function () {
  initProductPage();
  initOrderPage();
  initAdminPage();
});
