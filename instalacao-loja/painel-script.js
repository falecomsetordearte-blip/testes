// /instalacao-loja/painel-script.js

(function() {
    document.addEventListener('DOMContentLoaded', () => {

        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) {
            window.location.href = '../login.html'; 
            return;
        }
        
        // --- CONFIGURAÇÕES E CONSTANTES ---

        // IDs dos Campos no Bitrix (Mesmos do restante do sistema)
        const NOME_CLIENTE_FIELD = 'UF_CRM_1741273407628';
        const CONTATO_CLIENTE_FIELD = 'UF_CRM_1749481565243';
        const LINK_ATENDIMENTO_FIELD = 'UF_CRM_1752712769666';
        const MEDIDAS_FIELD = 'UF_CRM_1727464924690';
        const LINK_ARQUIVO_FINAL_FIELD = 'UF_CRM_1748277308731';
        const PRAZO_FINAL_FIELD = 'UF_CRM_1757794109';
        
        // Mapeamento visual das medidas (se houver)
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

        // --- ESTILOS CSS INJETADOS (Específicos para esta tela) ---
        const style = document.createElement('style');
        style.textContent = `
            .kanban-card:hover { cursor: pointer; transform: translateY(-3px); box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .card-deadline-tag { margin-top: 8px; display: inline-block; background-color: #e9ecef; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; color: #495057; }
            
            /* Identidade Visual: Roxo para Loja */
            .kanban-card { border-left: 5px solid #9b59b6 !important; background-color: #fff; } 
            
            /* Layout do Modal */
            .detalhe-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .card-detalhe { background-color: #fff; border-radius: 12px; padding: 25px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid #eee; }
            
            .modal-actions-container { display: flex; flex-direction: column; gap: 10px; }
            
            .btn-acao-modal { display: block; text-decoration: none; text-align: center; padding: 12px; border-radius: 6px; font-weight: 600; cursor: pointer; border: none; font-size: 1rem; transition: background 0.2s, transform 0.1s; }
            
            .btn-acao-modal.principal { background-color: #3498db; color: white; }
            .btn-acao-modal.secundario { background-color: #f8f9fa; border: 1px solid #ddd; color: #333; }
            
            /* Botão de Conclusão (Destaque) */
            .btn-concluir { background-color: #27ae60; color: white; margin-top: 15px; font-size: 1.1rem; padding: 15px; width: 100%; }
            .btn-concluir:hover { background-color: #219150; }
            .btn-concluir:active { transform: scale(0.98); }
            .btn-concluir:disabled { background-color: #ccc; cursor: not-allowed; }

            .info-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee; }
            .tag-medidas { padding: 4px 10px; border-radius: 4px; color: white; font-weight: 600; font-size: 12px; }
            
            .icon-destaque { font-size: 3rem; color: #9b59b6; margin-bottom: 15px; display: block; }
        `;
        document.head.appendChild(style);
        
        // --- FUNÇÕES PRINCIPAIS ---

        // 1. Carregar Pedidos da API
        async function carregarPedidos() {
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '<div class="loading-pedidos"><div class="spinner"></div></div>');
            
            try {
                const response = await fetch('/api/instalacao-loja/getDeals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken: sessionToken })
                });
                
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Erro ao carregar');
                
                allDealsData = data.deals;
                organizarPedidosNasColunas(allDealsData);
                
            } catch (error) {
                console.error("Erro:", error);
                board.innerHTML = `<div style="text-align:center; padding: 20px; color: #e74c3c;">
                    <h3>Erro ao carregar pedidos</h3>
                    <p>${error.message}</p>
                    <button onclick="location.reload()" class="btn-acao-modal secundario" style="width:200px; margin: 10px auto;">Tentar Novamente</button>
                </div>`;
            }
        }

        // 2. Concluir Instalação (Mover de Fase)
        async function concluirInstalacao(dealId) {
            if(!confirm("Tem certeza que a instalação foi concluída? O pedido sairá desta lista.")) return;

            const btn = document.getElementById('btn-concluir-action');
            if(btn) { 
                btn.disabled = true; 
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...'; 
            }

            try {
                const response = await fetch('/api/instalacao-loja/concluir', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        sessionToken: sessionToken,
                        dealId: dealId 
                    })
                });
                
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);

                // Sucesso: fecha modal e remove card
                modal.classList.remove('active');
                
                // Remove visualmente o card para feedback instantâneo
                const card = document.querySelector(`.kanban-card[data-deal-id-card="${dealId}"]`);
                if(card) {
                    card.style.transition = 'all 0.5s';
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.9)';
                    setTimeout(() => card.remove(), 500);
                }

                // Opcional: recarregar lista completa após um tempo
                // setTimeout(carregarPedidos, 2000);

            } catch (error) {
                alert(`Erro ao concluir: ${error.message}`);
                if(btn) { 
                    btn.disabled = false; 
                    btn.textContent = "✅ Confirmar Conclusão"; 
                }
            }
        }

        // --- RENDERIZAÇÃO ---

        function organizarPedidosNasColunas(deals) {
            // Limpa colunas
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '');
            
            deals.forEach(deal => {
                let colunaId = 'SEM_DATA';
                const prazoFinalStr = deal[PRAZO_FINAL_FIELD];
                
                if (prazoFinalStr) {
                    const prazoData = new Date(prazoFinalStr.split('T')[0]);
                    const hoje = new Date();
                    hoje.setHours(0,0,0,0);
                    
                    // Cálculo de dias
                    const diffTime = prazoData - hoje;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays < 0) colunaId = 'ATRASADO';
                    else if (diffDays === 0) colunaId = 'HOJE';
                    else if (diffDays <= 7) colunaId = 'ESSA_SEMANA';
                    else colunaId = 'PROXIMA_SEMANA';
                }
                
                const cardHtml = createCardHtml(deal);
                const coluna = document.getElementById(`cards-${colunaId}`);
                if (coluna) coluna.innerHTML += cardHtml;
            });

            // Mensagem de vazio
            document.querySelectorAll('.column-cards').forEach(col => {
                if (col.innerHTML === '') col.innerHTML = '<p class="info-text" style="text-align:center; color:#ccc; font-size:0.9rem; margin-top:10px;">Vazio</p>';
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
                    <div class="card-id" style="font-weight:bold; color:#888; font-size:0.85rem;">${displayId}</div>
                    <div class="card-client-name" style="font-weight:600; margin: 5px 0; color:#333;">${nomeCliente}</div>
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
            
            // Botões de Link
            let linksHtml = '';
            if(deal[LINK_ARQUIVO_FINAL_FIELD]) {
                linksHtml += `<a href="${deal[LINK_ARQUIVO_FINAL_FIELD]}" target="_blank" class="btn-acao-modal principal"><i class="fas fa-download"></i> Baixar Arquivo</a>`;
            }
            if(deal[LINK_ATENDIMENTO_FIELD]) {
                linksHtml += `<a href="${deal[LINK_ATENDIMENTO_FIELD]}" target="_blank" class="btn-acao-modal secundario"><i class="fab fa-whatsapp"></i> Ver Atendimento</a>`;
            }

            modalBody.innerHTML = `
                <div class="detalhe-layout">
                    <!-- Coluna Esquerda: Ação -->
                    <div class="detalhe-col-principal">
                       <div class="card-detalhe" style="text-align: center; padding: 40px 20px; height: 100%; box-sizing: border-box;">
                            <i class="fas fa-store icon-destaque"></i>
                            <h3 style="margin-bottom: 10px;">Finalizar Pedido</h3>
                            <p style="color: #666; font-size: 0.95rem; line-height: 1.5;">
                                Clique abaixo quando o serviço for realizado ou o cliente retirar o material.
                            </p>
                            <button id="btn-concluir-action" class="btn-acao-modal btn-concluir">
                                ✅ Confirmar Conclusão
                            </button>
                       </div>
                    </div>

                    <!-- Coluna Direita: Informações -->
                    <div class="detalhe-col-lateral">
                        <div class="card-detalhe modal-actions-container">
                            ${linksHtml || '<p style="text-align:center; color:#999;">Sem links disponíveis</p>'}
                        </div>
                        <div class="card-detalhe">
                            <h4 style="margin-top:0; border-bottom:1px solid #eee; padding-bottom:10px;">Dados do Cliente</h4>
                            <div class="info-item"><span>Nome:</span><strong>${nomeCliente}</strong></div>
                            <div class="info-item"><span>Contato:</span><span>${contatoCliente}</span></div>
                            <div class="info-item"><span>Medidas:</span>${medidasHtml}</div>
                        </div>
                    </div>
                </div>`;
            
            modal.classList.add('active');

            // Attach event listener ao botão criado dinamicamente
            const btnConcluir = document.getElementById('btn-concluir-action');
            if(btnConcluir) {
                btnConcluir.onclick = () => concluirInstalacao(deal.ID);
            }
        }

        // --- EVENT LISTENERS GERAIS ---
        closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
        
        modal.addEventListener('click', (e) => { 
            if (e.target === modal) modal.classList.remove('active'); 
        });
        
        board.addEventListener('click', (event) => {
            const card = event.target.closest('.kanban-card');
            if (card) openDetailsModal(card.dataset.dealIdCard);
        });
        
        // Iniciar
        carregarPedidos();
    });
})();