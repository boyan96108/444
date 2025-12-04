alert("script.js 已載入");
/**
 * 簡單記帳本主程式
 * - 新增／刪除紀錄
 * - LocalStorage 永續化
 * - 即時更新總金額
 * - 可選：同步寫入 Google 試算表（Apps Script Web App）
 */

const STORAGE_KEY = "simple-ledger-records";
const GOOGLE_SHEET_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbzxWjY1H7AqGOq18xm4kyJuXl8SWnEXIjDswVZHE8YlSGAdXea6iKY-eamDp0-DZKCz/exec";

// DOM 元素
const formEl = document.getElementById("entry-form");
const dateInput = document.getElementById("date-input");
const nameInput = document.getElementById("name-input");
const amountInput = document.getElementById("amount-input");
const recordsBody = document.getElementById("records-body");
const totalAmountEl = document.getElementById("total-amount");
const clearAllBtn = document.getElementById("clear-all");

// 狀態
let records = [];

/** 將金額格式化成 NT$ 文字 */
const formatCurrency = (amount) => `NT$ ${amount.toLocaleString("zh-TW")}`;

/** 從 localStorage 載入紀錄 */
function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    records = raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("讀取 localStorage 失敗：", error);
    records = [];
  }
}

/** 將紀錄寫入 localStorage */
function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** 重新計算總金額 */
function updateTotal() {
  const total = records.reduce((sum, item) => sum + item.amount, 0);
  totalAmountEl.textContent = formatCurrency(total);
}

/** 產生表格列 */
function createRow(record, index) {
  return `
    <tr>
      <td>${record.date}</td>
      <td>${record.name}</td>
      <td class="amount">${formatCurrency(record.amount)}</td>
      <td><button class="delete-btn" data-index="${index}">刪除</button></td>
    </tr>
  `;
}

/** 渲染整份列表 */
function renderRecords() {
  if (!records.length) {
    recordsBody.innerHTML =
      '<tr class="empty"><td colspan="4">尚無紀錄，開始新增吧！</td></tr>';
    updateTotal();
    return;
  }

  recordsBody.innerHTML = records.map(createRow).join("");
  updateTotal();
}

/** 新增紀錄到 state */
function addRecord(payload) {
  records = [payload, ...records];
  saveRecords();
  renderRecords();
}

/** 依索引刪除紀錄 */
function deleteRecord(index) {
  records.splice(index, 1);
  saveRecords();
  renderRecords();
}

/** 清空全部紀錄 */
function clearRecords() {
  records = [];
  saveRecords();
  renderRecords();
}

/** 將資料送往 Google 試算表 */
async function syncToGoogleSheet(record) {
  if (!GOOGLE_SHEET_WEB_APP_URL) return;

  console.log("syncToGoogleSheet 被呼叫，record =", record);

  try {
    const formData = new URLSearchParams();
    formData.append("date", record.date);
    formData.append("name", record.name);
    formData.append("amount", String(record.amount));
    formData.append("createdAt", record.createdAt);

    const response = await fetch(GOOGLE_SHEET_WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    console.log("fetch 完成，status =", response.status);

    if (!response.ok) {
      throw new Error(`Google Sheet 回應狀態：${response.status}`);
    }
  } catch (error) {
    console.warn("同步 Google 試算表失敗：", error);
  }
}

/** 表單送出事件 */
function handleSubmit(event) {
  event.preventDefault();

  const date = dateInput.value;
  const name = nameInput.value.trim();
  const amount = Number(amountInput.value);

  if (!date || !name || Number.isNaN(amount) || amount <= 0) {
    alert("請確認日期、項目與金額皆為有效值。");
    return;
  }

  const record = {
    id: crypto?.randomUUID?.() ?? Date.now().toString(),
    date,
    name,
    amount,
    createdAt: new Date().toISOString(),
  };

  console.log("handleSubmit -> 準備新增紀錄與送到 Google：", record);

  addRecord(record);
  syncToGoogleSheet(record);

  console.log("handleSubmit -> 已呼叫 syncToGoogleSheet");

  formEl.reset();
  // 維持原日期，方便連續輸入
  dateInput.value = date;
}

/** 事件掛載與初始化 */
function init() {
  // 預設日期今天
  dateInput.value = new Date().toISOString().split("T")[0];

  loadRecords();
  renderRecords();

  formEl.addEventListener("submit", handleSubmit);

  recordsBody.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLButtonElement)) return;
    if (!event.target.classList.contains("delete-btn")) return;

    const index = Number(event.target.dataset.index);
    deleteRecord(index);
  });

  clearAllBtn.addEventListener("click", () => {
    if (!records.length) return;
    if (confirm("確定要刪除全部紀錄嗎？")) {
      clearRecords();
    }
  });
}

init();