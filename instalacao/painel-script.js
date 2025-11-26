// /instalacao/painel-script.js

(function() {
    document.addEventListener('DOMContentLoaded', () => {

        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) {
            window.location.href = '../login.html'; 
            return;
        }
        
        // --- CONFIGURAÇÕES ---
        const NOME_CLIENTE_FIELD = 'UF_CRM_1741273407628';
        const CONTATO_CLIENTE_FIELD = 'UF_CRM_1749481565243';
        const LINK_ATENDIMENTO_FIELD = 'UF_CRM_1752712769666';
        const MEDIDAS_FIELD = 'UF_CRM_1727464924690';
        const LINK_ARQUIVO_FINAL_FIELD = 'UF_CRM_1748277308731';
        const PRAZO_FINAL_FIELD = 'UF_CRM_1757794109';
        
        const MEDIDAS_MAP = {
            '1437': { nome: 'Conferir', cor: '#e74c3c' },
            '1439': { nome: 'Cliente', cor: '#f1c40f' },
            '1441': { nome: 'Conferida', cor: '#2ecc71' }
        };

        const board = document.querySelector('.kanban-board');
        const modal = document.getElementById('modal-detalhes-rapidos');
        const modalTitle = document.getElementById('modal-titulo');
        const modalBody = document.getElementById('modal-body-content');
        const closeModalBtn = modal.querySelector('.close-modal');

        let allDealsData = [];

        // CSS Específico (Azul para diferenciar da Loja que é Roxo)
        const style = document.createElement('style');
        style.textContent = `
            .kanban-card:hover { cursor: pointer; transform: translateY(-3px); box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .card-deadline-tag { margin-top: 8px; display: inline-block; background-color: #e9ecef; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; color: #495057; }
            
            /* Identidade Visual: Azul para Instalação Externa */
            .kanban-card { border-left: 5px solid #3498db !important; background-color: #fff; }
            
            /* Modal Styles - Igual ao da Loja */
            .detalhe-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .card-detalhe { background-color: #fff; border-radius: 12px; padding: 25px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid #eee; }
            
            .modal-actions-container { display: flex; flex-direction: column; gap: 10px; }
            .btn-acao-modal { display: block; text-decoration: none; text-align: center; padding: 12px; border-radius: 6px; font-weight: 600; cursor: pointer; border: none; font-size: 1rem; }
            .btn-acao-modal.principal { background-color: #3498db; color: white; }
            .btn-acao-modal.secundario { background-color: #f8f9fa; border: 1px solid #ddd; color: #333; }
            
            .btn-concluir { background-color: #27ae60; color: white; margin-top: 15px; font-size: 1.1rem; padding: 15px; width: 100%; }
            .btn-concluir:hover { background-color: #219150; }
            .btn-concluir:disabled { background-color: #ccc; cursor: not-allowed; }

            .info-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee; }
            .tag-medidas { padding: 4px 10px; border-radius: 4px; color: white; font-weight: 600; font-size: 12px; }
            .icon-destaque { font-size: 3rem; color: #3498db; margin-bottom: 15px; display: block; }
        `;
        document.head.appendChild(style);
        
        // --- FUNÇÕES API ---

        async function carregarPedidos() {
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '<div class="loading-pedidos"><div class="spinner"></div></div>');
            try {
                // Mantém a rota original de getDeals (assumindo que ela filtra a fase correta de Instalação Externa)
                const response = await fetch('/api/instalacao/getDeals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken: sessionToken })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                allDealsData = data.deals;
                organizarPedidosNasColunas(allDealsData);
            } catch (error) {
                console.error("Erro ao carregar:", error);
                board.innerHTML = `<p style="color:red; padding: 20px;">${error.message}</p>`;
            }
        }

        async function concluirInstalacao(dealId) {
            if(!confirm("Tem certeza que a instalação externa foi realizada?")) return;

            const btn = document.getElementById('btn-concluir-action');
            if(btn) { btn.disabled = true; btn.textContent = "Processando..."; }

            try {
                // NOVA ROTA (que criaremos a seguir)
                const response = await fetch('/api/instalacao/concluir', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        sessionToken: sessionToken,
                        dealId: dealId 
                    })
                });
                
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);

                modal.classList.remove('active');
                
                // Remove visualmente
                const card = document.querySelector(`.kanban-card[data-deal-id-card="${dealId}"]`);
                if(card) {
                    card.style.opacity = '0';
                    setTimeout(() => card.remove(), 500);
                }

            } catch (error) {
                alert(`Erro: ${error.message}`);
                if(btn) { btn.disabled = false; btn.textContent = "✅ Instalação Realizada"; }
            }
        }

        // --- RENDERIZAÇÃO ---

        function organizarPedidosNasColunas(deals) {
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '');
            deals.forEach(deal => {
                let colunaId = 'SEM_DATA';
                const prazoFinalStr = deal[PRAZO_FINAL_FIELD];
                if (prazoFinalStr) {
                    const prazoData = new Date(prazoFinalStr.split('T')[0]);
                    const hoje = new Date();
                    hoje.setHours(0,0,0,0);
                    const diffDays = Math.ceil((prazoData - hoje) / (1000 * 60 * 60 * 24));
                    if (diffDays < 0) colunaId = 'ATRASADO';
                    else if (diffDays === 0) colunaId = 'HOJE';
                    else if (diffDays <= 7) colunaId = 'ESSA_SEMANA';
                    else colunaId = 'PROXIMA_SEMANA';
                }
                const cardHtml = createCardHtml(deal);
                const coluna = document.getElementById(`cards-${colunaId}`);
                if (coluna) coluna.innerHTML += cardHtml;
            });
            document.querySelectorAll('.column-cards').forEach(col => {
                if (col.innerHTML === '') col.innerHTML = '<p class="info-text" style="text-align:center; color:#ccc;">Vazio</p>';
            });
        }
        
        function createCardHtml(deal) {
            const nomeCliente = deal[NOME_CLIENTE_FIELD] || 'Cliente não informado';
            const displayId = deal.TITLE ? `#${deal.TITLE}` : `#${deal.ID}`;
            let prazoTagHtml = '';
            if (deal[PRAZO_FINAL_FIELD]) {
                const dataFormatada = new Date(deal[PRAZO_FINAL_FIELD]).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                prazoTagHtml = `<div class="card-deadline-tag"><i class="far fa-clock"></i> ${dataFormatada}</div>`;
            }
            return `
                <div class="kanban-card" data-deal-id-card="${deal.ID}">
                    <div class="card-id" style="color:#888; font-weight:bold;">${displayId}</div>
                    <div class="card-client-name" style="font-weight:600; margin:5px 0;">${nomeCliente}</div>
                    ${prazoTagHtml}
                </div>`;
        }
        
        function openDetailsModal(dealId) {
            const deal = allDealsData.find(d => d.ID == dealId);
            if (!deal) return;
            
            modalTitle.textContent = `Instalação #${deal.TITLE || deal.ID}`;
            
            const nomeCliente = deal[NOME_CLIENTE_FIELD] || '---';
            const contatoCliente = deal[CONTATO_CLIENTE_FIELD] || '---';
            const medidaInfo = MEDIDAS_MAP[deal[MEDIDAS_FIELD]];
            let medidasHtml = medidaInfo ? `<span class="tag-medidas" style="background-color: ${medidaInfo.cor};">${medidaInfo.nome}</span>` : '---';
            
            let linksHtml = '';
            if(deal[LINK_ARQUIVO_FINAL_FIELD]) linksHtml += `<a href="${deal[LINK_ARQUIVO_FINAL_FIELD]}" target="_blank" class="btn-acao-modal principal"><i class="fas fa-download"></i> Baixar Arquivo</a>`;
            if(deal[LINK_ATENDIMENTO_FIELD]) linksHtml += `<a href="${deal[LINK_ATENDIMENTO_FIELD]}" target="_blank" class="btn-acao-modal secundario"><i class="fab fa-whatsapp"></i> Ver Atendimento</a>`;

            modalBody.innerHTML = `
                <div class="detalhe-layout">
                    <!-- Ação -->
                    <div class="detalhe-col-principal">
                       <div class="card-detalhe" style="text-align: center; padding: 40px 20px; height: 100%; box-sizing: border-box;">
                            <i class="fas fa-wrench icon-destaque"></i>
                            <h3>Finalizar Instalação</h3>
                            <p style="color: #666; margin-bottom: 20px;">
                                O serviço foi concluído no endereço do cliente?
                            </p>
                            <button id="btn-concluir-action" class="btn-acao-modal btn-concluir">
                                ✅ Instalação Realizada
                            </button>
                       </div>
                    </div>

                    <!-- Dados -->
                    <div class="detalhe-col-lateral">
                        <div class="card-detalhe modal-actions-container">${linksHtml || '<p style="text-align:center; color:#999">Sem links</p>'}</div>
                        <div class="card-detalhe">
                            <h4 style="margin-top:0; border-bottom:1px solid #eee; padding-bottom:10px;">Dados do Cliente</h4>
                            <div class="info-item"><span>Nome:</span><strong>${nomeCliente}</strong></div>
                            <div class="info-item"><span>Contato:</span><span>${contatoCliente}</span></div>
                            <div class="info-item"><span>Medidas:</span>${medidasHtml}</div>
                        </div>
                    </div>
                </div>`;
            
            modal.classList.add('active');

            const btnConcluir = document.getElementById('btn-concluir-action');
            if(btnConcluir) btnConcluir.onclick = () => concluirInstalacao(deal.ID);
        }

        // Listeners
        closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
        board.addEventListener('click', (event) => {
            const card = event.target.closest('.kanban-card');
            if (card) openDetailsModal(card.dataset.dealIdCard);
        });
        
        carregarPedidos();
    });
})();