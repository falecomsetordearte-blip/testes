// crm-script.js - COMPLETO (COM SCROLL LATERAL)

let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
    configurarMascaras();
    carregarKanban();
    configurarBuscaCliente();
    configurarFormularioVisual();
    configurarScrollLateral(); // <--- ATIVA O SCROLL
});

// --- NOVO RECURSO: SCROLL LATERAL (HOVER) ---
function configurarScrollLateral() {
    const board = document.querySelector('.kanban-board');
    const leftZone = document.getElementById('scroll-trigger-left');
    const rightZone = document.getElementById('scroll-trigger-right');
    
    if (!board || !leftZone || !rightZone) return;

    let scrollInterval = null;
    const speed = 10; // Velocidade da rolagem

    // Função que inicia o loop de scroll
    const startScrolling = (direction) => {
        if (scrollInterval) return;

        scrollInterval = requestAnimationFrame(function loop() {
            if (direction === 'left') {
                board.scrollLeft -= speed;
            } else {
                board.scrollLeft += speed;
            }
            scrollInterval = requestAnimationFrame(loop);
        });
    };

    // Função que para o loop
    const stopScrolling = () => {
        if (scrollInterval) {
            cancelAnimationFrame(scrollInterval);
            scrollInterval = null;
        }
    };

    // Eventos
    leftZone.addEventListener('mouseenter', () => startScrolling('left'));
    leftZone.addEventListener('mouseleave', stopScrolling);
    rightZone.addEventListener('mouseenter', () => startScrolling('right'));
    rightZone.addEventListener('mouseleave', stopScrolling);
    
    // Opcional: Clique para rolar rápido
    leftZone.addEventListener('click', () => { board.scrollBy({ left: -300, behavior: 'smooth' }); });
    rightZone.addEventListener('click', () => { board.scrollBy({ left: 300, behavior: 'smooth' }); });
}

// --- MÁSCARAS ---
function configurarMascaras() {
    if (typeof IMask !== 'undefined') {
        const els = ['crm-wpp', 'pedido-supervisao'];
        els.forEach(id => {
            const el = document.getElementById(id);
            if (el) IMask(el, { mask: '(00) 00000-0000' });
        });
    }
}

// --- VISUAL DO FORMULÁRIO (CARDS, CONDICIONAIS, MATERIAIS) ---
function configurarFormularioVisual() {
    // 1. Cards de Serviço
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

    // 2. Condicionais Arte
    const radiosArte = document.querySelectorAll('input[name="pedido-arte"]');
    const arqFields = document.getElementById('arquivo-cliente-fields');
    const setorFields = document.getElementById('setor-arte-fields');

    radiosArte.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const val = e.target.value;
            arqFields.classList.add('hidden');
            setorFields.classList.add('hidden');

            document.getElementById('link-arquivo').required = false;
            document.getElementById('pedido-supervisao').required = false;
            document.getElementById('valor-designer').required = false;
            document.getElementById('pedido-formato').required = false;

            if (val === 'Arquivo do Cliente') {
                arqFields.classList.remove('hidden');
                document.getElementById('link-arquivo').required = true;
            } else if (val === 'Setor de Arte') {
                setorFields.classList.remove('hidden');
                document.getElementById('pedido-supervisao').required = true;
                document.getElementById('valor-designer').required = true;
                document.getElementById('pedido-formato').required = true;
            }
        });
    });

    // 3. Formato CDR
    document.getElementById('pedido-formato').addEventListener('change', (e) => {
        const div = document.getElementById('cdr-versao-container');
        if(e.target.value === 'CDR') div.classList.remove('hidden');
        else div.classList.add('hidden');
    });

    // 4. Botão Add Material
    document.getElementById('btn-add-material').addEventListener('click', () => adicionarMaterialNoForm());
}

function adicionarMaterialNoForm(desc = '', det = '') {
    const container = document.getElementById('materiais-container');
    const count = container.children.length + 1;
    const div = document.createElement('div');
    div.className = 'material-item';
    div.innerHTML = `
        <label style="font-weight:bold; color:#3498db; font-size:0.9rem; display:block; margin-bottom:5px">Item ${count}</label>
        <div style="margin-bottom:10px">
            <label style="font-size:0.85rem">Descrição</label>
            <input type="text" class="mat-desc" value="${desc}" placeholder="Ex: Banner 60x100" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px">
        </div>
        <div>
            <label style="font-size:0.85rem">Detalhes</label>
            <textarea class="mat-det" rows="2" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px">${det}</textarea>
        </div>
    `;
    container.appendChild(div);
}

// --- KANBAN LOGIC ---
async function carregarKanban() {
    try {
        const token = localStorage.getItem('sessionToken');
        if(!token) { window.location.href = '/login.html'; return; }

        const res = await fetch('/api/crm/listCards', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ sessionToken: token })
        });
        
        if(!res.ok) throw new Error("Erro ao carregar");
        const cards = await res.json();

        document.querySelectorAll('.kanban-items').forEach(c => c.innerHTML = '');
        cards.forEach(card => criarCardHTML(card));
        inicializarDragAndDrop();
    } catch(err) { console.error(err); }
}

function criarCardHTML(card) {
    const map = {
        'Novos': 'col-novos-list', 'Visita Técnica': 'col-visita-list',
        'Aguardando Orçamento': 'col-orcamento-list', 'Aguardando Pagamento': 'col-pagamento-list',
        'Abrir Pedido': 'col-abrir-list'
    };
    const container = document.getElementById(map[card.coluna] || 'col-novos-list');
    
    const div = document.createElement('div');
    div.className = 'kanban-card';
    div.dataset.id = card.id;
    div.dataset.json = JSON.stringify(card); 
    div.onclick = () => abrirPanelEdicao(card);

    const valor = parseFloat(card.valor_orcamento||0).toLocaleString('pt-BR', {minimumFractionDigits:2});
    
    div.innerHTML = `
        <span class="card-id">${card.titulo_automatico || 'Novo'}</span>
        <div class="card-tags">
            <span class="card-tag tag-arte">${card.servico_tipo}</span>
            ${card.arte_origem ? `<span class="card-tag" style="background:#f0f0f0">${card.arte_origem}</span>` : ''}
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
            group: 'crm', animation: 150,
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

// --- PAINEL LATERAL (DRAWER) CONTROLS ---
const overlay = document.getElementById('slide-overlay');
const panel = document.getElementById('slide-panel');

function resetarForm() {
    document.getElementById('form-crm').reset();
    document.getElementById('card-id-db').value = '';
    
    document.getElementById('servico-selection-container').classList.remove('selection-made');
    document.querySelectorAll('.servico-card').forEach(c => c.classList.remove('active'));
    document.getElementById('form-content-wrapper').classList.remove('visible');
    
    document.getElementById('arquivo-cliente-fields').classList.add('hidden');
    document.getElementById('setor-arte-fields').classList.add('hidden');
    document.getElementById('materiais-container').innerHTML = '';
}

window.abrirPanelNovo = function() {
    resetarForm();
    document.getElementById('panel-titulo').innerText = 'Nova Oportunidade';
    document.getElementById('display-id-automatico').innerText = '# NOVO';
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

    // Preencher Básicos
    document.getElementById('card-id-db').value = card.id;
    document.getElementById('crm-nome').value = card.nome_cliente;
    document.getElementById('crm-wpp').value = card.wpp_cliente;
    document.getElementById('crm-valor').value = card.valor_orcamento;

    // Trigger Serviço
    const sCard = document.querySelector(`.servico-card[data-value="${card.servico_tipo}"]`);
    if(sCard) sCard.click();

    // Parse JSON Extras
    let extras = {};
    try { 
        if (card.briefing_json) {
            extras = (typeof card.briefing_json === 'string') ? JSON.parse(card.briefing_json) : card.briefing_json;
        }
    } catch(e){}

    // Trigger Arte
    if(card.arte_origem) {
        const r = document.querySelector(`input[name="pedido-arte"][value="${card.arte_origem}"]`);
        if(r) { r.checked = true; r.dispatchEvent(new Event('change')); }
    }

    // Preencher Extras
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

    // Materiais
    if(extras.materiais && extras.materiais.length > 0) {
        document.getElementById('materiais-container').innerHTML = '';
        extras.materiais.forEach(m => adicionarMaterialNoForm(m.descricao, m.detalhes));
    } else {
        adicionarMaterialNoForm();
    }

    // Update Máscaras
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

// --- BUSCA CLIENTE ---
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
                        li.innerHTML = `<span>${c.nome}</span> <small>${c.whatsapp}</small>`;
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

// --- SALVAR (DRAFT) ---
document.getElementById('form-crm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-salvar-rascunho');
    const originalText = btn.innerText;
    btn.innerText = 'Salvando...'; btn.disabled = true;

    // Coleta Materiais
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
        } else {
            const err = await res.json();
            alert('Erro ao salvar: ' + (err.message || 'Desconhecido'));
        }
    } catch(err) { alert('Erro de conexão ao salvar.'); }
    finally { btn.innerText = originalText; btn.disabled = false; }
});

// --- PRODUZIR ---
window.converterEmPedido = async function() {
    const id = document.getElementById('card-id-db').value;
    if(!id) return alert('Salve o card antes de enviar para produção.');
    if(!confirm('Deseja iniciar a produção? Isso enviará para o Bitrix e removerá o card deste CRM.')) return;

    const btn = document.getElementById('btn-produzir-final');
    const originalText = btn.innerText;
    btn.innerText = 'Enviando...'; btn.disabled = true;

    let txt = "";
    document.querySelectorAll('.material-item').forEach((d, i) => {
        txt += `--- Item ${i+1} ---\nMaterial: ${d.querySelector('.mat-desc').value}\nDetalhes: ${d.querySelector('.mat-det').value}\n\n`;
    });

    const payload = {
        sessionToken: localStorage.getItem('sessionToken'),
        titulo: document.getElementById('display-id-automatico').innerText,
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

        alert('Pedido enviado com sucesso!');
        fecharPanel();
        carregarKanban();
    } catch(err) { alert('Erro ao criar pedido: '+err.message); }
    finally { btn.innerText = originalText; btn.disabled = false; }
}