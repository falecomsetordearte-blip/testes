// crm-script.js - VERSÃO COM ÍCONES, BUSCA MELHORADA E LIXEIRA

let searchTimeout = null;

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
    configurarBotaoProducao();
    setupModalCreditos();
});

// --- LIXEIRA DE MATERIAIS ---
// Função global para ser chamada pelo onclick
window.removerMaterial = function(btn) {
    if(confirm("Tem certeza que deseja remover este item?")) {
        btn.closest('.material-item').remove();
    }
};

function adicionarMaterialNoForm(desc = '', det = '') {
    const container = document.getElementById('materiais-container');
    const count = container.children.length + 1;
    const div = document.createElement('div');
    div.className = 'material-item';
    
    // Botão de Deletar Absoluto
    const btnDel = `<button type="button" class="btn-remove-material" onclick="window.removerMaterial(this)"><i class="fas fa-trash-alt"></i></button>`;

    div.innerHTML = `
        ${btnDel}
        <label style="font-weight:600; color:#3498db; font-size:0.85rem; display:block; margin-bottom:8px">Item ${count}</label>
        <div style="margin-bottom:10px">
            <input type="text" class="mat-desc form-control" value="${desc}" placeholder="Descrição (Ex: Banner 60x100)">
        </div>
        <div>
            <textarea class="mat-det form-control" rows="2" placeholder="Detalhes de acabamento...">${det}</textarea>
        </div>
    `;
    container.appendChild(div);
}

// --- BUSCA CLIENTE (Feedback Visual) ---
function configurarBuscaCliente() {
    const input = document.getElementById('crm-nome');
    const list = document.getElementById('search-results-list');
    const loading = document.getElementById('loading-cliente');
    
    input.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        if(this.value.length < 2) { 
            list.style.display = 'none'; 
            loading.classList.remove('active');
            return; 
        }
        
        loading.classList.add('active'); // Mostra "Buscando..."
        
        searchTimeout = setTimeout(async () => {
            try {
                const res = await fetch('/api/crm/searchClients', {
                    method: 'POST', headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), query: input.value })
                });
                const clientes = await res.json();
                
                list.innerHTML = '';
                if(clientes.length > 0) {
                    clientes.forEach(c => {
                        const li = document.createElement('li');
                        li.innerHTML = `<span>${c.nome}</span> <small style="color:#aaa">${c.whatsapp}</small>`;
                        li.onclick = () => {
                            input.value = c.nome;
                            const w = document.getElementById('crm-wpp');
                            w.value = c.whatsapp;
                            if(typeof IMask!=='undefined') IMask(w,{mask:'(00) 00000-0000'}).updateValue();
                            list.style.display = 'none';
                        };
                        list.appendChild(li);
                    });
                    list.style.display = 'block';
                } else {
                    list.style.display = 'none';
                }
            } catch(e){
                console.error(e);
            } finally {
                loading.classList.remove('active'); // Esconde loading
            }
        }, 500); // Delay
    });

    document.addEventListener('click', (e) => {
        if(!input.contains(e.target) && !list.contains(e.target)) list.style.display='none';
    });
}

// --- FUNÇÃO PARA BUSCAR SALDO ---
async function fetchSaldoCRM() {
    const display = document.getElementById('crm-saldo-display');
    if(!display) return;
    
    display.innerText = "...";
    try {
        const res = await fetch('/api/crm/getBalance', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken') })
        });
        const data = await res.json();
        const v = parseFloat(data.saldo || 0);
        
        display.innerText = v.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        display.style.color = v > 0 ? '#2ecc71' : '#e74c3c';
    } catch(e) { display.innerText = "Erro"; }
}

// --- CONFIG FORMULÁRIO (Saldo e Eventos) ---
function configurarFormularioVisual() {
    const cards = document.querySelectorAll('.servico-card');
    const container = document.getElementById('servico-selection-container');
    const hiddenInput = document.getElementById('pedido-servico-hidden');
    const contentWrapper = document.getElementById('form-content-wrapper');

    cards.forEach(card => {
        card.addEventListener('click', () => {
            if(container.classList.contains('selection-made') && !card.classList.contains('active')) return;
            cards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            hiddenInput.value = card.dataset.value;
            container.classList.add('selection-made');
            contentWrapper.style.display = 'block'; 
            setTimeout(() => contentWrapper.classList.add('visible'), 10);
        });
    });

    const radiosArte = document.querySelectorAll('input[name="pedido-arte"]');
    const arqFields = document.getElementById('arquivo-cliente-fields');
    const setorFields = document.getElementById('setor-arte-fields');
    const saldoContainer = document.getElementById('saldo-container');

    radiosArte.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const val = e.target.value;
            arqFields.classList.add('hidden');
            setorFields.classList.add('hidden');
            if(saldoContainer) saldoContainer.style.display = 'none';

            ['link-arquivo', 'pedido-supervisao', 'valor-designer', 'pedido-formato'].forEach(id => {
                const el = document.getElementById(id);
                if(el) el.required = false;
            });

            if (val === 'Arquivo do Cliente') {
                arqFields.classList.remove('hidden');
                document.getElementById('link-arquivo').required = true;
            } else if (val === 'Setor de Arte') {
                setorFields.classList.remove('hidden');
                if(saldoContainer) {
                    saldoContainer.style.display = 'inline-flex';
                    fetchSaldoCRM(); // Busca saldo ao selecionar
                }
                ['pedido-supervisao', 'valor-designer', 'pedido-formato'].forEach(id => {
                    const el = document.getElementById(id);
                    if(el) el.required = true;
                });
            }
        });
    });

    // Botão Adicionar Créditos (Link ao lado do saldo)
    const btnAdd = document.getElementById('btn-add-saldo-crm');
    if(btnAdd) {
        btnAdd.addEventListener('click', (e) => {
            e.preventDefault();
            const modal = document.getElementById("modal-adquirir-creditos");
            if(modal) modal.classList.add("active");
        });
    }

    document.getElementById('pedido-formato').addEventListener('change', (e) => {
        const div = document.getElementById('cdr-versao-container');
        e.target.value === 'CDR' ? div.classList.remove('hidden') : div.classList.add('hidden');
    });

    document.getElementById('btn-add-material').addEventListener('click', () => adicionarMaterialNoForm());
}

// ... FUNÇÕES AUXILIARES MANTIDAS IGUAIS (Toast, DragScroll, etc.) ...

function injectCleanStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* Incluído no HTML para facilitar, mas o Toast precisa disso: */
        .toast-message a { color: #e74c3c; font-weight: bold; text-decoration: underline; cursor: pointer; }
    `;
    document.head.appendChild(style);
}

function createToastContainer() {
    if (!document.querySelector('.toast-container')) {
        const div = document.createElement('div');
        div.className = 'toast-container';
        document.body.appendChild(div);
    }
}

function showToast(message, type = 'success', duration = 5000) {
    const container = document.querySelector('.toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '<i class="fa-solid fa-check-circle"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>';
    toast.innerHTML = `<div class="toast-icon">${icon}</div><div class="toast-message">${message}</div>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s forwards';
        setTimeout(() => toast.remove(), 500);
    }, duration);
}

function configurarDragScroll() {
    const slider = document.querySelector('.kanban-board');
    if (!slider) return;
    let isDown = false; let startX; let scrollLeft;
    slider.addEventListener('mousedown', (e) => { if (e.target.closest('.kanban-card') || e.target.closest('button')) return; isDown = true; slider.classList.add('active'); startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft; });
    slider.addEventListener('mouseleave', () => { isDown = false; slider.classList.remove('active'); });
    slider.addEventListener('mouseup', () => { isDown = false; slider.classList.remove('active'); });
    slider.addEventListener('mousemove', (e) => { if (!isDown) return; e.preventDefault(); const x = e.pageX - slider.offsetLeft; const walk = (x - startX) * 2; slider.scrollLeft = scrollLeft - walk; });
}

function configurarMascaras() {
    if (typeof IMask !== 'undefined') {
        ['crm-wpp', 'pedido-supervisao'].forEach(id => {
            const el = document.getElementById(id);
            if (el) IMask(el, { mask: '(00) 00000-0000' });
        });
    }
}

// ... FUNÇÕES DE KANBAN E API (Mantidas) ...

async function carregarKanban() {
    try {
        const res = await fetch('/api/crm/listCards', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken') })
        });
        if(!res.ok) throw new Error("Erro ao carregar");
        const cards = await res.json();
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
    div.onclick = () => abrirPanelEdicao(card);
    const valor = parseFloat(card.valor_orcamento||0).toLocaleString('pt-BR', {minimumFractionDigits:2});
    div.innerHTML = `<span class="card-id">${card.titulo_automatico || 'Novo'}</span><div class="card-tags"><span class="card-tag tag-arte">${card.servico_tipo}</span></div><div class="card-title">${card.nome_cliente}</div><span class="card-price">R$ ${valor}</span>`;
    container.appendChild(div);
}

function inicializarDragAndDrop() {
    document.querySelectorAll('.kanban-items').forEach(col => {
        if(col.getAttribute('init') === 'true') return;
        new Sortable(col, {
            group: 'crm', animation: 150, delay: 100, delayOnTouchOnly: true,
            onEnd: function(evt) { if(evt.from !== evt.to) atualizarStatus(evt.item.dataset.id, evt.to.parentElement.dataset.status); }
        });
        col.setAttribute('init', 'true');
    });
}

function atualizarStatus(id, novaColuna) {
    fetch('/api/crm/moveCard', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), cardId: id, novaColuna }) });
}

// ... FUNÇÕES GLOBAIS DE PAINEL (Drawer) ...

window.abrirPanelNovo = function() {
    resetarForm();
    document.getElementById('panel-titulo').innerText = 'Nova Oportunidade';
    document.getElementById('display-id-automatico').innerText = '# NOVO';
    document.getElementById('crm-titulo-manual').value = '';
    document.getElementById('btn-produzir-final').style.display = 'none';
    adicionarMaterialNoForm();
    document.getElementById('slide-overlay').classList.add('active');
    document.getElementById('slide-panel').classList.add('active');
}

window.abrirPanelEdicao = function(card) {
    resetarForm();
    document.getElementById('panel-titulo').innerText = 'Editar Oportunidade';
    document.getElementById('display-id-automatico').innerText = card.titulo_automatico || '';
    document.getElementById('btn-produzir-final').style.display = 'block';
    document.getElementById('card-id-db').value = card.id;
    document.getElementById('crm-titulo-manual').value = card.titulo_automatico || '';
    document.getElementById('crm-nome').value = card.nome_cliente;
    document.getElementById('crm-wpp').value = card.wpp_cliente;
    document.getElementById('crm-valor').value = card.valor_orcamento;
    const sCard = document.querySelector(`.servico-card[data-value="${card.servico_tipo}"]`);
    if(sCard) sCard.click();
    
    let extras = {};
    try { if (card.briefing_json) extras = (typeof card.briefing_json === 'string') ? JSON.parse(card.briefing_json) : card.briefing_json; } catch(e){}
    
    if(card.arte_origem) {
        const r = document.querySelector(`input[name="pedido-arte"][value="${card.arte_origem}"]`);
        if(r) { r.checked = true; r.dispatchEvent(new Event('change')); }
    }
    
    if(extras.link_arquivo) document.getElementById('link-arquivo').value = extras.link_arquivo;
    if(extras.supervisao_wpp) document.getElementById('pedido-supervisao').value = extras.supervisao_wpp;
    if(extras.valor_designer) document.getElementById('valor-designer').value = extras.valor_designer;
    if(extras.formato) { document.getElementById('pedido-formato').value = extras.formato; document.getElementById('pedido-formato').dispatchEvent(new Event('change')); }
    if(extras.cdr_versao) document.getElementById('cdr-versao').value = extras.cdr_versao;
    if(extras.tipo_entrega) { const re = document.querySelector(`input[name="tipo-entrega"][value="${extras.tipo_entrega}"]`); if(re) re.checked = true; }
    
    if(extras.materiais && extras.materiais.length > 0) {
        document.getElementById('materiais-container').innerHTML = '';
        extras.materiais.forEach(m => adicionarMaterialNoForm(m.descricao, m.detalhes));
    } else {
        adicionarMaterialNoForm();
    }
    
    configurarMascaras();
    if(typeof IMask !== 'undefined') {
        const w = document.getElementById('crm-wpp'); if(w && w.value) IMask(w, {mask:'(00) 00000-0000'}).updateValue();
        const s = document.getElementById('pedido-supervisao'); if(s && s.value) IMask(s, {mask:'(00) 00000-0000'}).updateValue();
    }
    
    document.getElementById('slide-overlay').classList.add('active');
    document.getElementById('slide-panel').classList.add('active');
}

window.fecharPanel = function() {
    document.getElementById('slide-overlay').classList.remove('active');
    document.getElementById('slide-panel').classList.remove('active');
    setTimeout(() => { const l=document.getElementById('search-results-list'); if(l) l.style.display='none'; }, 300);
}

function resetarForm() {
    document.getElementById('form-crm').reset();
    document.getElementById('card-id-db').value = '';
    const sContainer = document.getElementById('servico-selection-container');
    sContainer.classList.remove('selection-made');
    sContainer.querySelectorAll('.servico-card').forEach(c => c.classList.remove('active'));
    document.getElementById('form-content-wrapper').classList.remove('visible');
    document.getElementById('form-content-wrapper').style.display = 'none';
    document.getElementById('arquivo-cliente-fields').classList.add('hidden');
    document.getElementById('setor-arte-fields').classList.add('hidden');
    document.getElementById('materiais-container').innerHTML = '';
    const sal = document.getElementById('saldo-container'); if(sal) sal.style.display='none';
}

// ... SALVAR & PRODUÇÃO (Mantidos, apenas com toast ajustado) ...

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
        arte_origem: document.querySelector('input[name="pedido-arte"]:checked')?.value || '',
        valor_orcamento: document.getElementById('crm-valor').value,
        briefing_json: JSON.stringify({
            tipo_entrega: document.querySelector('input[name="tipo-entrega"]:checked')?.value || '',
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
        if(res.ok) { fecharPanel(); carregarKanban(); showToast('Rascunho salvo com sucesso!', 'success'); } 
        else { const err = await res.json(); showToast('Erro ao salvar: ' + (err.message || 'Desconhecido'), 'error'); }
    } catch(err) { showToast('Erro de conexão ao salvar.', 'error'); }
    finally { btn.innerText = originalText; btn.disabled = false; }
});

function setupModalCreditos() {
    const modal = document.getElementById("modal-adquirir-creditos");
    const form = document.getElementById("adquirir-creditos-form");
    if (!modal) return;
    const btnClose = modal.querySelector(".close-modal");
    if(btnClose) btnClose.addEventListener("click", () => modal.classList.remove("active"));
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("active"); });
    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const btn = form.querySelector("button[type='submit']");
            const valor = document.getElementById("creditos-valor").value;
            const errorDiv = document.getElementById("creditos-form-error");
            errorDiv.style.display = 'none';
            if (!valor || parseFloat(valor) < 5) {
                errorDiv.innerText = "Mínimo R$ 5,00."; errorDiv.style.display = 'block'; return;
            }
            btn.disabled = true; btn.textContent = "Gerando...";
            try {
                const res = await fetch('/api/addCredit', { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: localStorage.getItem("sessionToken"), valor: valor }) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                window.open(data.url, '_blank');
                modal.classList.remove("active"); form.reset();
                alert("Cobrança gerada! Após o pagamento, a página será atualizada.");
                window.location.reload();
            } catch (error) { errorDiv.innerText = error.message; errorDiv.style.display = 'block'; }
            finally { btn.disabled = false; btn.textContent = "Pagar Agora"; }
        });
    }
}

function configurarBotaoProducao() {
    const btn = document.getElementById('btn-produzir-final');
    if(!btn) return;
    let confirmationStage = false;
    btn.addEventListener('click', async () => {
        const id = document.getElementById('card-id-db').value;
        if(!id) return showToast('Salve o card antes de enviar.', 'error');
        if (!confirmationStage) {
            confirmationStage = true;
            btn.innerHTML = '<i class="fa-solid fa-question-circle"></i> Tem certeza? Clique p/ confirmar';
            btn.classList.add('btn-confirmacao-ativa');
            setTimeout(() => { if (confirmationStage) { confirmationStage = false; btn.innerHTML = '<i class="fa-solid fa-rocket"></i> APROVAR AGORA'; btn.classList.remove('btn-confirmacao-ativa'); } }, 4000);
            return;
        }
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner" style="width:15px; height:15px; border-width:2px; display:inline-block; vertical-align:middle; margin:0; border-top-color:#fff;"></div> Enviando...';
        btn.classList.remove('btn-confirmacao-ativa');
        let txt = "";
        document.querySelectorAll('.material-item').forEach((d, i) => { txt += `--- Item ${i+1} ---\nMaterial: ${d.querySelector('.mat-desc').value}\nDetalhes: ${d.querySelector('.mat-det').value}\n\n`; });
        const payload = {
            sessionToken: localStorage.getItem('sessionToken'),
            titulo: document.getElementById('crm-titulo-manual').value || document.getElementById('display-id-automatico').innerText,
            servico: document.getElementById('pedido-servico-hidden').value,
            arte: document.querySelector('input[name="pedido-arte"]:checked')?.value,
            nomeCliente: document.getElementById('crm-nome').value,
            wppCliente: document.getElementById('crm-wpp').value,
            tipoEntrega: document.querySelector('input[name="tipo-entrega"]:checked')?.value,
            briefingFormatado: txt,
            linkArquivo: document.getElementById('link-arquivo').value,
            supervisaoWpp: document.getElementById('pedido-supervisao').value,
            valorDesigner: document.getElementById('valor-designer').value,
            formato: document.getElementById('pedido-formato').value,
            cdrVersao: document.getElementById('cdr-versao').value
        };
        try {
            const res = await fetch('/api/createDealForGrafica', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
            const data = await res.json();
            if(!data.success && !data.dealId) throw new Error(data.message || 'Erro desconhecido');
            await fetch('/api/crm/deleteCard', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), cardId: id }) });
            showToast('Pedido enviado para Produção!', 'success');
            window.fecharPanel();
            carregarKanban();
        } catch(err) { 
            // Mostra o erro HTML retornado pela API no Toast
            const msg = err.message || "Erro desconhecido";
            showToast(msg, 'error', 15000); 
            
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-rocket"></i> Tentar Novamente';
            confirmationStage = false;
        }
    });
}