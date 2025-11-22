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

function renderizarPedido(pedido, statusBitrix) {
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('conteudo-pedido').classList.remove('hidden');

    // 1. Cabeçalho
    document.getElementById('view-id-topo').textContent = pedido.bitrix_deal_id;
    document.getElementById('view-titulo').textContent = pedido.titulo || 'Sem título';
    
    // Badge de Status
    const badge = document.getElementById('view-status-badge');
    const statusInfo = getStatusInfo(statusBitrix);
    badge.className = `status-badge ${statusInfo.class}`;
    badge.textContent = statusInfo.text;
    badge.style.fontSize = '1rem';
    badge.style.padding = '8px 16px';

    // 2. Dados do Cliente
    document.getElementById('view-cliente').textContent = pedido.nome_cliente || '-';
    document.getElementById('view-wpp-cliente').textContent = pedido.whatsapp_cliente || '-';

    // 3. Ficha Técnica
    document.getElementById('view-servico').textContent = pedido.servico || '-';
    document.getElementById('view-tipo-arte').textContent = pedido.tipo_arte || '-';
    document.getElementById('view-entrega').textContent = pedido.tipo_entrega || '-';

    // 4. Condicionais (Setor de Arte)
    if (pedido.tipo_arte === 'Setor de Arte') {
        document.getElementById('container-setor-arte').classList.remove('hidden');
        document.getElementById('view-supervisao').textContent = pedido.whatsapp_supervisao || '-';
        
        const valor = parseFloat(pedido.valor_designer);
        document.getElementById('view-valor').textContent = valor ? `R$ ${valor.toFixed(2)}` : '-';
        
        let formato = pedido.formato || '-';
        if (pedido.cdr_versao) formato += ` (v${pedido.cdr_versao})`;
        document.getElementById('view-formato').textContent = formato;
    }

    // 5. Links
    const linksContainer = document.getElementById('container-links');
    linksContainer.innerHTML = '';
    
    if (pedido.link_arquivo_impressao) {
        linksContainer.innerHTML += `
            <a href="${pedido.link_arquivo_impressao}" target="_blank" class="btn-link-externo">
                <i class="fas fa-print"></i> Arquivo Impressão
            </a><br>`;
    }
    if (pedido.link_arquivo_designer) {
        linksContainer.innerHTML += `
            <a href="${pedido.link_arquivo_designer}" target="_blank" class="btn-link-externo">
                <i class="fas fa-layer-group"></i> Referência Designer
            </a>`;
    }
    if (linksContainer.innerHTML === '') {
        linksContainer.innerHTML = '<span style="color:#999; font-size: 0.9rem;">Nenhum link anexado.</span>';
    }

    // 6. Briefing
    document.getElementById('view-briefing').textContent = pedido.briefing_completo || 'Sem descrição.';
}

function getStatusInfo(stageId) {
    stageId = (stageId || '').toUpperCase();
    if (stageId.includes("NEW")) return { text: 'Aguardando Pagamento', class: 'status-pagamento' };
    if (stageId.includes("WON")) return { text: 'Concluído', class: 'status-aprovado' };
    if (stageId.includes("LOSE")) return { text: 'Cancelado', class: 'status-cancelado' };
    if (stageId === "C17:UC_2OEE24") return { text: 'Em Análise', class: 'status-analise' }; // Ajuste conforme seu ID de análise real
    return { text: 'Em Andamento', class: 'status-andamento' };
}

function mostrarErro(msg) {
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('error-screen').classList.remove('hidden');
    document.getElementById('error-msg').textContent = msg;
}