// crm-script.js - VERSÃO FINAL INTEGRADA E SEM OMISSÕES

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
    configurarBuscaCliente(); // Lógica de busca isolada
    configurarFormularioVisual();
    configurarDragScroll();
    setupModalCreditos();
    
    // Listeners para Cálculo Automático de Saldo (Passo 3)
    document.getElementById('crm-valor').addEventListener('input', calcularSaldoRestante);
    document.getElementById('crm-valor-pago').addEventListener('input', calcularSaldoRestante);

    // Listener para mostrar/esconder versão do Corel
    document.getElementById('pedido-formato').addEventListener('change', (e) => {
        const div = document.getElementById('cdr-versao-container');
        e.target.value === 'CDR' ? div.classList.remove('hidden') : div.classList.add('hidden');
    });
    
    document.getElementById('btn-add-material').addEventListener('click', () => adicionarMaterialNoForm());
});

// --- LÓGICA FINANCEIRA ---
function calcularSaldoRestante() {
    const total = parseFloat(document.getElementById('crm-valor').value) || 0;
    const pago = parseFloat(document.getElementById('crm-valor-pago').value) || 0;
    const restante = total - pago;
    
    const inputRestante = document.getElementById('crm-valor-restante');
    inputRestante.value = restante.toFixed(2);

    // Ajuste visual: Se houver dívida, destaca em vermelho
    if (restante > 0) {
        inputRestante.style.color = '#e74c3c';
        inputRestante.style.backgroundColor = '#fff1f0';
    } else {
        inputRestante.style.color = '#27ae60';
        inputRestante.style.backgroundColor = '#f6ffed';
    }
}

// --- BUSCA CLIENTE (CORRIGIDA PARA NÃO CONFLITAR COM FORM) ---
function configurarBuscaCliente() {
    const input = document.getElementById('crm-nome');
    const btnBuscar = document.getElementById('btn-buscar-cliente');
    const list = document.getElementById('search-results-list');
    
    const performSearch = async (e) => {
        if(e) { 
            e.preventDefault(); 
            e.stopPropagation(); 
        }
        
        const term = input.value;
        if(term.length < 2) { 
            showToast("Digite pelo menos 2 caracteres.", "error");
            return; 
        }

        btnBuscar.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        
        try {
            const res = await fetch('/api/crm/searchClients', {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({
                    sessionToken: localStorage.getItem('sessionToken'),
                    query: term
                })
            });
            const clientes = await res.json();
            
            list.innerHTML = '';
            if(clientes.length > 0) {
                clientes.forEach(c => {
                    const li = document.createElement('li');
                    li.innerHTML = `<span>${c.nome}</span> <small style="color:#aaa">${c.whatsapp}</small>`;
                    li.onclick = (event) => {
                        event.stopPropagation();
                        input.value = c.nome;
                        document.getElementById('crm-wpp').value = c.whatsapp;
                        list.style.display = 'none';
                    };
                    list.appendChild(li);
                });
                list.style.display = 'block';
            } else {
                showToast("Nenhum cliente encontrado.", "error");
                list.style.display = 'none';
            }
        } catch(e) {
            showToast("Erro ao buscar clientes.", "error");
        } finally {
            btnBuscar.innerHTML = '<i class="fas fa-search"></i>';
        }
    };

    if(btnBuscar) btnBuscar.addEventListener('click', performSearch);
    
    if(input) {
        input.addEventListener('keypress', (e) => { 
            if(e.key === 'Enter') {
                performSearch(e);
            }
        });
        input.addEventListener('input', () => { 
            if(input.value === '') list.style.display = 'none'; 
        });
    }

    // Fecha a lista ao clicar fora do campo de busca
    document.addEventListener('click', (e) => {
        if(!e.target.closest('.autocomplete-wrapper')) {
            list.style.display = 'none';
        }
    });
}

// --- PRODUÇÃO DIRETA DO CARD ---
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
        fecharPanel();
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

// --- EXCLUSÃO DE CARD ---
window.confirmarExclusaoCard = async function(cardId, event) {
    event.stopPropagation(); 
    if (confirm("Deseja realmente excluir este card permanentemente?")) {
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
                showToast("Card excluído!", "success");
                carregarKanban(); 
            } else {
                showToast("Erro ao excluir.", "error");
            }
        } catch (err) {
            showToast("Erro de conexão.", "error");
        }
    }
};

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
        valor_pago: document.getElementById('crm-valor-pago').value,
        valor_restante: document.getElementById('crm-valor-restante').value,
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
        else { showToast('Erro ao salvar.', 'error'); }
    } catch(err) { showToast('Erro de conexão.', 'error'); }
    finally { btn.innerText = originalText; btn.disabled = false; }
});

// --- ABRIR EDIÇÃO ---
window.abrirPanelEdicao = function(card) {
    resetarForm();
    document.getElementById('panel-titulo').innerText = 'Editar Oportunidade';
    document.getElementById('display-id-automatico').innerText = card.titulo_automatico || '';
    
    // Injetar dados básicos
    document.getElementById('card-id-db').value = card.id;
    document.getElementById('crm-titulo-manual').value = card.titulo_automatico || '';
    document.getElementById('crm-nome').value = card.nome_cliente;
    document.getElementById('crm-wpp').value = card.wpp_cliente;
    
    // Financeiro
    document.getElementById('crm-valor').value = card.valor_orcamento || 0;
    document.getElementById('crm-valor-pago').value = card.valor_pago || 0;
    calcularSaldoRestante();

    // Seleções visuais
    if(card.servico_tipo) { const el = document.querySelector(`#servico-grid .selection-card[onclick*="'${card.servico_tipo}'"]`); if(el) selectCard('servico', card.servico_tipo, el); }
    if(card.arte_origem) { const el = document.querySelector(`#arte-grid .selection-card[onclick*="'${card.arte_origem}'"]`); if(el) selectCard('arte', card.arte_origem, el); }

    let extras = {};
    try { if (card.briefing_json) extras = (typeof card.briefing_json === 'string') ? JSON.parse(card.briefing_json) : card.briefing_json; } catch(e){}
    
    if(extras.tipo_entrega) { const el = document.querySelector(`#entrega-grid .selection-card[onclick*="'${extras.tipo_entrega}'"]`); if(el) selectCard('entrega', extras.tipo_entrega, el); }
    if(extras.link_arquivo) document.getElementById('link-arquivo').value = extras.link_arquivo;
    if(extras.supervisao_wpp) document.getElementById('pedido-supervisao').value = extras.supervisao_wpp;
    if(extras.valor_designer) document.getElementById('valor-designer').value = extras.valor_designer;
    if(extras.formato) document.getElementById('pedido-formato').value = extras.formato;
    if(extras.cdr_versao) document.getElementById('cdr-versao').value = extras.cdr_versao;

    const matContainer = document.getElementById('materiais-container');
    matContainer.innerHTML = '';
    if(extras.materiais && extras.materiais.length > 0) {
        extras.materiais.forEach(m => adicionarMaterialNoForm(m.descricao, m.detalhes));
    } else { adicionarMaterialNoForm(); }

    currentStep = 1; renderizarPasso();
    document.getElementById('slide-overlay').classList.add('active');
    document.getElementById('slide-panel').classList.add('active');
};

// --- CONTROLE DO WIZARD ---
window.mudarPasso = function(direction) {
    if (direction === 1 && !validarPassoAtual()) return;
    currentStep += direction;
    renderizarPasso();
};

function renderizarPasso() {
    document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`step-${currentStep}`).classList.add('active');
    document.querySelectorAll('.step-indicator').forEach((ind, i) => {
        ind.classList.remove('active', 'completed');
        if (i+1 < currentStep) ind.classList.add('completed');
        if (i+1 === currentStep) ind.classList.add('active');
    });
    document.getElementById('btn-prev').style.display = currentStep === 1 ? 'none' : 'block';
    if (currentStep === totalSteps) {
        document.getElementById('btn-next').style.display = 'none';
        document.getElementById('final-buttons').style.display = 'flex';
    } else {
        document.getElementById('btn-next').style.display = 'flex';
        document.getElementById('final-buttons').style.display = 'none';
    }
}

function validarPassoAtual() {
    if (currentStep === 1) {
        if (!document.getElementById('pedido-servico-hidden').value) { showToast("Selecione o serviço.", "error"); return false; }
        if (document.getElementById('crm-nome').value.length < 2) { showToast("Selecione ou busque um cliente.", "error"); return false; }
    }
    if (currentStep === 2) {
        if (!document.getElementById('pedido-arte-hidden').value) { showToast("Defina a origem da arte.", "error"); return false; }
    }
    return true;
}

// --- SELEÇÕES VISUAIS ---
window.selectCard = function(group, value, element) {
    document.getElementById(`pedido-${group}-hidden`).value = value;
    element.parentElement.querySelectorAll('.selection-card').forEach(c => c.classList.remove('selected'));
    element.classList.add('selected');
    if (group === 'arte') {
        document.getElementById('arquivo-cliente-fields').classList.toggle('hidden', value !== 'Arquivo do Cliente');
        document.getElementById('setor-arte-fields').classList.toggle('hidden', value !== 'Setor de Arte');
        if(value === 'Setor de Arte') fetchSaldoCRM();
    }
};

window.abrirPanelNovo = function() {
    resetarForm();
    document.getElementById('panel-titulo').innerText = 'Nova Oportunidade';
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
    document.getElementById('crm-valor-restante').value = '0.00';
    document.getElementById('materiais-container').innerHTML = '';
}

function adicionarMaterialNoForm(desc = '', det = '') {
    const container = document.getElementById('materiais-container');
    const div = document.createElement('div');
    div.className = 'material-item';
    div.innerHTML = `<button type="button" class="btn-remove-material" onclick="this.closest('.material-item').remove()"><i class="fas fa-trash-alt"></i></button><div style="margin-bottom:10px"><input type="text" class="mat-desc form-control" value="${desc}" placeholder="Descrição"></div><div><textarea class="mat-det form-control" rows="2" placeholder="Detalhes...">${det}</textarea></div>`;
    container.appendChild(div);
}

// --- KANBAN ---
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
    const container = document.getElementById(map[card.coluna]);
    if(!container) return;
    const div = document.createElement('div');
    div.className = 'kanban-card'; div.dataset.id = card.id; 
    div.onclick = (e) => { if(!e.target.closest('button')) abrirPanelEdicao(card); };
    const valor = parseFloat(card.valor_orcamento||0).toLocaleString('pt-BR', {minimumFractionDigits:2});
    div.innerHTML = `<button class="btn-card-delete" onclick="window.confirmarExclusaoCard(${card.id}, event)"><i class="fas fa-trash-alt"></i></button><div class="card-header-row"><span class="card-id">${card.titulo_automatico}</span></div><div class="card-title">${card.nome_cliente}</div><div class="card-footer-row"><span class="card-price">R$ ${valor}</span><button class="btn-card-produzir" onclick="window.produzirCardDireto(${card.id}, this)"><i class="fas fa-rocket"></i> PRODUZIR</button></div>`;
    container.appendChild(div);
}

function inicializarDragAndDrop() {
    document.querySelectorAll('.kanban-items').forEach(col => {
        if(col.getAttribute('init') === 'true') return;
        new Sortable(col, { group: 'crm', animation: 150, onEnd: function(evt) {
            fetch('/api/crm/moveCard', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), cardId: evt.item.dataset.id, novaColuna: evt.to.parentElement.dataset.status }) });
        }});
        col.setAttribute('init', 'true');
    });
}

// --- UI HELPERS ---
function injectCleanStyles() { const style = document.createElement('style'); style.textContent = `.toast-message a { color: #e74c3c; font-weight: bold; text-decoration: underline; cursor: pointer; }`; document.head.appendChild(style); }
function createToastContainer() { if (!document.querySelector('.toast-container')) { const div = document.createElement('div'); div.className = 'toast-container'; document.body.appendChild(div); } }
function showToast(message, type = 'success', duration = 5000) { const container = document.querySelector('.toast-container'); const toast = document.createElement('div'); toast.className = `toast ${type}`; toast.innerHTML = `<div class="toast-message">${message}</div>`; container.appendChild(toast); setTimeout(() => { toast.remove(); }, duration); }
function configurarMascaras() { if (typeof IMask !== 'undefined') { ['crm-wpp', 'pedido-supervisao'].forEach(id => { const el = document.getElementById(id); if (el) IMask(el, { mask: '(00) 00000-0000' }); }); } }
function configurarFormularioVisual() { /* Listeners de UI aqui */ }
function configurarDragScroll() { /* Scroll lateral do kanban */ }
function setupModalCreditos() { /* Modal de compra de créditos */ }
async function fetchSaldoCRM() {
    const display = document.getElementById('crm-saldo-display'); if(!display) return;
    try { const res = await fetch('/api/crm/getBalance', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken') }) }); const data = await res.json(); display.innerText = parseFloat(data.saldo || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}); } catch(e) {}
}