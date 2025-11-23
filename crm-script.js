// crm-script.js - COMPLETO COM BUSCA INTELIGENTE

// Variável para controle do Debounce (atraso na busca)
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializa máscaras
    if (typeof IMask !== 'undefined') {
        const phoneInput = document.getElementById('crm-wpp');
        if (phoneInput) IMask(phoneInput, { mask: '(00) 00000-0000' });
    }

    // 2. Carrega Kanban
    carregarKanban();

    // 3. Configura a BUSCA INTELIGENTE
    configurarBuscaCliente();
});

function configurarBuscaCliente() {
    const nomeInput = document.getElementById('crm-nome');
    const resultsList = document.getElementById('search-results-list');
    const wppInput = document.getElementById('crm-wpp');

    nomeInput.addEventListener('input', function() {
        const query = this.value;

        // Limpa busca anterior
        clearTimeout(searchTimeout);
        
        if (query.length < 2) {
            resultsList.style.display = 'none';
            return;
        }

        // Aguarda 400ms após parar de digitar para buscar
        searchTimeout = setTimeout(async () => {
            try {
                const response = await fetch('/api/crm/searchClients', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionToken: localStorage.getItem('sessionToken'),
                        query: query
                    })
                });
                
                const clientes = await response.json();
                
                // Renderiza lista
                resultsList.innerHTML = '';
                if (clientes.length > 0) {
                    clientes.forEach(cliente => {
                        const li = document.createElement('li');
                        li.innerHTML = `<span>${cliente.nome}</span> <small>${cliente.whatsapp}</small>`;
                        
                        // Ao clicar no cliente da lista
                        li.onclick = () => {
                            nomeInput.value = cliente.nome;
                            // Remove máscara, seta valor, reaplica máscara
                            const wppClean = cliente.whatsapp; 
                            wppInput.value = wppClean;
                            if (typeof IMask !== 'undefined') IMask(wppInput, { mask: '(00) 00000-0000' }).updateValue();
                            
                            resultsList.style.display = 'none';
                        };
                        resultsList.appendChild(li);
                    });
                    resultsList.style.display = 'block';
                } else {
                    // Opcional: Mostrar "Nenhum cliente encontrado, será cadastrado ao salvar"
                    resultsList.style.display = 'none';
                }
            } catch (e) {
                console.error("Erro na busca", e);
            }
        }, 400);
    });

    // Fechar lista se clicar fora
    document.addEventListener('click', (e) => {
        if (!nomeInput.contains(e.target) && !resultsList.contains(e.target)) {
            resultsList.style.display = 'none';
        }
    });
}

// --- FUNÇÕES KANBAN (IGUAL ANTERIOR) ---

async function carregarKanban() {
    try {
        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) { window.location.href = '/login.html'; return; }

        const response = await fetch('/api/crm/listCards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken })
        });

        if (!response.ok) throw new Error("Falha ao carregar oportunidades.");
        const cards = await response.json();

        document.querySelectorAll('.kanban-items').forEach(col => col.innerHTML = '');
        cards.forEach(card => criarCardHTML(card));
        inicializarDragAndDrop();

    } catch (error) {
        console.error("Erro ao carregar Kanban:", error);
    }
}

function criarCardHTML(card) {
    const colunaId = mapColunaToId(card.coluna);
    const container = document.getElementById(colunaId);
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'kanban-card';
    div.dataset.id = card.id;
    div.dataset.json = JSON.stringify(card);
    
    div.onclick = (e) => { abrirModalEdicao(card); };

    const valorFormatado = parseFloat(card.valor_orcamento || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    div.innerHTML = `
        <span class="card-id">${card.titulo_automatico || 'Novo'}</span>
        <div class="card-tags">
            <span class="card-tag tag-arte">${card.servico_tipo}</span>
            ${card.arte_origem ? `<span class="card-tag" style="background:#f0f0f0">${card.arte_origem}</span>` : ''}
        </div>
        <div class="card-title">${card.nome_cliente}</div>
        <span class="card-price">R$ ${valorFormatado}</span>
    `;
    container.appendChild(div);
}

function mapColunaToId(nomeColuna) {
    switch (nomeColuna) {
        case 'Novos': return 'col-novos-list';
        case 'Visita Técnica': return 'col-visita-list';
        case 'Aguardando Orçamento': return 'col-orcamento-list';
        case 'Aguardando Pagamento': return 'col-pagamento-list';
        case 'Abrir Pedido': return 'col-abrir-list';
        default: return 'col-novos-list';
    }
}

function inicializarDragAndDrop() {
    const colunas = document.querySelectorAll('.kanban-items');
    colunas.forEach(coluna => {
        if(coluna.getAttribute('data-sortable-init') === 'true') return;
        new Sortable(coluna, {
            group: 'crm-pipeline', 
            animation: 150,
            ghostClass: 'sortable-ghost', 
            delay: 100, 
            onEnd: function (evt) {
                if (evt.from !== evt.to) {
                    const novaColuna = evt.to.parentElement.getAttribute('data-status');
                    const cardId = evt.item.getAttribute('data-id');
                    atualizarStatusCard(cardId, novaColuna);
                }
            }
        });
        coluna.setAttribute('data-sortable-init', 'true');
    });
}

async function atualizarStatusCard(cardId, novaColuna) {
    try {
        await fetch('/api/crm/moveCard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionToken: localStorage.getItem('sessionToken'),
                cardId: cardId,
                novaColuna: novaColuna
            })
        });
    } catch (error) {
        console.error("Erro ao mover card:", error);
    }
}

// --- SUBMIT DO FORMULÁRIO (SALVAR) ---
document.getElementById('form-crm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById('btn-salvar-rascunho');
    const originalText = submitBtn.innerText;
    submitBtn.innerText = "Salvando...";
    submitBtn.disabled = true;

    const payload = {
        sessionToken: localStorage.getItem('sessionToken'),
        id: document.getElementById('card-id-db').value,
        nome_cliente: document.getElementById('crm-nome').value,
        wpp_cliente: document.getElementById('crm-wpp').value,
        servico_tipo: document.getElementById('crm-servico').value,
        arte_origem: document.getElementById('crm-arte-origem').value,
        valor_orcamento: document.getElementById('crm-valor').value
    };

    try {
        const response = await fetch('/api/crm/saveCard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            fecharModal();
            carregarKanban(); 
            // Limpa a busca
            document.getElementById('search-results-list').style.display = 'none';
        } else {
            alert("Erro ao salvar: " + (data.message || "Erro desconhecido"));
        }
    } catch (error) {
        console.error(error);
        alert("Erro de conexão.");
    } finally {
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
    }
});

// --- CONVERTER EM PEDIDO (PRODUZIR) ---
window.converterEmPedido = async function() {
    const cardId = document.getElementById('card-id-db').value;
    if (!cardId) return alert("Erro: ID do card não encontrado.");

    if (!confirm("Tem certeza? Isso irá gerar um Pedido Oficial e removerá este card do CRM.")) return;

    const btn = document.getElementById('btn-produzir-final');
    btn.textContent = "Processando...";
    btn.disabled = true;

    const producaoPayload = {
        sessionToken: localStorage.getItem('sessionToken'),
        titulo: document.getElementById('modal-titulo').innerText.replace('Editando ', '').trim(),
        servico: document.getElementById('crm-servico').value,
        arte: document.getElementById('crm-arte-origem').value,
        nomeCliente: document.getElementById('crm-nome').value,
        wppCliente: document.getElementById('crm-wpp').value,
        tipoEntrega: 'RETIRADA NO BALCÃO',
        briefingFormatado: `[PEDIDO VINDO DO CRM]\nServiço: ${document.getElementById('crm-servico').value}\nValor Orçado: R$ ${document.getElementById('crm-valor').value}`
    };
    
    if (producaoPayload.arte === 'Setor de Arte') {
        producaoPayload.supervisaoWpp = producaoPayload.wppCliente; 
        producaoPayload.valorDesigner = "0"; 
        producaoPayload.formato = "PDF";
    } else if (producaoPayload.arte === 'Arquivo do Cliente') {
        producaoPayload.linkArquivo = "https://crm-auto-generated.com"; 
    }

    try {
        const responseDeal = await fetch('/api/createDealForGrafica', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(producaoPayload)
        });
        
        const dataDeal = await responseDeal.json();
        
        if (!dataDeal.success && !dataDeal.dealId) throw new Error(dataDeal.message || "Erro no Bitrix.");

        await fetch('/api/crm/deleteCard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                sessionToken: localStorage.getItem('sessionToken'),
                cardId: cardId 
            })
        });

        alert(`Pedido #${dataDeal.dealId} enviado para produção!`);
        fecharModal();
        carregarKanban();

    } catch (error) {
        alert("Ocorreu um erro: " + error.message);
    } finally {
        btn.textContent = "FINALIZAR E PRODUZIR";
        btn.disabled = false;
    }
}

// --- MODAL HELPERS ---
const modal = document.getElementById('modal-card');
const form = document.getElementById('form-crm');

window.abrirModalNovoCard = function() {
    form.reset();
    document.getElementById('card-id-db').value = '';
    document.getElementById('modal-titulo').innerText = 'Nova Oportunidade';
    document.getElementById('btn-produzir-final').style.display = 'none';
    document.getElementById('search-results-list').style.display = 'none';
    modal.style.display = 'flex';
}

function abrirModalEdicao(card) {
    document.getElementById('modal-titulo').innerText = `Editando ${card.titulo_automatico || 'Oportunidade'}`;
    document.getElementById('card-id-db').value = card.id;
    document.getElementById('crm-nome').value = card.nome_cliente || '';
    document.getElementById('crm-wpp').value = card.wpp_cliente || '';
    document.getElementById('crm-servico').value = card.servico_tipo || 'Arte Impressão';
    document.getElementById('crm-arte-origem').value = card.arte_origem || 'Setor de Arte';
    document.getElementById('crm-valor').value = card.valor_orcamento || '';
    document.getElementById('btn-produzir-final').style.display = 'block';
    document.getElementById('search-results-list').style.display = 'none';
    
    modal.style.display = 'flex';
    if (typeof IMask !== 'undefined') {
        IMask(document.getElementById('crm-wpp'), { mask: '(00) 00000-0000' });
    }
}

window.fecharModal = function() { modal.style.display = 'none'; }
window.onclick = function(e) { if (e.target == modal) fecharModal(); }