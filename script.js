// script.js — versão final com IndexedDB, correções e UI integrada
/* Sections:
 - utils
 - DOM refs + state
 - indexedDB wrapper
 - data sync + render
 - UI events (modal, add, edit, delete, clear month)
 - chart
 - ratomine animation
 - popups
*/

// -------------------- UTILIDADES --------------------
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const fmtTime = (isoDateTime) => {
  if (!isoDateTime) return "";
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const monthKey = (iso) => {
  const d = new Date(iso + "T00:00:00");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function todayMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function uid(len = 8) {
  return Math.random().toString(36).slice(2, 2 + len);
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// -------------------- DOM + STATE --------------------
const tableBody = document.getElementById("tableBody");
const totalMonth = document.getElementById("totalMonth");
const itemsCount = document.getElementById("itemsCount");
const profit = document.getElementById("profit");

const filterMonth = document.getElementById("filterMonth");
const filterCategory = document.getElementById("filterCategory");
const searchInput = document.getElementById("searchInput");
const sortToggle = document.getElementById("sortToggle");

const btnNew = document.getElementById("btnNew");

const modal = document.getElementById("modal");
const modalClose = document.getElementById("modalClose");
const btnCancel = document.getElementById("btnCancel");
const expenseForm = document.getElementById("expenseForm");
const dateInput = document.getElementById("dateInput");
const descInput = document.getElementById("descInput");
const catInput = document.getElementById("catInput");
const valueInput = document.getElementById("valueInput");
const noteInput = document.getElementById("noteInput");
const editingId = document.getElementById("editingId");
const modalTitle = document.getElementById("modalTitle");

const confirmModal = document.getElementById('confirmModal');
const confirmMsgEl = document.getElementById('confirmMsg');
const confirmOkBtn = document.getElementById('confirmOk');
const confirmCancelBtn = document.getElementById('confirmCancel');

let state = {
  expenses: [],
  filters: { month: todayMonth(), category: "", search: "" },
  sortOrder: "desc",
  editing: null,
  highlightCategories: new Set()
};

if (filterMonth) filterMonth.value = state.filters.month;

// -------------------- GERENCIAMENTO DE ANOTAÇÕES --------------------
const notesArea = document.getElementById('notesArea');
const clearNotesBtn = document.getElementById('clearNotes');

function getNotesKey(monthKey) {
  return `notes_${monthKey}`;
}

function loadNotes(monthKey) {
  const key = getNotesKey(monthKey);
  const saved = localStorage.getItem(key);
  if (notesArea) {
    notesArea.value = saved || '';
    autoExpandTextarea(); // Expandir ao carregar
  }
}

function saveNotes(monthKey, content) {
  const key = getNotesKey(monthKey);
  localStorage.setItem(key, content);
}

function autoExpandTextarea() {
  if (!notesArea) return;
  notesArea.style.height = 'auto';
  notesArea.style.height = notesArea.scrollHeight + 'px';
}

if (notesArea) {
  // Carregar anotações do mês atual
  loadNotes(state.filters.month);
  
  // Salvar automaticamente quando o usuário digitar
  notesArea.addEventListener('input', () => {
    saveNotes(state.filters.month, notesArea.value);
    autoExpandTextarea(); // Expandir conforme digita
  });
}

if (clearNotesBtn) {
  clearNotesBtn.addEventListener('click', () => {
    showConfirm('Deseja limpar as anotações deste mês?<br><br><span style="font-size: 11px; color: rgba(255,255,255,0.5);">Obs: Isto não apagará os dados dos gastos!</span>', () => {
      if (notesArea) {
        notesArea.value = '';
        saveNotes(state.filters.month, '');
        autoExpandTextarea(); // Redefinir tamanho ao limpar
      }
    });
  });
}

// -------------------- API WRAPPER (com suporte a Electron) --------------------
const API_URL = 'http://localhost:3001';

const db = {
  async addExpense(exp) {
    try {
      const res = await fetch(`${API_URL}/api/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exp)
      });
      if (!res.ok) throw new Error('Falha ao adicionar gasto');
      return await res.json();
    } catch (error) {
      console.error('Erro ao adicionar gasto:', error);
      throw error;
    }
  },
  async putExpense(exp) {
    try {
      const res = await fetch(`${API_URL}/api/expenses/${exp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exp)
      });
      if (!res.ok) throw new Error('Falha ao atualizar gasto');
      return await res.json();
    } catch (error) {
      console.error('Erro ao atualizar gasto:', error);
      throw error;
    }
  },
  async deleteExpense(id) {
    try {
      const res = await fetch(`${API_URL}/api/expenses/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Falha ao deletar gasto');
      return await res.json();
    } catch (error) {
      console.error('Erro ao deletar gasto:', error);
      throw error;
    }
  },
  async getAllExpenses() {
    try {
      const res = await fetch(`${API_URL}/api/expenses`);
      if (!res.ok) throw new Error('Falha ao carregar gastos');
      return await res.json();
    } catch (error) {
      console.error('Erro ao carregar gastos:', error);
      throw error;
    }
  },
  async clearMonth(monthKeyStr) {
    try {
      const res = await fetch(`${API_URL}/api/expenses/month/${monthKeyStr}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Falha ao limpar mês');
      return await res.json();
    } catch (error) {
      console.error('Erro ao limpar mês:', error);
      throw error;
    }
  }
};

// -------------------- SYNC DB -> STATE --------------------
async function loadAllFromDB() {
  try {
    const arr = await db.getAllExpenses();
    state.expenses = arr.map(e => {
      const baseDate = e.date || new Date().toISOString().slice(0,10);
      const baseDateTime = e.updatedAt || e.createdAt || `${baseDate}T00:00:00`;
      return {
        ...e,
        createdAt: e.createdAt || `${baseDate}T00:00:00`,
        updatedAt: baseDateTime
      };
    }).sort((a,b)=> {
      // Ordenar por data do gasto primeiro, depois por horário de criação como desempate
      const dateA = new Date(a.date + 'T00:00:00');
      const dateB = new Date(b.date + 'T00:00:00');
      if (dateB.getTime() !== dateA.getTime()) {
        return dateB - dateA;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  } catch (e) {
    console.error("DB load failed:", e);
    state.expenses = [];
  }
  render();
}

// -------------------- RENDER --------------------
function applyFilters(list) {
  const { month, category, search } = state.filters;
  return list.filter(e => {
    const okMonth = monthKey(e.date) === month;
    const okCat = !category || e.category === category;
    const okSearch = !search || (e.description + " " + (e.note || "")).toLowerCase().includes(search.toLowerCase());
    return okMonth && okCat && okSearch;
  });
}

function render() {
  const monthList = state.expenses.filter(e => monthKey(e.date) === state.filters.month);
  const totalCofre = monthList.filter(e => e.category === "Cofre").reduce((s,e)=>s+Number(e.value),0);
  const totalGastos = monthList.filter(e => e.category !== "Cofre").reduce((s,e)=>s+Number(e.value),0);

  if (totalMonth) totalMonth.textContent = BRL.format(totalGastos);
  if (profit) profit.textContent = BRL.format(totalCofre);

  const rows = applyFilters(state.expenses)
    .slice()
    .sort((a, b) => {
      // Ordenar por data do gasto primeiro
      const dateA = new Date(a.date + 'T00:00:00');
      const dateB = new Date(b.date + 'T00:00:00');
      
      if (state.sortOrder === "asc") {
        // Mais antigo primeiro
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA - dateB;
        }
        // Se mesma data, ordenar por horário de criação
        return new Date(a.createdAt) - new Date(b.createdAt);
      } else {
        // Mais novo primeiro
        if (dateB.getTime() !== dateA.getTime()) {
          return dateB - dateA;
        }
        // Se mesma data, ordenar por horário de criação
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });
  if (tableBody) {
    tableBody.innerHTML = rows.map(e => `
      <tr>
        <td>
          <div class="date-cell">
            <span class="date-main">${fmtDate(e.date)}</span>
            <span class="date-time">${fmtTime(e.createdAt || e.updatedAt)}</span>
          </div>
        </td>
        <td class="${state.highlightCategories.has(e.category) ? 'highlight-desc highlight-' + e.category.toLowerCase() : ''}">${escapeHtml(e.description)}</td>
        <td><span class="badge ${String(e.category).toLowerCase()}${state.highlightCategories.has(e.category) ? ' highlight-desc highlight-' + e.category.toLowerCase() : ''}">${escapeHtml(e.category)}</span></td>
        <td class="right ${state.highlightCategories.has(e.category) ? 'highlight-desc highlight-' + e.category.toLowerCase() : ''}">${BRL.format(e.value)}</td>
        <td class="center">
          <div class="row-actions">
            <button class="btn" onclick="editExpense('${e.id}')">Editar</button>
            <button class="btn danger" onclick="confirmDelete('${e.id}')">Excluir</button>
          </div>
        </td>
      </tr>
    `).join("");
  }
  if (itemsCount) itemsCount.textContent = String(rows.length);
  renderChart();
}

// -------------------- CRUD via DB --------------------
function newId() { return uid(10); }

async function addExpenseLocal(exp) {
  exp.month = monthKey(exp.date);
  const nowIso = new Date().toISOString();
  exp.createdAt = nowIso;
  exp.updatedAt = nowIso;
  await db.addExpense(exp);
  await loadAllFromDB();
}

async function updateExpenseLocal(id, patch) {
  const existing = state.expenses.find(e=>e.id===id);
  if (!existing) return;
  const nowIso = new Date().toISOString();
  const updated = {
    ...existing,
    ...patch,
    month: monthKey(patch.date || existing.date),
    createdAt: existing.createdAt || nowIso,
    updatedAt: nowIso
  };
  await db.putExpense(updated);
  await loadAllFromDB();
}

async function deleteExpenseLocal(id) {
  await db.deleteExpense(id);
  await loadAllFromDB();
}

function confirmDelete(id) {
  showConfirm('Excluir este gasto?', async () => {
    try {
      await deleteExpenseLocal(id);
    } catch (e) {
      console.error(e);
      showAlert('Falha ao excluir.');
    }
  });
}

// -------------------- MODAL --------------------
function openModal(title = "Novo gasto", prefillDate = null) {
  modal.classList.remove("hidden");
  modalTitle.textContent = title;
  if (prefillDate) dateInput.value = prefillDate;
  setTimeout(() => descInput.focus(), 50);
}

function closeModal() {
  modal.classList.add("hidden");
  expenseForm.reset();
  editingId.value = "";
}

// -------------------- EVENTOS UI --------------------
if (btnNew) {
  btnNew.addEventListener("click", () => {
    // abre o modal com a data do mês selecionado (1º dia) para evitar criação em mês errado
    const m = state.filters.month || todayMonth();
    // se o mês selecionado for o mês atual, pré-preencher com o dia de hoje
    if (m === todayMonth()) {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      openModal("Novo gasto", today);
    } else {
      openModal("Novo gasto", `${m}-01`);
    }
  });
}
if (modalClose) modalClose.addEventListener("click", closeModal);
if (btnCancel) btnCancel.addEventListener("click", closeModal);

if (expenseForm) {
  expenseForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    
    // Deixar a validação nativa do HTML5 funcionar
    if (!expenseForm.checkValidity()) {
      expenseForm.reportValidity();
      return;
    }
    
    const [Y, M, D] = (dateInput.value || "").split("-");
    if (!Y || !M || !D) return;
    const dateStr = `${Y}-${M}-${D}`;

    const payload = {
      id: editingId.value || newId(),
      date: dateStr,
      description: descInput.value.trim(),
      category: catInput.value,
      value: Number(valueInput.value),
      note: noteInput.value.trim()
    };

    try {
      if (editingId.value) {
        await updateExpenseLocal(payload.id, payload);
      } else {
        await addExpenseLocal(payload);
      }
      closeModal();
    } catch (e) {
      console.error(e);
      showAlert("Erro ao salvar gasto.");
    }
  });
}

// filtros
if (filterMonth) {
  filterMonth.addEventListener("change", e => {
    state.filters.month = e.target.value;
    loadNotes(state.filters.month); // Carregar anotações do novo mês
    render();
  });
}
if (filterCategory) {
  filterCategory.addEventListener("change", e => {
    state.filters.category = e.target.value;
    render();
  });
}
if (searchInput) {
  searchInput.addEventListener("input", e => {
    state.filters.search = e.target.value;
    render();
  });
}

function updateSortToggleLabel() {
  if (!sortToggle) return;
  sortToggle.textContent = state.sortOrder === "desc"
    ? "Mais Novo ↓"
    : "Mais Antigo ↑";
}

if (sortToggle) {
  updateSortToggleLabel();
  sortToggle.addEventListener("click", () => {
    state.sortOrder = state.sortOrder === "desc" ? "asc" : "desc";
    updateSortToggleLabel();
    render();
  });
}

// -------------------- Editar ----------
function editExpense(id) {
  const e = state.expenses.find(x => x.id === id);
  if (!e) return;
  openModal("Editar gasto", e.date);
  dateInput.value = e.date;
  descInput.value = e.description;
  catInput.value = e.category;
  valueInput.value = e.value;
  noteInput.value = e.note || "";
  editingId.value = e.id;
}

// -------------------- ATALHOS ----------
function toggleFullScreen() {
  if (window.electron && typeof window.electron.toggleFullScreen === "function") {
    window.electron.toggleFullScreen();
  } else {
    const root = document.documentElement;
    if (!document.fullscreenElement && root.requestFullscreen) {
      root.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
}

document.addEventListener("keydown", (e) => {
  const tag = document.activeElement && document.activeElement.tagName;
  
  // Enter no modal de novo/editar gasto
  if (e.key === "Enter" && modal && !modal.classList.contains("hidden")) {
    // Se não estiver em um textarea, submete o formulário
    if (tag !== "TEXTAREA") {
      e.preventDefault();
      if (expenseForm) {
        const submitEvent = new Event('submit', { cancelable: true, bubbles: true });
        expenseForm.dispatchEvent(submitEvent);
      }
    }
    return;
  }
  
  if (e.key.toLowerCase() === "n" && !e.ctrlKey && !e.altKey && !e.metaKey) {
    if (!["INPUT","TEXTAREA","SELECT"].includes(tag)) {
      e.preventDefault();
      if (btnNew) btnNew.click();
    }
  }
  if (e.key === "/" && modal && modal.classList.contains("hidden")) {
    e.preventDefault();
    if (searchInput) searchInput.focus();
  }
  if (e.key === "F11") {
    e.preventDefault();
    toggleFullScreen();
  }
  if (e.key === "Escape") {
    if (window.electron && typeof window.electron.toggleFullScreen === "function") {
      e.preventDefault();
      window.electron.toggleFullScreen();
    }
  }
});

// -------------------- GRÁFICO (Chart.js) --------------------
let chart = null;
function renderChart() {
  if (typeof Chart === "undefined") return;
  const canvas = document.getElementById("chartBar");
  if (!canvas) return;

  const monthList = state.expenses.filter(e => monthKey(e.date) === state.filters.month);
  const categories = ["Weed","Gasolina","Faturas","Lazer","Outros","Cofre"];
  const values = categories.map(cat => monthList.filter(e=>e.category===cat).reduce((s,e)=>s+Number(e.value),0));

  const baseColors = ['#16a34a','#eab308','#5b21b6','#b91c1c','#f97316','#60a5fa'];
  const hoverColors = ['#86efac','#fef08a','#c4b5fd','#fca5a5','#fdba74','#bfdbfe'];

  const ctx = canvas.getContext("2d");
  if (chart) { try { chart.destroy(); } catch {} chart = null; }

  canvas.onclick = (evt) => {
    if (!chart) return;
    const points = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
    if (!points.length) return;
    const cat = categories[points[0].index];
    if (state.highlightCategories.has(cat)) {
      state.highlightCategories.delete(cat);
    } else {
      state.highlightCategories.add(cat);
    }
    render();
  };

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: categories,
      datasets: [{
        label: "Valores",
        data: values,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.85)',
        backgroundColor: baseColors,
        hoverBackgroundColor: hoverColors,
        hoverBorderColor: 'rgba(0,0,0,0.9)',
        hoverBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { left: 0, right: 0, top: 8, bottom: 0 }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => BRL.format(ctx.parsed.y ?? ctx.parsed)
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#e5e7eb'
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#e5e7eb',
            callback: (v) => BRL.format(v)
          }
        }
      }
    }
  });
}

// -------------------- POPUPS (custom) --------------------
function showAlert(msg) {
  showConfirm(msg, ()=>{}, { okOnly:true });
}

function showConfirm(message, onConfirm = ()=>{}, opts={}) {
  if (!confirmModal || !confirmMsgEl || !confirmOkBtn || !confirmCancelBtn) {
    if (opts.okOnly) { alert(message); onConfirm(); return; }
    if (confirm(message)) onConfirm();
    return;
  }
  confirmMsgEl.innerHTML = message;
  confirmModal.style.display = 'flex';
  confirmModal.setAttribute('aria-hidden','false');

  function cleanup() {
    confirmModal.style.display = 'none';
    confirmModal.setAttribute('aria-hidden','true');
    confirmOkBtn.removeEventListener('click', okHandler);
    confirmCancelBtn.removeEventListener('click', cancelHandler);
    document.removeEventListener('keydown', keyHandler);
  }
  function okHandler(){ cleanup(); onConfirm(); }
  function cancelHandler(){ cleanup(); }
  function keyHandler(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      okHandler();
    }
  }

  confirmOkBtn.addEventListener('click', okHandler);
  confirmCancelBtn.addEventListener('click', cancelHandler);
  document.addEventListener('keydown', keyHandler);

  if (opts.okOnly) {
    confirmCancelBtn.style.display = 'none';
    confirmOkBtn.textContent = 'Ok';
  } else {
    confirmCancelBtn.style.display = '';
    confirmOkBtn.textContent = 'Confirmar';
  }
}

// -------------------- RATOMINE --------------------
(function initRatomine(){
  const r = document.querySelector('.ratomine');
  if (!r) return;
  r.classList.add('idle');
  r.addEventListener('mouseenter', ()=>{ r.classList.remove('idle'); r.classList.add('hovering'); });
  r.addEventListener('mouseleave', ()=>{ r.classList.remove('hovering'); r.classList.add('idle'); });

  function maybePlay(){
    const delay = 6000 + Math.random()*5000;
    setTimeout(()=>{
      if (Math.random() < 0.17) {
        r.classList.add('play');
        setTimeout(()=> r.classList.remove('play'), 900);
      }
      maybePlay();
    }, delay);
  }
  maybePlay();
})();

// -------------------- HIGHLIGHT DESCRIÇÕES --------------------
document.querySelectorAll('.legend-item[data-category]').forEach(item => {
  item.addEventListener('click', () => {
    const cat = item.dataset.category;
    if (state.highlightCategories.has(cat)) {
      state.highlightCategories.delete(cat);
    } else {
      state.highlightCategories.add(cat);
    }
    render();
  });
});

const resetHighlightBtn = document.getElementById('resetHighlight');
if (resetHighlightBtn) {
  resetHighlightBtn.addEventListener('click', () => {
    state.highlightCategories.clear();
    render();
  });
}

// -------------------- BOOT --------------------
(async function boot(){
  try {
    await loadAllFromDB();
  } catch (e) {
    console.error("Boot error:", e);
    showAlert("Erro ao conectar ao servidor. Certifique-se de que ele está rodando em http://localhost:3001");
    state.expenses = [];
    render();
  }
})();

// -------------------- LOGOUT --------------------
function sair() {
  localStorage.removeItem("logado");
  window.location.href = "login.html";
}

// expose functions used in HTML
window.editExpense = editExpense;
window.confirmDelete = confirmDelete;
window.sair = sair;
window.toggleFullScreen = toggleFullScreen;
