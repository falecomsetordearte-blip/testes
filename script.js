// /script.js - VERSÃO ATUALIZADA (FLUXO GRATUITO)

async function handleAuthError(response) {
    if (response.status === 401 || response.status === 403) {
        localStorage.clear();
        window.location.href = "login.html";
        return true;
    }
    return false;
}

function detectingSessionError(error) {
    const message = error.message || error.toString();
    const patterns = [
        'Unexpected token',
        'is not valid JSON',
        'Você entrou',
        'message\': Você',
        'SyntaxError'
    ];
    return patterns.some(p => message.includes(p));
}

function showFeedback(containerId, message, isError = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.textContent = message;
    container.className = `form-feedback ${isError ? 'error' : 'success'}`;
    container.classList.remove('hidden');
    // Se for sucesso, scrolla para ver a mensagem
    if (!isError) container.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideFeedback(containerId) {
    const container = document.getElementById(containerId);
    if (container) container.classList.add('hidden');
}

document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname;
    
    // Verifica se é página de autenticação
    const isAuthPage = ['/', '/index.html', '/login.html', '/esqueci-senha.html', '/redefinir-senha.html', '/cadastro.html', '/verificacao.html'].some(p => path.endsWith(p));

    if (isAuthPage) {
        initializeAuthPages();
    } else {
        // Assume que qualquer outra página precisa de proteção (Dashboard, Pedido, etc)
        initializeProtectedPage();
    }
});

function initializeAuthPages() {
    const path = window.location.pathname;

    // ============================================================
    // LOGIN
    // ============================================================
    if (path.endsWith('/login.html') || path.endsWith('/index.html') || path === '/') {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const submitButton = loginForm.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                submitButton.textContent = 'Entrando...';
                try {
                    const response = await fetch('/api/loginUser', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: document.getElementById('email').value,
                            senha: document.getElementById('senha').value
                        })
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message || 'Erro desconhecido.');
                    
                    localStorage.setItem('sessionToken', data.token);
                    localStorage.setItem('userName', data.userName);
                    window.location.href = 'dashboard.html';
                } catch (error) {
                    showFeedback('form-error-feedback', error.message, true);
                    submitButton.disabled = false;
                    submitButton.textContent = 'Entrar';
                }
            });
        }
        // Mensagens de URL (Reset de senha ou verificação)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('verified') === 'true') {
            showFeedback('form-error-feedback', 'E-mail verificado com sucesso! Você já pode fazer o login.', false);
        }
        if (urlParams.get('reset') === 'success') {
             showFeedback('form-error-feedback', 'Senha redefinida com sucesso! Faça login com a nova senha.', false);
        }
    }

    // ============================================================
    // CADASTRO (ATUALIZADO PARA FLUXO DIRETO)
    // ============================================================
    if (path.endsWith('/cadastro.html')) {
        const cadastroForm = document.getElementById('cadastro-form');
        if (cadastroForm) {
            cadastroForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                
                const formWrapper = document.getElementById('form-wrapper');
                const loadingFeedback = document.getElementById('loading-feedback');
                const submitButton = cadastroForm.querySelector('button[type="submit"]');
                
                const senha = document.getElementById('senha').value;
                const confirmarSenha = document.getElementById('confirmar-senha').value;
                const aceiteTermos = document.getElementById('termos-aceite').checked;

                hideFeedback('form-error-feedback');

                // Validações Front-end
                if (!aceiteTermos) return showFeedback('form-error-feedback', 'Você precisa aceitar os Termos para continuar.', true);
                if (senha.length < 6) return showFeedback('form-error-feedback', 'Sua senha precisa ter no mínimo 6 caracteres.', true);
                if (senha !== confirmarSenha) return showFeedback('form-error-feedback', 'As senhas não coincidem.', true);

                // UI Loading
                submitButton.disabled = true;
                if (formWrapper) formWrapper.classList.add('hidden');
                if (loadingFeedback) loadingFeedback.classList.remove('hidden');

                const empresaData = {
                    nomeEmpresa: document.getElementById('nome_empresa').value,
                    cnpj: document.getElementById('cnpj').value,
                    telefoneEmpresa: document.getElementById('telefone_empresa').value,
                    nomeResponsavel: document.getElementById('nome_responsavel').value,
                    email: document.getElementById('email').value,
                    senha: senha
                };

                try {
                    const response = await fetch('/api/registerUser', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(empresaData)
                    });
                    
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message || 'Ocorreu um erro desconhecido.');

                    // SUCESSO: Login Automático
                    localStorage.setItem('sessionToken', data.token);
                    localStorage.setItem('userName', data.userName);
                    
                    // Redireciona direto para o Dashboard
                    window.location.href = 'dashboard.html';

                } catch (error) {
                    // ERRO: Volta a mostrar o formulário
                    if (loadingFeedback) loadingFeedback.classList.add('hidden');
                    if (formWrapper) formWrapper.classList.remove('hidden');
                    
                    showFeedback('form-error-feedback', error.message, true);
                    submitButton.disabled = false;
                }
            });
        }
    }

    // ============================================================
    // ESQUECI MINHA SENHA
    // ============================================================
    if (path.endsWith('/esqueci-senha.html')) {
        const esqueciSenhaForm = document.getElementById('esqueci-senha-form');
        if (esqueciSenhaForm) {
            const formWrapper = document.getElementById('form-wrapper');
            esqueciSenhaForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const btn = event.target.querySelector('button');
                btn.disabled = true;
                btn.textContent = 'Enviando...';
                try {
                    const response = await fetch('/api/forgotPassword', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: document.getElementById('email').value })
                    });
                    const data = await response.json();
                    if (!response.ok) { throw new Error(data.message); }
                    formWrapper.innerHTML = `<div class="auth-header"><img src="https://setordearte.com.br/images/logo-redonda.svg" alt="Logo"><h1>Link Enviado!</h1><p>${data.message || 'Verifique seu e-mail.'}</p></div>`;
                } catch (error) {
                    formWrapper.innerHTML = `<div class="auth-header"><h1>Erro</h1><p>${error.message}</p> <a href="esqueci-senha.html">Tentar novamente</a></div>`;
                }
            });
        }
    }

    // ============================================================
    // REDEFINIR SENHA
    // ============================================================
    if (path.endsWith('/redefinir-senha.html')) {
        const redefinirSenhaForm = document.getElementById('redefinir-senha-form');
        if (redefinirSenhaForm) {
            redefinirSenhaForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const novaSenha = document.getElementById('nova-senha').value;
                const confirmarSenha = document.getElementById('confirmar-senha').value;
                const submitButton = redefinirSenhaForm.querySelector('button[type="submit"]');
                hideFeedback('form-error-feedback');
                
                if (novaSenha.length < 6) return showFeedback('form-error-feedback', 'Mínimo 6 caracteres.', true);
                if (novaSenha !== confirmarSenha) return showFeedback('form-error-feedback', 'As senhas não coincidem.', true);
                
                submitButton.disabled = true;
                submitButton.textContent = 'Salvando...';
                const token = new URLSearchParams(window.location.search).get('token');
                
                try {
                    const response = await fetch('/api/resetPassword', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token: token, novaSenha: novaSenha })
                    });
                    const data = await response.json();
                    if (!response.ok) { throw new Error(data.message); }
                    window.location.href = `login.html?reset=success`;
                } catch (error) {
                    showFeedback('form-error-feedback', error.message, true);
                    submitButton.disabled = false;
                    submitButton.textContent = 'Redefinir Senha';
                }
            });
        }
    }
}

// ============================================================
// FUNÇÕES DE PÁGINAS PROTEGIDAS (DASHBOARD)
// ============================================================

function initializeProtectedPage() {
    const sessionToken = localStorage.getItem("sessionToken");
    const userName = localStorage.getItem("userName");

    if (!sessionToken || !userName) {
        localStorage.clear();
        window.location.href = "login.html";
        return;
    }

    // Exibe nome do usuário
    const greetingEl = document.getElementById('user-greeting');
    if(greetingEl) greetingEl.textContent = `Olá, ${userName}!`;
    
    // Logout
    const logoutButton = document.getElementById('logout-button');
    if(logoutButton) logoutButton.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });

    // Se estiver no Dashboard (tem lista de pedidos), carrega os dados
    if (document.getElementById('pedidos-list-body')) {
        inicializarPainelDePedidos();
    }
}

let todosPedidos = [];
let paginaAtual = 1;
const itensPorPagina = 20;
let pedidosFiltrados = [];
let currentStatusFilter = 'todos';

async function atualizarDadosPainel() {
    const sessionToken = localStorage.getItem("sessionToken");
    const pedidosListBody = document.getElementById("pedidos-list-body");
    const saldoValorEl = document.getElementById("saldo-valor");
    
    if(pedidosListBody) pedidosListBody.innerHTML = `<div class="loading-pedidos"><div class="spinner"></div><span>Carregando seus pedidos...</span></div>`;
    
    try {
        const response = await fetch('/api/getPanelData', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: sessionToken })
        });
        const data = await response.json();
        if (!response.ok) {
            if (await handleAuthError(response)) return;
            throw new Error(data.message || "Erro ao buscar dados.");
        }
        
        if(saldoValorEl) saldoValorEl.textContent = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data.saldo || 0);
        todosPedidos = data.pedidos || [];
        paginaAtual = 1;
        aplicarFiltros();
    } catch (error) {
        console.error(`Falha ao carregar dados: ${error.message}`);
        if(pedidosListBody) pedidosListBody.innerHTML = `<div class="loading-pedidos" style="color: red;">${error.message}</div>`;
    }
}

function renderizarPedidos() {
    const pedidosListBody = document.getElementById("pedidos-list-body");
    if(!pedidosListBody) return;

    pedidosListBody.innerHTML = "";
    if (pedidosFiltrados && pedidosFiltrados.length > 0) {
        const indiceInicio = (paginaAtual - 1) * itensPorPagina;
        const indiceFim = indiceInicio + itensPorPagina;
        const pedidosPagina = pedidosFiltrados.slice(indiceInicio, indiceFim);
        let html = "";
        
        pedidosPagina.forEach(pedido => {
            let statusInfo = { texto: "Desconhecido", classe: "" };
            let notificacaoHtml = pedido.notificacao ? '<span class="notificacao-badge">●</span>' : '';
            let acaoHtml = `<a href="pedido.html?id=${pedido.ID}" class="btn-ver-pedido">Ver Detalhes ${notificacaoHtml}</a>`;
            
            const stageId = pedido.STAGE_ID || "";

            // Lógica de Status (Personalize conforme seus Stages do Bitrix)
            if (stageId.includes("NEW")) {
                statusInfo = { texto: 'Aguardando Pagamento', classe: 'status-pagamento' };
                acaoHtml = `<div class="dropdown-pagamento"><button class="btn-pagar" data-deal-id="${pedido.ID}">Pagar</button><div class="dropdown-content"><button class="btn-pagar-saldo" data-deal-id="${pedido.ID}">Usar Saldo</button><button class="btn-gerar-cobranca" data-deal-id="${pedido.ID}">PIX</button></div></div>`;
            } else if (stageId.includes("LOSE")) {
                statusInfo = { texto: 'Cancelado', classe: 'status-cancelado' };
            } else if (stageId === "C17:UC_2OEE24") {
                statusInfo = { texto: 'Em Análise', classe: 'status-analise' };
            } else if ((stageId.includes("WON") && stageId !== "C17:WON") || stageId === "C17:1") {
                statusInfo = { texto: "Aprovado", classe: "status-aprovado" };
            } else if (stageId === "C17:WON" || stageId.includes("C19")) {
                statusInfo = { texto: "Verificado", classe: "status-verificado" };
            } else {
                statusInfo = { texto: 'Em Andamento', classe: 'status-andamento' };
            }
            
            const valorFormatado = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(pedido.OPPORTUNITY) || 0);
            
            html += `
                <div class="pedido-item">
                    <div class="col-id"><strong>#${pedido.ID}</strong></div>
                    <div class="col-titulo">${pedido.TITLE}</div>
                    <div class="col-status"><span class="status-badge ${statusInfo.classe}">${statusInfo.texto}</span></div>
                    <div class="col-valor">${valorFormatado}</div>
                    <div class="col-acoes">${acaoHtml}</div>
                </div>
            `;
        });
        pedidosListBody.innerHTML = html;
    } else {
        pedidosListBody.innerHTML = `<div class="loading-pedidos" style="padding: 40px;">Nenhum pedido encontrado.</div>`;
    }
}

function aplicarFiltros() {
    const searchInput = document.getElementById("search-input");
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
    
    let pedidosTemporarios = todosPedidos;

    if (currentStatusFilter !== 'todos') {
        pedidosTemporarios = pedidosTemporarios.filter(pedido => {
            const stageId = pedido.STAGE_ID || "";
            if (currentStatusFilter === 'pagamento') return stageId.includes("NEW");
            if (currentStatusFilter === 'andamento') return !stageId.includes("NEW") && !stageId.includes("LOSE") && !stageId.includes("WON");
            if (currentStatusFilter === 'cancelado') return stageId.includes("LOSE");
            return true;
        });
    }

    if (searchTerm) {
        pedidosTemporarios = pedidosTemporarios.filter(p => 
            (p.TITLE || "").toLowerCase().includes(searchTerm) || 
            (p.ID || "").toString().includes(searchTerm)
        );
    }

    pedidosFiltrados = pedidosTemporarios;
    paginaAtual = 1;
    renderizarPedidos();
}

function ativarDropdownsDePagamento() {
    const pedidosListBody = document.getElementById('pedidos-list-body');
    if (!pedidosListBody) return;
    
    pedidosListBody.addEventListener('click', async function(event) {
        const target = event.target;
        const dropdown = target.closest('.dropdown-pagamento');
        
        // Botão Principal "Pagar" (Abre menu)
        if (target.classList.contains('btn-pagar')) {
            document.querySelectorAll('.dropdown-pagamento.active').forEach(d => d !== dropdown && d.classList.remove('active'));
            if(dropdown) dropdown.classList.toggle('active');
            return;
        }
        
        // Botão "Usar Saldo"
        if (target.classList.contains('btn-pagar-saldo')) {
            const dealId = target.dataset.dealId;
            if (!confirm('Tem certeza que deseja usar seu saldo para pagar este pedido?')) return;
            target.disabled = true;
            target.textContent = '...';
            try {
                const response = await fetch('/api/payWithBalance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), dealId: dealId })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                alert('Pedido pago com sucesso!');
                await atualizarDadosPainel();
            } catch (error) {
                alert(`Erro: ${error.message}`);
                target.disabled = false;
                target.textContent = 'Usar Saldo';
            }
        }

        // Botão "PIX"
        if (target.classList.contains('btn-gerar-cobranca')) {
            const dealId = target.dataset.dealId;
            target.disabled = true;
            target.textContent = '...';
            try {
                const response = await fetch('/api/generatePixForDeal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), dealId: dealId })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                window.open(data.url, '_blank');
                if(dropdown) dropdown.classList.remove('active');
            } catch (error) {
                alert(`Erro: ${error.message}`);
            } finally {
                target.disabled = false;
                target.textContent = 'PIX';
            }
        }
    });

    // Fecha dropdown ao clicar fora
    window.addEventListener('click', function(event) {
        if (!event.target.closest('.dropdown-pagamento')) {
            document.querySelectorAll('.dropdown-pagamento.active').forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        }
    });
}

function injectStyles() {
    if (document.getElementById('dynamic-styles')) return;
    const styles = document.createElement('style');
    styles.id = 'dynamic-styles';
    styles.textContent = `
        .dropdown-pagamento { position: relative; display: inline-block; }
        .dropdown-pagamento .dropdown-content { display: none; position: absolute; background: #fff; min-width: 120px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); z-index: 99; border-radius: 4px; border: 1px solid #eee; top: 100%; right: 0; }
        .dropdown-pagamento.active .dropdown-content { display: block; }
        .dropdown-pagamento button { display: block; width: 100%; padding: 8px; text-align: left; border: none; background: none; cursor: pointer; font-size: 13px; }
        .dropdown-pagamento button:hover { background: #f5f5f5; }
        .loading-pedidos { padding: 20px; text-align: center; color: #666; }
        .spinner { width: 20px; height: 20px; border: 2px solid #ddd; border-top: 2px solid #333; border-radius: 50%; animation: spin 1s linear infinite; display: inline-block; margin-right: 10px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(styles);
}

function inicializarPainelDePedidos() {
    injectStyles();
    
    // Aba de Créditos
    const modalCreditos = document.getElementById("modal-adquirir-creditos");
    const btnOpenModalCreditos = document.querySelector(".btn-add-credito");
    if (modalCreditos && btnOpenModalCreditos) {
        const btnCloseModalCreditos = modalCreditos.querySelector(".close-modal");
        const formCreditos = document.getElementById("adquirir-creditos-form");
        
        btnOpenModalCreditos.addEventListener("click", () => modalCreditos.classList.add("active"));
        btnCloseModalCreditos.addEventListener("click", () => modalCreditos.classList.remove("active"));
        
        formCreditos.addEventListener('submit', async (event) => {
            event.preventDefault();
            const submitButton = formCreditos.querySelector("button[type='submit']");
            const valorInput = document.getElementById("creditos-valor");
            hideFeedback("creditos-form-error");
            
            const valor = valorInput.value;
            const sessionToken = localStorage.getItem("sessionToken");
            
            if (!valor || parseFloat(valor) < 5) return showFeedback("creditos-form-error", "Mínimo R$ 5,00.", true);
            
            submitButton.disabled = true;
            submitButton.textContent = "Gerando...";
            try {
                const response = await fetch('/api/addCredit', {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: sessionToken, valor: valor })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || "Erro desconhecido.");
                window.open(data.url, '_blank');
                modalCreditos.classList.remove("active");
                formCreditos.reset();
            } catch (error) {
                showFeedback("creditos-form-error", error.message, true);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = "Gerar Cobrança";
            }
        });
    }

    // Filtros de Abas
    const tabButtonsContainer = document.querySelector('.tab-buttons');
    if (tabButtonsContainer) {
        tabButtonsContainer.addEventListener('click', (event) => {
            const clickedButton = event.target.closest('.tab-btn');
            if (!clickedButton) return;
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            clickedButton.classList.add('active');
            currentStatusFilter = clickedButton.dataset.tab;
            aplicarFiltros();
        });
    }

    const searchInput = document.getElementById("search-input");
    if (searchInput) searchInput.addEventListener("input", aplicarFiltros);
    
    ativarDropdownsDePagamento();
    atualizarDadosPainel();
}