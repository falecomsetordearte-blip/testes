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
// LÓGICA DA PÁGINA DE "ESQUECI A SENHA"
const esqueciSenhaForm = document.getElementById('designer-esqueci-senha-form');
if (esqueciSenhaForm) {
    const formWrapper = document.getElementById('form-wrapper');
    esqueciSenhaForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const btn = event.target.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Enviando...';

        try {
            const response = await fetch('/api/designer/forgotPassword', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: document.getElementById('email').value })
            });
            const data = await response.json();
            if (!response.ok) { throw new Error(data.message); }

            // Exibe mensagem de sucesso
            formWrapper.innerHTML = `
                <div class="auth-header">
                    <img src="https://setordearte.com.br/images/logo-redonda.svg" alt="Logo Setor de Arte">
                    <h1>Link Enviado!</h1>
                    <p>${data.message || 'Se um e-mail correspondente for encontrado, um link para redefinição de senha será enviado.'}</p>
                </div>`;
        } catch (error) {
            // Exibe mensagem de erro
            formWrapper.innerHTML = `
                <div class="auth-header">
                    <img src="https://setordearte.com.br/images/logo-redonda.svg" alt="Logo Setor de Arte">
                    <h1>Ocorreu um Erro</h1>
                    <p>${error.message || 'Não foi possível processar a solicitação. Tente novamente mais tarde.'}</p>
                </div>`;
        }
    });
}

// LÓGICA DA PÁGINA DE REDEFINIR SENHA
const redefinirSenhaForm = document.getElementById('designer-redefinir-senha-form');
if (redefinirSenhaForm) {
    redefinirSenhaForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const novaSenha = document.getElementById('nova-senha').value;
        const confirmarSenha = document.getElementById('confirmar-senha').value;
        const submitButton = redefinirSenhaForm.querySelector('button[type="submit"]');
        
        if (novaSenha.length < 6) return showFeedback('form-error-feedback', 'A senha deve ter no mínimo 6 caracteres.');
        if (novaSenha !== confirmarSenha) return showFeedback('form-error-feedback', 'As senhas não coincidem.');

        submitButton.disabled = true;
        submitButton.textContent = 'Salvando...';

        const token = new URLSearchParams(window.location.search).get('token');
        
        try {
            const response = await fetch('/api/designer/resetPassword', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, novaSenha })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            
            alert('Senha redefinida com sucesso! Você já pode fazer o login.');
            window.location.href = 'login.html';
        } catch (error) {
            showFeedback('form-error-feedback', error.message);
            submitButton.disabled = false;
            submitButton.textContent = 'Salvar Nova Senha';
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
        // Busca os pedidos e o saldo em paralelo para mais eficiência
        const [dealsResponse, saldoResponse] = await Promise.all([
            fetch('/api/getDesignerDeals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: designerToken })
            }),
            fetch('/api/getDesignerSaldo', {
                method: 'GET', // Método GET conforme definido na API
                headers: { 'Authorization': `Bearer ${designerToken}` }
            })
        ]);
        
        const dealsData = await dealsResponse.json();
        const saldoData = await saldoResponse.json();

        if (!dealsResponse.ok) throw new Error(dealsData.message || 'Erro ao carregar pedidos.');
        if (!saldoResponse.ok) throw new Error(saldoData.message);

        // Renderiza os saldos
        const saldoDisponivelEl = document.getElementById('designer-saldo-disponivel');
        const saldoPendenteEl = document.getElementById('designer-saldo-pendente');
        
        if (saldoDisponivelEl) {
            saldoDisponivelEl.textContent = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(saldoData.saldo_disponivel || 0);
        }
        if (saldoPendenteEl) {
            saldoPendenteEl.textContent = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(saldoData.saldo_pendente || 0);
        }

        // Renderiza os pedidos
        renderizarPedidosDesigner(dealsData.deals);

    } catch (error) {
        console.error('Erro ao carregar painel do designer:', error);
        const container = document.getElementById('designer-pedidos-list');
        if (container) container.innerHTML = `<div class="loading-pedidos" style="color: var(--erro);">${error.message}</div>`;
    }
}
        
        // Chama a função para carregar os dados
        carregarPainelDesigner();

        // Lógica para o botão de Solicitar Saque
        const btnSaque = document.getElementById('btn-solicitar-saque');
        if (btnSaque) {
            btnSaque.addEventListener('click', async () => {
                const valor = prompt("Digite o valor que deseja sacar (ex: 50.00):");
                if (!valor || isNaN(valor) || Number(valor) <= 0) {
                    alert("Por favor, insira um valor numérico válido.");
                    return;
                }
                
                btnSaque.disabled = true;
                btnSaque.textContent = "Processando...";
                
                try {
                    const response = await fetch('/api/solicitarSaqueDesigner', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${designerToken}`,
                            'x-designer-info': designerInfoString
                        },
                        body: JSON.stringify({ valor: Number(valor) })
                    });
                    
                    const data = await response.json();
                    if (!response.ok) {
                        throw new Error(data.message);
                    }
                    
                    alert("Sua solicitação de saque foi enviada com sucesso!");
                    window.location.reload(); // Recarrega para atualizar o saldo e a lista de pedidos

                } catch (error) {
                    alert(`Erro: ${error.message}`);
                } finally {
                    btnSaque.disabled = false;
                    btnSaque.textContent = "Solicitar Saque";
                }
            });
        }

    }
}
