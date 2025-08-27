// /designer/designer-script.js

// Função para exibir feedback nos formulários
function showFeedback(containerId, message, isError = true) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.textContent = message;
    container.className = `form-feedback ${isError ? 'error' : 'success'}`;
    container.classList.remove('hidden');
}

// LÓGICA DA PÁGINA DE LOGIN
const designerLoginForm = document.getElementById('designer-login-form');
if (designerLoginForm) {
    designerLoginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitButton = designerLoginForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Entrando...';

        try {
            const response = await fetch('/api/designerLogin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: document.getElementById('email').value,
                    senha: document.getElementById('senha').value
                })
            });
            
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Erro desconhecido.');
            }
            
            // Salva o token e os dados do designer no localStorage
            localStorage.setItem('designerToken', data.token);
            localStorage.setItem('designerInfo', JSON.stringify(data.designer));
            
            window.location.href = 'painel.html';

        } catch (error) {
            showFeedback('form-error-feedback', error.message);
            submitButton.disabled = false;
            submitButton.textContent = 'Entrar';
        }
    });
}

// LÓGICA DA PÁGINA DO PAINEL
if (document.querySelector('main.main-painel')) {
    const designerToken = localStorage.getItem('designerToken');
    const designerInfoString = localStorage.getItem('designerInfo');

    // Se não houver token, volta para a página de login
    if (!designerToken || !designerInfoString) {
        localStorage.clear();
        window.location.href = 'login.html';
    } else {
        const designerInfo = JSON.parse(designerInfoString);
        
        // Exibe a saudação e configura o logout
        document.getElementById('designer-greeting').textContent = `Olá, ${designerInfo.name}!`;
        document.getElementById('logout-button').addEventListener('click', () => {
            localStorage.clear();
            window.location.href = 'login.html';
        });
        
         // --- FUNÇÕES PARA O PAINEL ---
        
        // Função para renderizar a lista de pedidos na tela
        function renderizarPedidosDesigner(deals) {
            const container = document.getElementById('designer-pedidos-list');
            if (!container) return;

            if (!deals || deals.length === 0) {
                container.innerHTML = `<div class="loading-pedidos" style="padding: 50px 20px;">Nenhum pedido atribuído a você no momento.</div>`;
                return;
            }

            let pedidosHtml = "";
            deals.forEach(deal => {
                let statusInfo = { texto: 'Desconhecido', classe: '' };
                const stageId = deal.STAGE_ID || "";

                if (stageId.includes("NEW")) statusInfo = { texto: 'Aguardando Pagamento', classe: 'status-pagamento' };
                else if (stageId.includes("LOSE")) statusInfo = { texto: 'Cancelado', classe: 'status-cancelado' };
                else if (stageId === "C17:UC_2OEE24") statusInfo = { texto: 'Em Análise', classe: 'status-analise' };
                else if ((stageId.includes("WON") && stageId !== "C17:WON") || stageId === "C17:1") statusInfo = { texto: "Aprovado", classe: "status-aprovado" };
                else if (stageId === "C17:WON" || stageId.includes("C19")) statusInfo = { texto: "Verificado", classe: "status-verificado" };
                else statusInfo = { texto: 'Em Andamento', classe: 'status-andamento' };

                // O valor em OPPORTUNITY já é a comissão do designer
                const valorFormatado = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(deal.OPPORTUNITY) || 0);
                
                pedidosHtml += `
                    <div class="pedido-item">
                        <div class="col-id"><strong>#${deal.ID}</strong></div>
                        <div class="col-titulo">${deal.TITLE}</div>
                        <div class="col-status"><span class="status-badge ${statusInfo.classe}">${statusInfo.texto}</span></div>
                        <div class="col-valor">${valorFormatado}</div>
                    </div>
                `;
            });
            container.innerHTML = pedidosHtml;
        }

        // Função principal para carregar os dados do painel do designer
        async function carregarPainelDesigner() {
            try {
                const response = await fetch('/api/getDesignerDeals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: designerToken })
                });
                
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Erro ao carregar pedidos.');
                }

                renderizarPedidosDesigner(data.deals);

            } catch (error) {
                console.error('Erro ao carregar painel do designer:', error);
                const container = document.getElementById('designer-pedidos-list');
                if (container) container.innerHTML = `<div class="loading-pedidos" style="color: var(--erro);">${error.message}</div>`;
            }
        }
        
        // Chama a função para carregar os dados
        carregarPainelDesigner();
    }
}
    
