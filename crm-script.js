// crm-script.js - COMPLETO COM LÓGICA DE VALORES

let currentStep = 1;
const totalSteps = 3;
let allCardsCache = [];

document.addEventListener('DOMContentLoaded', () => {
    const sessionToken = localStorage.getItem('sessionToken');
    if (!sessionToken) { window.location.href = '/login.html'; return; }

    injectCleanStyles();
    createToastContainer();
    configurarMascaras();
    carregarKanban();
    configurarBuscaCliente();
    configurarFormularioVisual();
    configurarDragScroll();
    setupModalCreditos();
    
    // Listeners para Cálculo Automático
    document.getElementById('crm-valor').addEventListener('input', calcularSaldoRestante);
    document.getElementById('crm-valor-pago').addEventListener('input', calcularSaldoRestante);

    // Listeners Extras
    document.getElementById('pedido-formato').addEventListener('change', (e) => {
        const div = document.getElementById('cdr-versao-container');
        e.target.value === 'CDR' ? div.classList.remove('hidden') : div.classList.add('hidden');
    });
    
    document.getElementById('btn-add-material').addEventListener('click', () => adicionarMaterialNoForm());
});

// --- LÓGICA DE CÁLCULO ---
function calcularSaldoRestante() {
    const total = parseFloat(document.getElementById('crm-valor').value) || 0;
    const pago = parseFloat(document.getElementById('crm-valor-pago').value) || 0;
    const restante = total - pago;
    document.getElementById('crm-valor-restante').value = restante.toFixed(2);
}

// --- LÓGICA DE PRODUÇÃO DIRETA DO CARD ---
window.produzirCardDireto = function(cardId, btnElement) {
    event.stopPropagation(); 

    if (btnElement.dataset.confirming === "true") {
        const card = allCardsCache.find(c => c.id == cardId);
        if(!card) return showToast("Erro: Card não encontrado.", "error");

        let extras = {};
        try { if(card.briefing_json) extras = (typeof card.briefing_json === 'string') ? JSON.parse(card.briefing_json) : card.briefing_json; } catch(e){}
        
        let txt = ""; 
        if(extras.materiais) extras.materiais.forEach((d, i) => { txt += `--- Item ${i+1} ---\nMaterial: ${d.descricao}\nDetalhes: ${d.detalhes}\n\n`; });

        const payload = {
            sessionToken: localStorage.getItem('sessionToken'),
            titulo: card.titulo_automatico,
            servico: card.servico_tipo,
            arte: card.arte_origem,
            nomeCliente: card.nome_cliente,
            wppCliente: card.wpp_cliente,
            tipoEntrega: extras.tipo_entrega,
            briefingFormatado: txt,
            linkArquivo: extras.link_arquivo,
            supervisaoWpp: extras.supervisao_wpp,
            valorDesigner: extras.valor_designer,
            formato: extras.formato,
            cdrVersao: extras.cdr_versao
        };

        enviarProducaoAPI(payload, cardId, btnElement);
        
    } else {
        btnElement.dataset.confirming = "true";
        btnElement.innerHTML = '<i class="fas fa-exclamation"></i> Confirmar?';
        btnElement.classList.add('confirm-state');
        
        setTimeout(() => {
            btnElement.dataset.confirming = "false";
            btnElement.innerHTML = '<i class="fas fa-rocket"></i> PRODUZIR';
            btnElement.classList.remove('confirm-state');
        }, 3000);
    }
}

// --- LÓGICA DE EXCLUSÃO DO CARD ---
window.confirmarExclusaoCard = async function(cardId, event) {
    event.stopPropagation(); 

    if (confirm("Deseja realmente excluir este card permanentemente? Esta ação não pode ser desfeita.")) {
        try {
            const res = await fetch('/api/crm/deleteCard', { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({ 
                    sessionToken: localStorage.getItem('sessionToken'), 
                    cardId: cardId 
                }) 
            });

            if (res.ok) {
                showToast("Card excluído com sucesso!", "success");
                carregarKanban(); 
            } else {
                const data = await res.json();
                showToast("Erro ao excluir: " + (data.message || "Erro desconhecido"), "error");
            }
        } catch (err) {
            console.error(err);
            showToast("Erro de conexão ao tentar excluir.", "error");
        }
    }
};

async function enviarProducaoAPI(payload, cardId, btnElement) {
    if(btnElement) {
        btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btnElement.style.pointerEvents = 'none';
    }

    try {
        const res = await fetch('/api/createDealForGrafica', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const data = await res.json();
        
        if(!data.success && !data.dealId) throw new Error(data.message || 'Erro desconhecido');
        
        if(cardId) {
            await fetch('/api/crm/deleteCard', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), cardId: cardId }) });
        }

        showToast('Sucesso! Enviado para Produção.', 'success');
        if(window.fecharPanel) window.fecharPanel();
        carregarKanban();

    } catch(err) {
        showToast(err.message, 'error', 10000);
        if(btnElement) {
            btnElement.innerHTML = '<i class="fas fa-rocket"></i> Tentar Novamente';
            btnElement.style.pointerEvents = 'auto';
            btnElement.dataset.confirming = "false";
            btnElement.classList.remove('confirm-state');
        }
    }
}

// --- SALVAR NO CRM ---
document.getElementById('form-crm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-rascunho');
    const originalText = btn.innerText;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; btn.disabled = true;
    
    const mats = [];
    document.querySelectorAll('.material-item').forEach(d => { 
        const desc = d.querySelector('.mat-desc').value; 
        if(desc) mats.push({ descricao: desc, detalhes: d.querySelector('.mat-det').value }); 
    });
    
    const payload = {
        sessionToken: localStorage.getItem('sessionToken'),
        id: document.getElementById('card-id-db').value,
        titulo_manual: document.getElementById('crm-titulo-manual').value,
        nome_cliente: document.getElementById('crm-nome').value,
        wpp_cliente: document.getElementById('crm-wpp').value,
        servico_tipo: document.getElementById('pedido-servico-hidden').value, 
        arte_origem: document.getElementById('pedido-arte-hidden').value,     
        valor_orcamento: document.getElementById('crm-valor').value,
        valor_pago: document.getElementById('crm-valor-pago').value, // NOVO
        valor_restante: document.getElementById('crm-valor-restante').value, // NOVO
        briefing_json: JSON.stringify({
            tipo_entrega: document.getElementById('pedido-entrega-hidden').value, 
            materiais: mats,
            link_arquivo: document.getElementById('link-arquivo').value,
            supervisao_wpp: document.getElementById('pedido-supervisao').value,
            valor_designer: document.getElementById('valor-designer').value,
            formato: document.getElementById('pedido-formato').value,
            cdr_versao: document.getElementById('cdr-versao').value
        })
    };
    
    try {
        const res = await fetch('/api/crm/saveCard', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        if(res.ok) { fecharPanel(); carregarKanban(); showToast('Salvo no CRM!', 'success'); } 
        else { const err = await res.json(); showToast('Erro ao salvar: ' + (err.message || 'Desconhecido'), 'error'); }
    } catch(err) { showToast('Erro de conexão.', 'error'); }
    finally { btn.innerText = originalText; btn.disabled = false; }
});

// --- ABRIR EDIÇÃO ---
window.abrirPanelEdicao = function(card) {
    resetarForm();
    document.getElementById('panel-titulo').innerText = 'Editar Oportunidade';
    document.getElementById('display-id-automatico').innerText = card.titulo_automatico || '';
    
    const btnProduzir = document.getElementById('btn-produzir-final');
    if(btnProduzir) {
        btnProduzir.style.display = 'block';
        const novoBtn = btnProduzir.cloneNode(true);
        btnProduzir.parentNode.replaceChild(novoBtn, btnProduzir);
        novoBtn.addEventListener('click', () => {
           const mats = [];
           document.querySelectorAll('.material-item').forEach(d => { 
               const desc = d.querySelector('.mat-desc').value; 
               if(desc) mats.push({ descricao: desc, detalhes: d.querySelector('.mat-det').value }); 
           });
           let txt = ""; mats.forEach((d, i) => { txt += `--- Item ${i+1} ---\nMaterial: ${d.descricao}\nDetalhes: ${d.detalhes}\n\n`; });
           const payload = {
               sessionToken: localStorage.getItem('sessionToken'),
               titulo: document.getElementById('crm-titulo-manual').value || document.getElementById('display-id-automatico').innerText,
               servico: document.getElementById('pedido-servico-hidden').value,
               arte: document.getElementById('pedido-arte-hidden').value,
               nomeCliente: document.getElementById('crm-nome').value,
               wppCliente: document.getElementById('crm-wpp').value,
               tipoEntrega: document.getElementById('pedido-entrega-hidden').value,
               briefingFormatado: txt,
               linkArquivo: document.getElementById('link-arquivo').value,
               supervisaoWpp: document.getElementById('pedido-supervisao').value,
               valorDesigner: document.getElementById('valor-designer').value,
               formato: document.getElementById('pedido-formato').value,
               cdrVersao: document.getElementById('cdr-versao').value
           };
           if(confirm("Confirmar envio para produção?")) enviarProducaoAPI(payload, card.id, novoBtn);
        });
    }

    document.getElementById('card-id-db').value = card.id;
    document.getElementById('crm-titulo-manual').value = card.titulo_automatico || '';
    document.getElementById('crm-nome').value = card.nome_cliente;
    document.getElementById('crm-wpp').value = card.wpp_cliente;
    
    // CARREGAR VALORES ATUALIZADOS
    document.getElementById('crm-valor').value = card.valor_orcamento || 0;
    document.getElementById('crm-valor-pago').value = card.valor_pago || 0;
    calcularSaldoRestante();

    const servicoVal = card.servico_tipo;
    if(servicoVal) { 
        const el = document.querySelector(`#servico-grid .selection-card[onclick*="'${servicoVal}'"]`); 
        if(el) selectCard('servico', servicoVal, el); 
    }
    const arteVal = card.arte_origem;
    if(arteVal) { 
        const el = document.querySelector(`#arte-grid .selection-card[onclick*="'${arteVal}'"]`); 
        if(el) selectCard('arte', arteVal, el); 
    }
    let extras = {};
    try { if (card.briefing_json) extras = (typeof card.briefing_json === 'string') ? JSON.parse(card.briefing_json) : card.briefing_json; } catch(e){}
    const entregaVal = extras.tipo_entrega;
    if(entregaVal) { 
        const el = document.querySelector(`#entrega-grid .selection-card[onclick*="'${entregaVal}'"]`); 
        if(el) selectCard('entrega', entregaVal, el); 
    }
    if(extras.link_arquivo) document.getElementById('link-arquivo').value = extras.link_arquivo;
    if(extras.supervisao_wpp) document.getElementById('pedido-supervisao').value = extras.supervisao_wpp;
    if(extras.valor_designer) document.getElementById('valor-designer').value = extras.valor_designer;
    if(extras.formato) document.getElementById('pedido-formato').value = extras.formato;
    if(extras.cdr_versao) document.getElementById('cdr-versao').value = extras.cdr_versao;

    const matContainer = document.getElementById('materiais-container');
    matContainer.innerHTML = '';
    if(extras.materiais && extras.materiais.length > 0) {
        extras.materiais.forEach(m => adicionarMaterialNoForm(m.descricao, m.detalhes));
    } else {
        adicionarMaterialNoForm();
    }
    configurarMascaras();
    currentStep = 1;
    renderizarPasso();
    document.getElementById('slide-overlay').classList.add('active');
    document.getElementById('slide-panel').classList.add('active');
};

window.selectCard = function(group, value, element) {
    document.getElementById(`pedido-${group}-hidden`).value = value;
    const container = element.parentElement;
    container.querySelectorAll('.selection-card').forEach(c => c.classList.remove('selected'));
    element.classList.add('selected');
    if (group === 'arte') {
        const arqFields = document.getElementById('arquivo-cliente-fields');
        const setorFields = document.getElementById('setor-arte-fields');
        const saldoContainer = document.getElementById('saldo-container');
        arqFields.classList.add('hidden');
        setorFields.classList.add('hidden');
        if(saldoContainer) saldoContainer.style.display = 'none';
        if (value === 'Arquivo do Cliente') arqFields.classList.remove('hidden');
        if (value === 'Setor de Arte') {
            setorFields.classList.remove('hidden');
            if(saldoContainer) { saldoContainer.style.display = 'inline-flex'; fetchSaldoCRM(); }
        }
    }
};

window.mudarPasso = function(direction) {
    if (direction === 1 && !validarPassoAtual()) return;
    currentStep += direction;
    if (currentStep < 1) currentStep = 1;
    if (currentStep > totalSteps) currentStep = totalSteps;
    renderizarPasso();
};

function renderizarPasso() {
    document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`step-${currentStep}`).classList.add('active');
    for (let i = 1; i <= totalSteps; i++) {
        const ind = document.getElementById(`indicator-${i}`);
        ind.classList.remove('active', 'completed');
        if (i < currentStep) ind.classList.add('completed');
        if (i === currentStep) ind.classList.add('active');
    }
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const finalBtns = document.getElementById('final-buttons');
    if (currentStep === 1) btnPrev.style.display = 'none'; else btnPrev.style.display = 'block';
    if (currentStep === totalSteps) { btnNext.style.display = 'none'; finalBtns.style.display = 'flex'; } 
    else { btnNext.style.display = 'flex'; finalBtns.style.display = 'none'; }
}

function validarPassoAtual() {
    if (currentStep === 1) {
        if (!document.getElementById('pedido-servico-hidden').value) { showToast("Selecione o serviço.", "error"); return false; }
        if (document.getElementById('crm-nome').value.length < 2) { showToast("Preencha o cliente.", "error"); return false; }
        if (document.getElementById('crm-wpp').value.length < 10) { showToast("Preencha o WhatsApp.", "error"); return false; }
    }
    if (currentStep === 2) {
        const arte = document.getElementById('pedido-arte-hidden').value;
        if (!arte) { showToast("Selecione a arte.", "error"); return false; }
        if (arte === 'Arquivo do Cliente' && !document.getElementById('link-arquivo').value) { showToast("Cole o link.", "error"); return false; }
        const entrega = document.getElementById('pedido-entrega-hidden').value;
        if (!entrega && arte !== 'Designer Próprio') { showToast("Selecione a entrega.", "error"); return false; }
    }
    return true;
}

window.abrirPanelNovo = function() {
    resetarForm();
    document.getElementById('panel-titulo').innerText = 'Nova Oportunidade';
    document.getElementById('display-id-automatico').innerText = '# NOVO';
    const btnProduzir = document.getElementById('btn-produzir-final');
    if(btnProduzir) btnProduzir.style.display = 'none';
    currentStep = 1; renderizarPasso(); adicionarMaterialNoForm();
    document.getElementById('slide-overlay').classList.add('active');
    document.getElementById('slide-panel').classList.add('active');
};

window.fecharPanel = function() {
    document.getElementById('slide-overlay').classList.remove('active');
    document.getElementById('slide-panel').classList.remove('active');
};

function resetarForm() {
    document.getElementById('form-crm').reset();
    document.getElementById('card-id-db').value = '';
    document.querySelectorAll('.selection-card').forEach(c => c.classList.remove('selected'));
    ['pedido-servico-hidden', 'pedido-arte-hidden', 'pedido-entrega-hidden'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('arquivo-cliente-fields').classList.add('hidden');
    document.getElementById('setor-arte-fields').classList.add('hidden');
    document.getElementById('saldo-container').style.display = 'none';
    document.getElementById('search-results-list').style.display = 'none';
    document.getElementById('crm-valor-restante').value = '0.00';
}

window.removerMaterial = function(btn) { if(confirm("Tem certeza?")) btn.closest('.material-item').remove(); };
function adicionarMaterialNoForm(desc = '', det = '') {
    const container = document.getElementById('materiais-container');
    const count = container.children.length + 1;
    const div = document.createElement('div');
    div.className = 'material-item';
    const btnDel = `<button type="button" class="btn-remove-material" onclick="window.removerMaterial(this)"><i class="fas fa-trash-alt"></i></button>`;
    div.innerHTML = `${btnDel}<label style="font-weight:600; color:#3498db; font-size:0.85rem; display:block; margin-bottom:8px">Item ${count}</label><div style="margin-bottom:10px"><input type="text" class="mat-desc form-control" value="${desc}" placeholder="Descrição"></div><div><textarea class="mat-det form-control" rows="2" placeholder="Detalhes...">${det}</textarea></div>`;
    container.appendChild(div);
}

// --- CONFIGURAÇÃO DE BUSCA MANUAL ---
function configurarBuscaCliente() {
    const input = document.getElementById('crm-nome');
    const btnBuscar = document.getElementById('btn-buscar-cliente');
    const list = document.getElementById('search-results-list');
    
    const performSearch = async () => {
        const term = input.value;
        if(term.length < 2) { showToast("Digite pelo menos 2 caracteres.", "error"); return; }
        btnBuscar.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        try {
            const res = await fetch('/api/crm/searchClients', {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), query: term })
            });
            const clientes = await res.json();
            list.innerHTML = '';
            if(clientes.length > 0) {
                clientes.forEach(c => {
                    const li = document.createElement('li');
                    li.innerHTML = `<span>${c.nome}</span> <small style="color:#aaa">${c.whatsapp}</small>`;
                    li.onclick = () => {
                        input.value = c.nome;
                        document.getElementById('crm-wpp').value = c.whatsapp;
                        list.style.display = 'none';
                    };
                    list.appendChild(li);
                });
                list.style.display = 'block';
            } else { showToast("Nenhum cliente encontrado.", "error"); list.style.display = 'none'; }
        } catch(e) { showToast("Erro ao buscar clientes.", "error"); } finally { btnBuscar.innerHTML = '<i class="fas fa-search"></i>'; }
    };

    if(btnBuscar) btnBuscar.addEventListener('click', (e) => { e.preventDefault(); performSearch(); });
    if(input) {
        input.addEventListener('keypress', (e) => { if(e.key === 'Enter') { e.preventDefault(); performSearch(); } });
        input.addEventListener('input', () => { if(input.value === '') list.style.display = 'none'; });
    }
}

async function fetchSaldoCRM() {
    const display = document.getElementById('crm-saldo-display'); if(!display) return;
    try { const res = await fetch('/api/crm/getBalance', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken') }) }); const data = await res.json(); const v = parseFloat(data.saldo || 0); display.innerText = v.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}); } catch(e) {}
}

function injectCleanStyles() { const style = document.createElement('style'); style.textContent = `.toast-message a { color: #e74c3c; font-weight: bold; text-decoration: underline; cursor: pointer; }`; document.head.appendChild(style); }
function createToastContainer() { if (!document.querySelector('.toast-container')) { const div = document.createElement('div'); div.className = 'toast-container'; document.body.appendChild(div); } }
function showToast(message, type = 'success', duration = 5000) { const container = document.querySelector('.toast-container'); const toast = document.createElement('div'); toast.className = `toast ${type}`; const icon = type === 'success' ? '<i class="fa-solid fa-check-circle"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>'; toast.innerHTML = `<div class="toast-icon">${icon}</div><div class="toast-message">${message}</div>`; container.appendChild(toast); setTimeout(() => { toast.style.animation = 'fadeOut 0.5s forwards'; setTimeout(() => toast.remove(), 500); }, duration); }
function configurarDragScroll() { const slider = document.querySelector('.kanban-board'); if (!slider) return; let isDown = false; let startX; let scrollLeft; slider.addEventListener('mousedown', (e) => { if (e.target.closest('.kanban-card') || e.target.closest('button')) return; isDown = true; slider.classList.add('active'); startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft; }); slider.addEventListener('mouseleave', () => { isDown = false; slider.classList.remove('active'); }); slider.addEventListener('mouseup', () => { isDown = false; slider.classList.remove('active'); }); slider.addEventListener('mousemove', (e) => { if (!isDown) return; e.preventDefault(); const x = e.pageX - slider.offsetLeft; const walk = (x - startX) * 2; slider.scrollLeft = scrollLeft - walk; }); }
function configurarMascaras() { if (typeof IMask !== 'undefined') { ['crm-wpp', 'pedido-supervisao'].forEach(id => { const el = document.getElementById(id); if (el) IMask(el, { mask: '(00) 00000-0000' }); }); } }
function configurarFormularioVisual() { const btnAddSaldo = document.getElementById('btn-add-saldo-crm'); if(btnAddSaldo) { btnAddSaldo.addEventListener('click', (e) => { e.preventDefault(); document.getElementById("modal-adquirir-creditos").classList.add("active"); }); } }
function setupModalCreditos() { const modal = document.getElementById("modal-adquirir-creditos"); const form = document.getElementById("adquirir-creditos-form"); if (!modal) return; const btnClose = modal.querySelector(".close-modal"); if(btnClose) btnClose.addEventListener("click", () => modal.classList.remove("active")); modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("active"); }); if (form) { form.addEventListener('submit', async (event) => { event.preventDefault(); const btn = form.querySelector("button[type='submit']"); const valor = document.getElementById("creditos-valor").value; const errorDiv = document.getElementById("creditos-form-error"); errorDiv.style.display = 'none'; if (!valor || parseFloat(valor) < 5) { errorDiv.innerText = "Mínimo R$ 5,00."; errorDiv.style.display = 'block'; return; } btn.disabled = true; btn.textContent = "Gerando..."; try { const res = await fetch('/api/addCredit', { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: localStorage.getItem("sessionToken"), valor: valor }) }); const data = await res.json(); if (!res.ok) throw new Error(data.message); window.open(data.url, '_blank'); modal.classList.remove("active"); form.reset(); alert("Cobrança gerada!"); window.location.reload(); } catch (error) { errorDiv.innerText = error.message; errorDiv.style.display = 'block'; } finally { btn.disabled = false; btn.textContent = "Pagar Agora"; } }); } }

async function carregarKanban() {
    try {
        const res = await fetch('/api/crm/listCards', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken') }) });
        const cards = await res.json();
        allCardsCache = cards;
        document.querySelectorAll('.kanban-items').forEach(c => c.innerHTML = '');
        cards.forEach(card => criarCardHTML(card));
        inicializarDragAndDrop();
    } catch(err) { console.error(err); }
}

function criarCardHTML(card) {
    const map = { 'Novos': 'col-novos-list', 'Visita Técnica': 'col-visita-list', 'Aguardando Orçamento': 'col-orcamento-list', 'Aguardando Pagamento': 'col-pagamento-list', 'Abrir Pedido': 'col-abrir-list' };
    const container = document.getElementById(map[card.coluna] || 'col-novos-list');
    const div = document.createElement('div');
    div.className = 'kanban-card'; 
    div.dataset.id = card.id; 
    div.onclick = (e) => { if(!e.target.closest('.btn-card-produzir') && !e.target.closest('.btn-card-delete')) { abrirPanelEdicao(card); } };
    const valor = parseFloat(card.valor_orcamento||0).toLocaleString('pt-BR', {minimumFractionDigits:2});
    div.innerHTML = `<button class="btn-card-delete" onclick="window.confirmarExclusaoCard(${card.id}, event)" title="Excluir Oportunidade"><i class="fas fa-trash-alt"></i></button><div class="card-header-row"><span class="card-id">${card.titulo_automatico || 'Novo'}</span><div class="card-tags"><span class="card-tag tag-arte">${card.servico_tipo}</span></div></div><div class="card-title">${card.nome_cliente}</div><div class="card-footer-row"><span class="card-price">R$ ${valor}</span><button class="btn-card-produzir" onclick="window.produzirCardDireto(${card.id}, this)"><i class="fas fa-rocket"></i> PRODUZIR</button></div>`;
    container.appendChild(div);
}

function inicializarDragAndDrop() { document.querySelectorAll('.kanban-items').forEach(col => { if(col.getAttribute('init') === 'true') return; new Sortable(col, { group: 'crm', animation: 150, delay: 100, delayOnTouchOnly: true, onEnd: function(evt) { if(evt.from !== evt.to) atualizarStatus(evt.item.dataset.id, evt.to.parentElement.dataset.status); } }); col.setAttribute('init', 'true'); }); }
function atualizarStatus(id, novaColuna) { fetch('/api/crm/moveCard', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), cardId: id, novaColuna }) }); }