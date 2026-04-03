// /pedido-script.js - Hub de Detalhes Dinâmico
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('id');
    const token = localStorage.getItem('sessionToken');

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    if (!orderId) {
        mostrarErro('ID do pedido não fornecido.');
        return;
    }

    try {
        mostrarLoading(true);
        const response = await fetch('/api/getOrderDetails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: token, orderId: orderId })
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.message || 'Erro ao carregar pedido.');

        renderizarPedido(data.pedido, data.statusBitrix);

    } catch (error) {
        console.error(error);
        mostrarErro(error.message);
    }
});

function mostrarLoading(show) {
    const loader = document.getElementById('loading-screen');
    const content = document.getElementById('hub-content');
    if (show) {
        loader.classList.remove('hidden');
        content.classList.add('hidden');
    } else {
        loader.classList.add('hidden');
        content.classList.remove('hidden');
    }
}

function renderizarPedido(pedido, statusBitrix) {
    mostrarLoading(false);

    // 1. Cabeçalho & Status
    document.getElementById('view-id-badge').textContent = `#${pedido.id}`;
    document.getElementById('view-titulo').textContent = pedido.titulo || 'Sem título';
    
    const badge = document.getElementById('view-status-badge');
    const statusInfo = getStatusInfo(statusBitrix || pedido.etapa);
    badge.textContent = statusInfo.text;
    badge.style.backgroundColor = statusInfo.bg;
    badge.style.color = statusInfo.color;

    // 2. Dados do Cliente
    document.getElementById('view-cliente').textContent = pedido.nome_cliente || 'Não informado';
    
    const wppContainer = document.getElementById('container-whatsapp');
    if (pedido.whatsapp_cliente) {
        const cleanWpp = pedido.whatsapp_cliente.replace(/\D/g, '');
        wppContainer.innerHTML = `
            <a href="https://wa.me/${cleanWpp}" target="_blank" class="btn-hub btn-hub-whatsapp">
                <i class="fab fa-whatsapp"></i> ${pedido.whatsapp_cliente}
            </a>`;
    } else {
        wppContainer.innerHTML = '<span class="hub-info-value">---</span>';
    }

    // 3. Ficha Técnica
    document.getElementById('view-servico').textContent = pedido.servico || '---';
    document.getElementById('view-tipo-arte').textContent = pedido.tipo_arte || '---';
    document.getElementById('view-material').textContent = pedido.material_id || 'Padrão';
    document.getElementById('view-impressora').textContent = pedido.impressoras_ids ? pedido.impressoras_ids.join(', ') : '---';
    
    // Data de Entrega
    const entregaEl = document.getElementById('view-entrega');
    if (pedido.data_entrega) {
        const date = new Date(pedido.data_entrega);
        entregaEl.textContent = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } else {
        entregaEl.textContent = 'A definir';
    }

    // 4. Layout Preview ( VPC )
    const layoutContainer = document.getElementById('container-layout-preview');
    if (pedido.link_layout) {
        layoutContainer.innerHTML = `<img src="${pedido.link_layout}" class="layout-preview-img" alt="Layout Image" onerror="this.src='/images/placeholder-error.png'">`;
    } else {
        layoutContainer.innerHTML = '<div style="color:#94a3b8; text-align:center;"><i class="fas fa-image fa-3x"></i><p>Sem prévia disponível</p></div>';
    }

    // 5. Briefing
    document.getElementById('view-briefing').textContent = pedido.briefing_completo || 'Nenhuma observação técnica registrada.';

    // 6. Arquivos e Links
    const linksContainer = document.getElementById('container-links');
    linksContainer.innerHTML = '';
    
    if (pedido.link_arquivo_impressao) {
        linksContainer.innerHTML += `
            <a href="${pedido.link_arquivo_impressao}" target="_blank" class="btn-hub btn-hub-primary">
                <i class="fas fa-file-download"></i> Arquivo de Impressão
            </a>`;
    }
    if (pedido.link_arquivo_designer) {
        linksContainer.innerHTML += `
            <a href="${pedido.link_arquivo_designer}" target="_blank" class="btn-hub btn-hub-outline">
                <i class="fas fa-vector-square"></i> Arquivo do Designer
            </a>`;
    }
    
    if (linksContainer.innerHTML === '') {
        linksContainer.innerHTML = '<p style="color:#94a3b8; font-size:0.9rem;">Nenhum arquivo anexado a este pedido.</p>';
    }

    // 7. Painel Admin
    const permissoes = JSON.parse(localStorage.getItem('userPermissoes') || '[]');
    if (permissoes.includes("admin")) {
        const adminPanel = document.getElementById('admin-panel');
        adminPanel.classList.remove('hidden');
        configurarEventosAdmin(pedido.id);
    }
}

function getStatusInfo(stageId) {
    const stage = (stageId || '').toUpperCase();
    
    // Mapeamento de cores premium
    const map = {
        'ARTE': { text: 'Arte / Design', bg: '#dbeafe', color: '#1e40af' },
        'IMPRESSÃO': { text: 'Em Impressão', bg: '#fef3c7', color: '#92400e' },
        'ACABAMENTO': { text: 'No Acabamento', bg: '#e0e7ff', color: '#3730a3' },
        'INSTALAÇÃO LOJA': { text: 'Instalando na Loja', bg: '#ede9fe', color: '#5b21b6' },
        'INSTALAÇÃO EXTERNA': { text: 'Instalação Externa', bg: '#fae8ff', color: '#86198f' },
        'CONCLUÍDO': { text: 'Finalizado', bg: '#d1fae5', color: '#065f46' },
        'WON': { text: 'Finalizado', bg: '#d1fae5', color: '#065f46' },
        'CANCELADO': { text: 'Cancelado', bg: '#fee2e2', color: '#991b1b' },
        'LOSE': { text: 'Cancelado', bg: '#fee2e2', color: '#991b1b' }
    };

    for (const key in map) {
        if (stage.includes(key)) return map[key];
    }
    
    return { text: stage || 'Em Processamento', bg: '#f1f5f9', color: '#475569' };
}

function mostrarErro(msg) {
    mostrarLoading(false);
    document.getElementById('hub-content').classList.add('hidden');
    document.getElementById('error-screen').classList.remove('hidden');
    document.getElementById('error-msg').textContent = msg;
}

function configurarEventosAdmin(dealId) {
    const btnMover = document.getElementById('btn-admin-change-stage');
    const selectStage = document.getElementById('admin-stage-select');
    const btnExcluir = document.getElementById('btn-admin-delete');
    const sessionToken = localStorage.getItem('sessionToken');

    btnMover.onclick = async () => {
        const novoEstagio = selectStage.value;
        if (!novoEstagio) return alert("Selecione a etapa.");
        
        if (!confirm("Deseja forçar a mudança de etapa deste pedido?")) return;
        
        btnMover.disabled = true;
        try {
            const res = await fetch('/api/admin/forceUpdateStage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionToken, dealId, newStageId: novoEstagio })
            });
            if (res.ok) window.location.reload();
            else alert("Erro ao mover.");
        } catch (e) { console.error(e); }
        btnMover.disabled = false;
    };

    btnExcluir.onclick = async () => {
        const confirmId = prompt(`Digite o ID ${dealId} para excluir PERMANENTEMENTE:`);
        if (confirmId !== String(dealId)) return;
        
        btnExcluir.disabled = true;
        try {
            const res = await fetch('/api/admin/deleteDeal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionToken, dealId })
            });
            if (res.ok) window.location.href = '/dashboard.html';
            else alert("Erro ao excluir.");
        } catch (e) { console.error(e); }
        btnExcluir.disabled = false;
    };
}