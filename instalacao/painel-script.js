// /instalacao/painel-script.js

(function() {
    document.addEventListener('DOMContentLoaded', () => {

        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) {
            window.location.href = '../login.html'; 
            return;
        }
        
        // --- CONFIGURAÇÕES ---
        const LAYOUT_FIELD = 'UF_CRM_1764124589418'; // ID do campo do Link do Layout

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

        // --- CSS NOVO: LAYOUT DIVIDIDO E IMAGEM ---
        const style = document.createElement('style');
        style.textContent = `
            .kanban-card:hover { cursor: pointer; transform: translateY(-3px); box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .card-deadline-tag { margin-top: 8px; display: inline-block; background-color: #e9ecef; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; color: #495057; }
            /* Identidade Visual: Azul para Instalação Externa */
            .kanban-card { border-left: 5px solid #3498db !important; background-color: #fff; }
            
            /* -- MODAL GRID (Split View) -- */
            .detalhe-layout { 
                display: grid; 
                grid-template-columns: 60% 38%; /* Coluna da Imagem Maior */
                gap: 2%; 
                height: 100%;
                min-height: 450px;
            }

            /* ÁREA DA IMAGEM (ESQUERDA) */
            .detalhe-col-principal { 
                background-color: #f8f9fa; 
                border-radius: 12px; 
                border: 2px dashed #dee2e6;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                position: relative;
                padding: 10px;
            }
            .layout-img { 
                max-width: 100%; 
                max-height: 100%; 
                object-fit: contain; 
                cursor: zoom-in;
                box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                border-radius: 4px;
            }
            .sem-imagem {
                text-align: center; color: #aaa; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;
            }
            .sem-imagem i { font-size: 4rem; margin-bottom: 15px; opacity: 0.5; }
            .sem-imagem p { font-size: 1.1rem; margin: 0; }

            /* ÁREA DE AÇÃO (DIREITA) */
            .detalhe-col-lateral { 
                display: flex; 
                flex-direction: column; 
                gap: 15px; 
            }
            .card-detalhe { 
                background-color: #fff; 
                border-radius: 8px; 
                padding: 15px; 
                border: 1px solid #eee; 
                box-shadow: 0 2px 4px rgba(0,0,0,0.03);
            }

            /* BOTÕES */
            .btn-acao-modal { 
                display: block; width: 100%; text-decoration: none; text-align: center; 
                padding: 12px; border-radius: 6px; font-weight: 600; margin-bottom: 8px; border:none; cursor: pointer; transition: background 0.2s;
            }
            .btn-acao-modal.principal { background-color: #3498db; color: white; }
            .btn-acao-modal.secundario { background-color: #f1f1f1; border: 1px solid #ddd; color: #333; }
            
            /* BOTÃO CONCLUIR GIGANTE */
            .btn-concluir { 
                background-color: #27ae60; 
                color: white; 
                font-size: 1.1rem; 
                padding: 18px; 
                margin-bottom: 15px;
                box-shadow: 0 4px 10px rgba(39, 174, 96, 0.25);
                border: none;
                cursor: pointer;
                transition: transform 0.2s, background-color 0.2s;
                border-radius: 8px;
                font-weight: 700;
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
            }
            .btn-concluir:hover { background-color: #219150; transform: translateY(-2px); }
            .btn-concluir:active { transform: scale(0.98); }
            .btn-concluir:disabled { background-color: #ccc; cursor: not-allowed; transform: none; box-shadow: none; }

            .info-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee; }
            .tag-medidas { padding: 4px 10px; border-radius: 4px; color: white; font-weight: 600; font-size: 12px; }

            @media (max-width: 768px) {
                .detalhe-layout { grid-template-columns: 1fr; gap: 20px; }
                .detalhe-col-principal { min-height: 250px; }
            }
        `;
        document.head.appendChild(style);
        
        // --- HELPER: CONVERTER LINK DRIVE EM IMAGEM ---
        function processarLinkImagem(url) {
            if (!url) return null;
            
            // 1. Google Drive (Padrão)
            if (url.includes('drive.google.com')) {
                // Tenta extrair ID de /file/d/ID ou id=ID
                const idMatch = url.match(/\/d\/(.*?)\/|\/d\/(.*)$|id=(.*?)$/);
                const fileId = idMatch ? (idMatch[1] || idMatch[2] || idMatch[3]) : null;
                if (fileId) {
                    // Tenta usar o visualizador direto de conteúdo do Google
                    return `https://lh3.googleusercontent.com/d/${fileId}`;
                }
            }
            
            // 2. Google Photos ou outros links diretos
            if (url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || url.includes('googleusercontent')) {
                return url;
            }

            // Retorna o original na esperança de funcionar
            return url;
        }

        // --- API & LÓGICA ---

        async function carregarPedidos() {
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '<div class="loading-pedidos"><div class="spinner"></div></div>');
            try {
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
            if(!confirm("Tem certeza que a instalação externa foi concluída?")) return;

            const btn = document.getElementById('btn-concluir-action');
            if(btn) { 
                btn.disabled = true; 
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...'; 
            }

            try {
                const response = await fetch('/api/instalacao/concluir', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken: sessionToken, dealId: dealId })
                });
                
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);

                modal.classList.remove('active');
                
                // Feedback visual instantâneo (Remove Card)
                const card = document.querySelector(`.kanban-card[data-deal-id-card="${dealId}"]`);
                if(card) {
                    card.style.transition = 'opacity 0.5s';
                    card.style.opacity = '0';
                    setTimeout(() => card.remove(), 500);
                }

            } catch (error) {
                alert(`Erro: ${error.message}`);
                if(btn) { 
                    btn.disabled = false; 
                    btn.innerHTML = '<i class="fas fa-check-circle"></i> Instalação Realizada'; 
                }
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
                    <div class="card-id" style="color:#888; font-weight:bold;">${displayId}</div>
                    <div class="card-client-name" style="font-weight:600; margin:5px 0;">${nomeCliente}</div>
                    ${prazoTagHtml}
                </div>`;
        }
        
        function openDetailsModal(dealId) {
            const deal = allDealsData.find(d => d.ID == dealId);
            if (!deal) return;
            
            modalTitle.textContent = `Instalação #${deal.TITLE || deal.ID}`;
            
            // Dados Básicos
            const nomeCliente = deal[NOME_CLIENTE_FIELD] || '---';
            const contatoCliente = deal[CONTATO_CLIENTE_FIELD] || '---';
            const medidaInfo = MEDIDAS_MAP[deal[MEDIDAS_FIELD]];
            let medidasHtml = medidaInfo ? `<span class="tag-medidas" style="background-color: ${medidaInfo.cor};">${medidaInfo.nome}</span>` : '---';
            
            // Processamento da Imagem
            const rawLink = deal[LAYOUT_FIELD]; // Pega o link do Bitrix
            const imageSrc = processarLinkImagem(rawLink);
            
            let imageHtml = '';
            if (imageSrc) {
                imageHtml = `
                    <a href="${rawLink}" target="_blank" title="Clique para abrir original">
                        <img src="${imageSrc}" class="layout-img" alt="Layout de Instalação" 
                        onerror="this.onerror=null; this.parentElement.parentElement.innerHTML='<div class=sem-imagem><i class=\\'fas fa-link\\'></i><p>Erro ao pré-visualizar</p><a href=\\'${rawLink}\\' target=\\'_blank\\' class=\\'btn-acao-modal secundario\\'>Abrir Link Externo</a></div>'">
                    </a>`;
            } else {
                imageHtml = `
                    <div class="sem-imagem">
                        <i class="fas fa-image"></i>
                        <p>Nenhum layout anexado</p>
                    </div>`;
            }

            // Links Extras
            let linksHtml = '';
            if(deal[LINK_ARQUIVO_FINAL_FIELD]) linksHtml += `<a href="${deal[LINK_ARQUIVO_FINAL_FIELD]}" target="_blank" class="btn-acao-modal principal"><i class="fas fa-download"></i> Baixar Arquivo</a>`;
            if(deal[LINK_ATENDIMENTO_FIELD]) linksHtml += `<a href="${deal[LINK_ATENDIMENTO_FIELD]}" target="_blank" class="btn-acao-modal secundario"><i class="fab fa-whatsapp"></i> Ver Atendimento</a>`;

            modalBody.innerHTML = `
                <div class="detalhe-layout">
                    <!-- ÁREA DA IMAGEM (ESQUERDA) -->
                    <div class="detalhe-col-principal">
                       ${imageHtml}
                    </div>

                    <!-- ÁREA DE AÇÃO (DIREITA) -->
                    <div class="detalhe-col-lateral">
                        
                        <!-- BOTÃO DE CONCLUIR (DESTAQUE) -->
                        <button id="btn-concluir-action" class="btn-concluir">
                            <i class="fas fa-check-circle"></i> Instalação Realizada
                        </button>

                        <!-- DADOS DO CLIENTE -->
                        <div class="card-detalhe">
                            <h4 style="margin-top:0; border-bottom:1px solid #eee; padding-bottom:10px; color:#555;">Dados do Cliente</h4>
                            <div class="info-item"><span>Nome:</span><strong>${nomeCliente}</strong></div>
                            <div class="info-item"><span>Contato:</span><span>${contatoCliente}</span></div>
                            <div class="info-item"><span>Medidas:</span>${medidasHtml}</div>
                        </div>

                        <!-- ARQUIVOS E LINKS -->
                        <div class="card-detalhe">
                             <h4 style="margin-top:0; border-bottom:1px solid #eee; padding-bottom:10px; color:#555;">Arquivos</h4>
                            ${linksHtml || '<p style="color:#999; text-align:center; margin:0; font-size:0.9rem;">Sem outros arquivos.</p>'}
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