// crm-script.js - VERSÃO CLEAN & FUNCIONAL (Drag/Drop + Gaveta + Toasts)

let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Segurança
    const sessionToken = localStorage.getItem('sessionToken');
    if (!sessionToken) {
        window.location.href = '/login.html'; 
        return;
    }

    // 2. Inicialização
    injectCleanStyles(); // Injeta o novo CSS
    createToastContainer(); // Cria container de notificações
    configurarMascaras();
    carregarKanban();
    configurarBuscaCliente();
    configurarFormularioVisual();
    configurarDragScroll();
});

// --- 1. ESTILOS VISUAIS (INJETADOS) ---
function injectCleanStyles() {
    const style = document.createElement('style');
    style.textContent = `
        :root {
            --primary: #3498db;
            --success: #2ecc71;
            --danger: #e74c3c;
            --warning: #f1c40f;
            --purple: #9b59b6;
            --orange: #e67e22;
            --text-dark: #2c3e50;
            --text-light: #7f8c8d;
            --bg-card: #ffffff;
            --shadow-sm: 0 2px 5px rgba(0,0,0,0.05);
            --shadow-md: 0 5px 15px rgba(0,0,0,0.15);
        }

        /* Container Geral Ajustado */
        .app-content .container { max-width: 100% !important; padding-right: 20px; }

        /* HEADER & FILTROS */
        .kanban-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 15px; }
        .btn-primary { background-color: var(--primary); border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; box-shadow: var(--shadow-sm); transition: all 0.2s; }
        .btn-primary:hover { background-color: #2980b9; transform: translateY(-2px); box-shadow: var(--shadow-md); }

        /* KANBAN BOARD (Drag to Scroll Area) */
        .kanban-board { 
            display: flex; gap: 20px; overflow-x: auto; padding-bottom: 20px; 
            height: calc(100vh - 180px); align-items: flex-start; 
            cursor: grab; user-select: none;
        }
        .kanban-board.active { cursor: grabbing; cursor: -webkit-grabbing; }
        
        /* COLUNAS TRANSPARENTES */
        .kanban-column { 
            background: transparent !important; border: none !important;
            min-width: 300px; width: 300px; 
            padding: 0; margin-right: 10px; 
            display: flex; flex-direction: column; max-height: 100%;
        }

        /* HEADERS DAS COLUNAS (Estilo Tag) */
        .column-header { 
            font-weight: 700; color: white !important; margin-bottom: 15px; 
            text-transform: uppercase; font-size: 0.85rem; letter-spacing: 0.5px; 
            padding: 12px 15px; border-radius: 8px; text-align: center; 
            box-shadow: var(--shadow-sm); border: none !important;
        }
        
        /* Cores das Colunas */
        .col-novos .column-header { background-color: var(--primary); }
        .col-visita .column-header { background-color: var(--orange); }
        .col-orcamento .column-header { background-color: var(--warning); color: #333 !important; }
        .col-pagamento .column-header { background-color: var(--purple); }
        .col-abrir .column-header { background-color: var(--success); }

        /* ÁREA DOS CARDS (Scroll Vertical) */
        .kanban-items { 
            overflow-y: auto; flex-grow: 1; padding-right: 5px; 
            scrollbar-width: thin; display: flex; flex-direction: column; gap: 12px; min-height: 150px;
        }

        /* CARDS FLUTUANTES */
        .kanban-card { 
            background: var(--bg-card); border-radius: 10px; padding: 18px; 
            box-shadow: var(--shadow-sm); transition: transform 0.2s, box-shadow 0.2s; 
            border: 1px solid transparent; border-left: 5px solid #ccc; /* Cor padrão */
            cursor: pointer; position: relative; 
        }
        .kanban-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }

        /* Cores da Borda do Card (Baseado na Coluna Pai) */
        .col-novos .kanban-card { border-left-color: var(--primary); }
        .col-visita .kanban-card { border-left-color: var(--orange); }
        .col-orcamento .kanban-card { border-left-color: var(--warning); }
        .col-pagamento .kanban-card { border-left-color: var(--purple); }
        .col-abrir .kanban-card { border-left-color: var(--success); }

        /* Tipografia do Card */
        .card-id { position: absolute; top: 15px; right: 15px; font-size: 0.75rem; color: #aaa; font-weight: 600; }
        .card-title { font-size: 1rem; font-weight: 600; color: var(--text-dark); margin-bottom: 8px; line-height: 1.4; padding-right: 40px; }
        .card-tags { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
        .card-tag { font-size: 0.7rem; padding: 4px 8px; border-radius: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
        .tag-arte { background: #e0f7fa; color: #006064; }
        .card-price { font-weight: 700; color: var(--success); font-size: 1rem; display: block; margin-top: 5px; }

        /* GAVETA LATERAL (Side Drawer) - Clean */
        .slide-overlay { background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(3px); }
        .slide-panel { 
            background: #fff; box-shadow: -10px 0 30px rgba(0,0,0,0.1); 
            border-top-left-radius: 20px; border-bottom-left-radius: 20px;
        }
        .panel-header { padding: 25px 30px; border-bottom: 1px solid #f0f0f0; background: #fff; border-radius: 20px 0 0 0; }
        .panel-header h2 { font-size: 1.4rem; color: var(--text-dark); font-weight: 700; }
        .close-panel-btn { color: #aaa; transition: color 0.2s; }
        .close-panel-btn:hover { color: var(--danger); }
        .panel-body { padding: 30px; background: #f9fbfd; }

        /* Formulário Bonito */
        .form-group label { font-size: 0.85rem; color: var(--text-light); font-weight: 600; margin-bottom: 6px; display: block; }
        .form-control { 
            width: 100%; padding: 12px; border: 1px solid #e1e1e1; border-radius: 8px; 
            font-size: 0.95rem; transition: all 0.2s; background: #fff;
        }
        .form-control:focus { border-color: var(--primary); outline: none; box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1); }

        /* Botões de Ação */
        .btn-secondary { background: #ecf0f1; color: var(--text-dark); border: 1px solid #bdc3c7; }
        .btn-secondary:hover { background: #bdc3c7; }
        .btn-produzir { 
            background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); 
            box-shadow: 0 4px 15px rgba(46, 204, 113, 0.3); border: none;
        }
        .btn-produzir:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(46, 204, 113, 0.4); }

        /* TOASTS */
        .toast-container { position: fixed; top: 20px; right: 20px; z-index: 10005; display: flex; flex-direction: column; gap: 10px; }
        .toast { background: white; padding: 15px 20px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 12px; min-width: 300px; animation: slideInRight 0.3s ease-out forwards; border-left: 5px solid #ccc; }
        .toast.success { border-left-color: var(--success); }
        .toast.error { border-left-color: var(--danger); }
        .toast-icon { font-size: 1.2rem; }
        .toast.success .toast-icon { color: var(--success); }
        .toast.error .toast-icon { color: var(--danger); }
        .toast-message { font-size: 0.9rem; color: var(--text-dark); font-weight: 500; }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(50px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
    `;
    document.head.appendChild(style);
}

// --- 2. SISTEMA DE TOASTS ---
function createToastContainer() {
    const div = document.createElement('div');
    div.className = 'toast-container';
    document.body.appendChild(div);
}

function showToast(message, type = 'success') {
    const container = document.querySelector('.toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '<i class="fa-solid fa-check-circle"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>';
    toast.innerHTML = `<div class="toast-icon">${icon}</div><div class="toast-message">${message}</div>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s forwards';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// --- 3. DRAG TO SCROLL (Mantido) ---
function configurarDragScroll() {
    const slider = document.querySelector('.kanban-board');
    if (!slider) return;

    let isDown = false;
    let startX;
    let scrollLeft;

    slider.addEventListener('mousedown', (e) => {
        if (e.target.closest('.kanban-card') || e.target.closest('.column-header')) return;
        isDown = true;
        slider.classList.add('active');
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });
    slider.addEventListener('mouseleave', () => { isDown = false; slider.classList.remove('active'); });
    slider.addEventListener('mouseup', () => { isDown = false; slider.classList.remove('active'); });
    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 1.5;
        slider.scrollLeft = scrollLeft - walk;
    });
}

// --- 4. MÁSCARAS ---
function configurarMascaras() {
    if (typeof IMask !== 'undefined') {
        ['crm-wpp', 'pedido-supervisao'].forEach(id => {
            const el = document.getElementById(id);
            if (el) IMask(el, { mask: '(00) 00000-0000' });
        });
    }
}

// --- 5. LÓGICA DO FORMULÁRIO ---
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
            contentWrapper.classList.add('visible');
        });
    });

    const radiosArte = document.querySelectorAll('input[name="pedido-arte"]');
    const arqFields = document.getElementById('arquivo-cliente-fields');
    const setorFields = document.getElementById('setor-arte-fields');

    radiosArte.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const val = e.target.value;
            arqFields.classList.add('hidden');
            setorFields.classList.add('hidden');
            // Reset required
            ['link-arquivo', 'pedido-supervisao', 'valor-designer', 'pedido-formato'].forEach(id => {
                const el = document.getElementById(id);
                if(el) el.required = false;
            });

            if (val === 'Arquivo do Cliente') {
                arqFields.classList.remove('hidden');
                document.getElementById('link-arquivo').required = true;
            } else if (val === 'Setor de Arte') {
                setorFields.classList.remove('hidden');
                ['pedido-supervisao', 'valor-designer', 'pedido-formato'].forEach(id => document.getElementById(id).required = true);
            }
        });
    });

    document.getElementById('pedido-formato').addEventListener('change', (e) => {
        const div = document.getElementById('cdr-versao-container');
        e.target.value === 'CDR' ? div.classList.remove('hidden') : div.classList.add('hidden');
    });

    document.getElementById('btn-add-material').addEventListener('click', () => adicionarMaterialNoForm());
}

function adicionarMaterialNoForm(desc = '', det = '') {
    const container = document.getElementById('materiais-container');
    const count = container.children.length + 1;
    const div = document.createElement('div');
    div.className = 'material-item';
    div.innerHTML = `
        <label style="font-weight:bold; color:#3498db; font-size:0.85rem; display:block; margin-bottom:5px">Item ${count}</label>
        <div style="margin-bottom:10px">
            <input type="text" class="mat-desc form-control" value="${desc}" placeholder="Descrição (Ex: Banner 60x100)">
        </div>
        <div>
            <textarea class="mat-det form-control" rows="2" placeholder="Detalhes de acabamento...">${det}</textarea>
        </div>
    `;
    container.appendChild(div);
}

// --- 6. KANBAN LOGIC ---
async function carregarKanban() {
    try {
        const token = localStorage.getItem('sessionToken');
        const res = await fetch('/api/crm/listCards', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ sessionToken: token })
        });
        
        if(!res.ok) throw new Error("Erro ao carregar");
        const cards = await res.json();

        document.querySelectorAll('.kanban-items').forEach(c => c.innerHTML = '');
        cards.forEach(card => criarCardHTML(card));
        inicializarDragAndDrop();
    } catch(err) { console.error(err); showToast('Erro ao carregar Kanban', 'error'); }
}

function criarCardHTML(card) {
    const map = {
        'Novos': 'col-novos-list', 'Visita Técnica': 'col-visita-list',
        'Aguardando Orçamento': 'col-orcamento-list', 'Aguardando Pagamento': 'col-pagamento-list',
        'Abrir Pedido': 'col-abrir-list'
    };
    const container = document.getElementById(map[card.coluna] || 'col-novos-list');
    
    const div = document.createElement('div');
    div.className = 'kanban-card'; // CSS Class injetada fará o estilo
    div.dataset.id = card.id;
    div.onclick = () => abrirPanelEdicao(card);

    const valor = parseFloat(card.valor_orcamento||0).toLocaleString('pt-BR', {minimumFractionDigits:2});
    
    div.innerHTML = `
        <span class="card-id">${card.titulo_automatico || 'Novo'}</span>
        <div class="card-tags">
            <span class="card-tag tag-arte">${card.servico_tipo}</span>
            ${card.arte_origem ? `<span class="card-tag" style="background:#f0f0f0; color:#555;">${card.arte_origem}</span>` : ''}
        </div>
        <div class="card-title">${card.nome_cliente}</div>
        <span class="card-price">R$ ${valor}</span>
    `;
    container.appendChild(div);
}

function inicializarDragAndDrop() {
    document.querySelectorAll('.kanban-items').forEach(col => {
        if(col.getAttribute('init') === 'true') return;
        new Sortable(col, {
            group: 'crm', animation: 150, delay: 100, delayOnTouchOnly: true, // Melhor toque
            onEnd: function(evt) {
                if(evt.from !== evt.to) {
                    atualizarStatus(evt.item.dataset.id, evt.to.parentElement.dataset.status);
                }
            }
        });
        col.setAttribute('init', 'true');
    });
}

function atualizarStatus(id, novaColuna) {
    fetch('/api/crm/moveCard', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), cardId: id, novaColuna })
    });
}

// --- 7. PAINEL LATERAL (DRAWER) ---
const overlay = document.getElementById('slide-overlay');
const panel = document.getElementById('slide-panel');

function resetarForm() {
    document.getElementById('form-crm').reset();
    document.getElementById('card-id-db').value = '';
    
    const sContainer = document.getElementById('servico-selection-container');
    sContainer.classList.remove('selection-made');
    sContainer.querySelectorAll('.servico-card').forEach(c => c.classList.remove('active'));
    document.getElementById('form-content-wrapper').classList.remove('visible');
    
    document.getElementById('arquivo-cliente-fields').classList.add('hidden');
    document.getElementById('setor-arte-fields').classList.add('hidden');
    document.getElementById('materiais-container').innerHTML = '';
}

window.abrirPanelNovo = function() {
    resetarForm();
    document.getElementById('panel-titulo').innerText = 'Nova Oportunidade';
    document.getElementById('display-id-automatico').innerText = '# NOVO';
    document.getElementById('crm-titulo-manual').value = '';
    document.getElementById('btn-produzir-final').style.display = 'none';
    adicionarMaterialNoForm();
    
    overlay.classList.add('active');
    panel.classList.add('active');
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
    try { 
        if (card.briefing_json) {
            extras = (typeof card.briefing_json === 'string') ? JSON.parse(card.briefing_json) : card.briefing_json;
        }
    } catch(e){}

    if(card.arte_origem) {
        const r = document.querySelector(`input[name="pedido-arte"][value="${card.arte_origem}"]`);
        if(r) { r.checked = true; r.dispatchEvent(new Event('change')); }
    }

    if(extras.link_arquivo) document.getElementById('link-arquivo').value = extras.link_arquivo;
    if(extras.supervisao_wpp) document.getElementById('pedido-supervisao').value = extras.supervisao_wpp;
    if(extras.valor_designer) document.getElementById('valor-designer').value = extras.valor_designer;
    if(extras.formato) {
        const sel = document.getElementById('pedido-formato');
        sel.value = extras.formato;
        sel.dispatchEvent(new Event('change'));
    }
    if(extras.cdr_versao) document.getElementById('cdr-versao').value = extras.cdr_versao;
    if(extras.tipo_entrega) {
        const re = document.querySelector(`input[name="tipo-entrega"][value="${extras.tipo_entrega}"]`);
        if(re) re.checked = true;
    }

    if(extras.materiais && extras.materiais.length > 0) {
        document.getElementById('materiais-container').innerHTML = '';
        extras.materiais.forEach(m => adicionarMaterialNoForm(m.descricao, m.detalhes));
    } else {
        adicionarMaterialNoForm();
    }

    configurarMascaras();
    if(typeof IMask !== 'undefined') {
        const w = document.getElementById('crm-wpp');
        if(w && w.value) IMask(w, {mask:'(00) 00000-0000'}).updateValue();
        const s = document.getElementById('pedido-supervisao');
        if(s && s.value) IMask(s, {mask:'(00) 00000-0000'}).updateValue();
    }

    overlay.classList.add('active');
    panel.classList.add('active');
}

window.fecharPanel = function() {
    overlay.classList.remove('active');
    panel.classList.remove('active');
    setTimeout(() => { document.getElementById('search-results-list').style.display = 'none'; }, 300);
}

// --- 8. BUSCA CLIENTE ---
function configurarBuscaCliente() {
    const input = document.getElementById('crm-nome');
    const list = document.getElementById('search-results-list');
    
    input.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        if(this.value.length < 2) { list.style.display = 'none'; return; }
        
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
                } else list.style.display = 'none';
            } catch(e){}
        }, 400);
    });

    document.addEventListener('click', (e) => {
        if(!input.contains(e.target) && !list.contains(e.target)) list.style.display='none';
    });
}

// --- 9. SALVAR (DRAFT) ---
document.getElementById('form-crm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-rascunho');
    const originalText = btn.innerText;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; btn.disabled = true;

    const mats = [];
    document.querySelectorAll('.material-item').forEach(d => {
        const desc = d.querySelector('.mat-desc').value;
        if(desc) {
            mats.push({ descricao: desc, detalhes: d.querySelector('.mat-det').value });
        }
    });

    const extras = {
        tipo_entrega: document.querySelector('input[name="tipo-entrega"]:checked')?.value || '',
        materiais: mats,
        link_arquivo: document.getElementById('link-arquivo').value,
        supervisao_wpp: document.getElementById('pedido-supervisao').value,
        valor_designer: document.getElementById('valor-designer').value,
        formato: document.getElementById('pedido-formato').value,
        cdr_versao: document.getElementById('cdr-versao').value
    };

    const payload = {
        sessionToken: localStorage.getItem('sessionToken'),
        id: document.getElementById('card-id-db').value,
        titulo_manual: document.getElementById('crm-titulo-manual').value,
        nome_cliente: document.getElementById('crm-nome').value,
        wpp_cliente: document.getElementById('crm-wpp').value,
        servico_tipo: document.getElementById('pedido-servico-hidden').value,
        arte_origem: document.querySelector('input[name="pedido-arte"]:checked')?.value || '',
        valor_orcamento: document.getElementById('crm-valor').value,
        briefing_json: JSON.stringify(extras)
    };

    try {
        const res = await fetch('/api/crm/saveCard', {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
        });
        
        if(res.ok) { 
            fecharPanel(); 
            carregarKanban();
            showToast('Rascunho salvo com sucesso!', 'success');
        } else {
            const err = await res.json();
            showToast('Erro ao salvar: ' + (err.message || 'Desconhecido'), 'error');
        }
    } catch(err) { showToast('Erro de conexão ao salvar.', 'error'); }
    finally { btn.innerText = originalText; btn.disabled = false; }
});

// --- 10. PRODUZIR ---
window.converterEmPedido = async function() {
    const id = document.getElementById('card-id-db').value;
    if(!id) return showToast('Salve o card antes de enviar.', 'error');
    if(!confirm('Deseja iniciar a produção? Isso enviará para o Bitrix e removerá o card deste CRM.')) return;

    const btn = document.getElementById('btn-produzir-final');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...'; btn.disabled = true;

    let txt = "";
    document.querySelectorAll('.material-item').forEach((d, i) => {
        txt += `--- Item ${i+1} ---\nMaterial: ${d.querySelector('.mat-desc').value}\nDetalhes: ${d.querySelector('.mat-det').value}\n\n`;
    });

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
        const res = await fetch('/api/createDealForGrafica', {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if(!data.success && !data.dealId) throw new Error(data.message || 'Erro desconhecido');

        await fetch('/api/crm/deleteCard', {
            method: 'POST', headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), cardId: id })
        });

        showToast('Pedido enviado para produção!', 'success');
        fecharPanel();
        carregarKanban();
    } catch(err) { showToast('Erro ao criar pedido: '+err.message, 'error'); }
    finally { btn.innerHTML = originalText; btn.disabled = false; }
}