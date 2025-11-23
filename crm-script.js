// crm-script.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializa máscaras de input
    if (typeof IMask !== 'undefined') {
        const phoneInput = document.getElementById('crm-wpp');
        if (phoneInput) {
            IMask(phoneInput, { mask: '(00) 00000-0000' });
        }
    }

    // 2. Carrega o quadro Kanban
    carregarKanban();
});

// --- FUNÇÕES PRINCIPAIS DE LEITURA E RENDERIZAÇÃO ---

async function carregarKanban() {
    try {
        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) {
            window.location.href = '/login.html';
            return;
        }

        const response = await fetch('/api/crm/listCards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken })
        });

        if (!response.ok) throw new Error("Falha ao carregar oportunidades.");

        const cards = await response.json();

        // Limpar colunas antes de renderizar
        document.querySelectorAll('.kanban-items').forEach(col => col.innerHTML = '');

        // Renderizar cada card na coluna correta
        cards.forEach(card => criarCardHTML(card));

        // Inicializar Drag and Drop (SortableJS)
        inicializarDragAndDrop();

    } catch (error) {
        console.error("Erro ao carregar Kanban:", error);
        // Opcional: Mostrar feedback visual de erro na tela
    }
}

function criarCardHTML(card) {
    const colunaId = mapColunaToId(card.coluna);
    const container = document.getElementById(colunaId);

    if (!container) return; // Se a coluna não existir no HTML, ignora

    const div = document.createElement('div');
    div.className = 'kanban-card';
    div.dataset.id = card.id;
    // Guardamos o objeto completo no dataset para acesso rápido ao abrir o modal
    div.dataset.json = JSON.stringify(card);
    
    // Evento de clique para editar
    div.onclick = (e) => {
        // Evita abrir o modal se o clique for apenas para arrastar (prevenção básica)
        abrirModalEdicao(card);
    };

    // Formatação de moeda
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
        default: return 'col-novos-list'; // Fallback
    }
}

function inicializarDragAndDrop() {
    const colunas = document.querySelectorAll('.kanban-items');
    
    colunas.forEach(coluna => {
        // Verifica se já existe instância para não duplicar listeners
        if(coluna.getAttribute('data-sortable-init') === 'true') return;

        new Sortable(coluna, {
            group: 'crm-pipeline', // Permite arrastar entre colunas diferentes
            animation: 150,
            ghostClass: 'sortable-ghost', // Classe aplicada ao placeholder enquanto arrasta
            delay: 100, // Pequeno delay para diferenciar clique de arrasto em mobile
            onEnd: function (evt) {
                const itemEl = evt.item;
                const novaColunaDiv = evt.to.parentElement; // A div pai da lista (.kanban-column)
                const novaColunaNome = novaColunaDiv.getAttribute('data-status');
                const cardId = itemEl.getAttribute('data-id');

                // Só atualiza se mudou de coluna
                if (evt.from !== evt.to) {
                    atualizarStatusCard(cardId, novaColunaNome);
                }
            }
        });
        
        coluna.setAttribute('data-sortable-init', 'true');
    });
}

// --- FUNÇÕES DE INTERAÇÃO COM API (SALVAR, MOVER, PRODUZIR) ---

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
        console.log(`Card ${cardId} movido para ${novaColuna}`);
    } catch (error) {
        console.error("Erro ao mover card:", error);
        alert("Erro ao salvar a nova posição do card. Recarregue a página.");
    }
}

// Listener do Formulário de Edição/Criação
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
            carregarKanban(); // Recarrega para mostrar alterações
        } else {
            alert("Erro ao salvar: " + (data.message || "Erro desconhecido"));
        }
    } catch (error) {
        console.error(error);
        alert("Erro de conexão ao salvar.");
    } finally {
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
    }
});

// FUNÇÃO PARA CONVERTER O CARD DO CRM EM PEDIDO REAL (PRODUÇÃO)
window.converterEmPedido = async function() {
    const cardId = document.getElementById('card-id-db').value;
    if (!cardId) return alert("Erro: ID do card não encontrado.");

    if (!confirm("Tem certeza? Isso irá gerar um Pedido de Produção oficial no sistema e removerá este card do CRM.")) {
        return;
    }

    const btn = document.getElementById('btn-produzir-final');
    btn.textContent = "Processando...";
    btn.disabled = true;

    // 1. Preparar os dados para a API de Produção (createDealForGrafica)
    // Mapeamos os campos do CRM para o formato que a API de produção espera
    const producaoPayload = {
        sessionToken: localStorage.getItem('sessionToken'),
        titulo: document.getElementById('modal-titulo').innerText.replace('Editando ', '').trim(),
        servico: document.getElementById('crm-servico').value,
        arte: document.getElementById('crm-arte-origem').value,
        nomeCliente: document.getElementById('crm-nome').value,
        wppCliente: document.getElementById('crm-wpp').value,
        tipoEntrega: 'RETIRADA NO BALCÃO', // Padrão, já que o CRM simplificado não tem esse campo
        briefingFormatado: `[PEDIDO VINDO DO CRM]\nServiço: ${document.getElementById('crm-servico').value}\nValor Orçado: R$ ${document.getElementById('crm-valor').value}\n\nObs: Verifique detalhes com o cliente.`
    };
    
    // Se for setor de arte, precisamos passar campos obrigatórios fictícios ou zerados
    // para a API não rejeitar, pois o CRM simplificado não captura tudo
    if (producaoPayload.arte === 'Setor de Arte') {
        producaoPayload.supervisaoWpp = producaoPayload.wppCliente; // Usa o do cliente como fallback
        producaoPayload.valorDesigner = "0"; // Será ajustado depois na produção
        producaoPayload.formato = "PDF";
    } else if (producaoPayload.arte === 'Arquivo do Cliente') {
        producaoPayload.linkArquivo = "https://pendente-envio.com"; // Placeholder para não quebrar validação
    }

    try {
        // Passo A: Criar o Deal no Bitrix
        const responseDeal = await fetch('/api/createDealForGrafica', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(producaoPayload)
        });
        
        const dataDeal = await responseDeal.json();
        
        if (!dataDeal.success && !dataDeal.dealId) {
            throw new Error(dataDeal.message || "Erro ao criar pedido no Bitrix.");
        }

        // Passo B: Se sucesso, deletar o Card do CRM (Neon)
        await fetch('/api/crm/deleteCard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                sessionToken: localStorage.getItem('sessionToken'),
                cardId: cardId 
            })
        });

        alert(`Sucesso! Pedido #${dataDeal.dealId} enviado para produção.`);
        fecharModal();
        carregarKanban(); // Atualiza a tela removendo o card

    } catch (error) {
        console.error("Erro na conversão:", error);
        alert("Ocorreu um erro: " + error.message);
    } finally {
        btn.textContent = "FINALIZAR E PRODUZIR";
        btn.disabled = false;
    }
}

// --- CONTROLE DO MODAL ---

const modal = document.getElementById('modal-card');
const form = document.getElementById('form-crm');

window.abrirModalNovoCard = function() {
    form.reset();
    document.getElementById('card-id-db').value = '';
    document.getElementById('modal-titulo').innerText = 'Nova Oportunidade';
    document.getElementById('btn-produzir-final').style.display = 'none'; // Esconde botão de produzir em novos
    modal.style.display = 'flex';
}

function abrirModalEdicao(card) {
    document.getElementById('modal-titulo').innerText = `Editando ${card.titulo_automatico || 'Oportunidade'}`;
    
    // Preenche os campos
    document.getElementById('card-id-db').value = card.id;
    document.getElementById('crm-nome').value = card.nome_cliente || '';
    document.getElementById('crm-wpp').value = card.wpp_cliente || '';
    document.getElementById('crm-servico').value = card.servico_tipo || 'Arte Impressão';
    document.getElementById('crm-arte-origem').value = card.arte_origem || 'Setor de Arte';
    document.getElementById('crm-valor').value = card.valor_orcamento || '';

    // Mostra botão de produzir
    document.getElementById('btn-produzir-final').style.display = 'block';
    
    modal.style.display = 'flex';
    
    // Atualiza máscara no campo preenchido
    if (typeof IMask !== 'undefined') {
        const phoneInput = document.getElementById('crm-wpp');
        IMask(phoneInput, { mask: '(00) 00000-0000' }); 
    }
}

window.fecharModal = function() {
    modal.style.display = 'none';
}

// Fecha modal ao clicar fora do conteúdo
window.onclick = function(event) {
    if (event.target == modal) {
        fecharModal();
    }
}