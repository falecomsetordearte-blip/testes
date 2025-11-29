// script.js - ATUALIZADO (Redirecionamento para Dashboard)

// ============================================================
// PARTE 1: AUTENTICAÇÃO E INICIALIZAÇÃO
// ============================================================

async function handleAuthError(response) {
    if (response.status === 401 || response.status === 403) {
        console.warn("Sessão expirada ou inválida.");
        localStorage.clear();
        window.location.href = "login.html";
        return true;
    }
    return false;
}

function showFeedback(containerId, message, isError = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.textContent = message;
    container.className = `form-feedback ${isError ? 'error' : 'success'}`;
    container.style.display = 'block'; 
    container.classList.remove('hidden');
    if (!isError) container.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideFeedback(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.classList.add('hidden');
        container.style.display = 'none';
        container.textContent = '';
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initializeAuthPages();
    // Inicia lógica protegida se houver grid de layout OU lista de pedidos antiga
    if (document.getElementById('pedidos-list-body') || document.querySelector(".app-layout-grid")) {
        initializeProtectedPage();
    }
});

function initializeAuthPages() {
    // --- LOGIN ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const submitButton = loginForm.querySelector('button[type="submit"]');
            const feedbackId = 'form-error-feedback';
            submitButton.disabled = true;
            submitButton.textContent = 'Entrando...';
            hideFeedback(feedbackId);

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
                if (!response.ok) throw new Error(data.message || 'Erro ao fazer login.');
                
                localStorage.setItem('sessionToken', data.token);
                localStorage.setItem('userName', data.userName);
                
                // >>> ALTERAÇÃO AQUI: Redireciona para Dashboard (Visão Geral)
                window.location.href = 'dashboard.html'; 
            } catch (error) {
                showFeedback(feedbackId, error.message, true);
                submitButton.disabled = false;
                submitButton.textContent = 'Entrar';
            }
        });
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('verified') === 'true') showFeedback('form-error-feedback', 'E-mail verificado com sucesso! Você já pode fazer o login.', false);
        if (urlParams.get('reset') === 'success') showFeedback('form-error-feedback', 'Senha redefinida com sucesso! Faça login com a nova senha.', false);
    }

    // --- CADASTRO ---
    const cadastroForm = document.getElementById('cadastro-form');
    if (cadastroForm) {
        cadastroForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formWrapper = document.getElementById('form-wrapper');
            const loadingFeedback = document.getElementById('loading-feedback');
            const submitButton = cadastroForm.querySelector('button[type="submit"]');
            const feedbackId = 'form-error-feedback';
            const senha = document.getElementById('senha').value;
            const confirmarSenha = document.getElementById('confirmar-senha').value;
            const aceiteTermos = document.getElementById('termos-aceite').checked;

            hideFeedback(feedbackId);
            if (!aceiteTermos) return showFeedback(feedbackId, 'Você precisa aceitar os Termos para continuar.', true);
            if (senha.length < 6) return showFeedback(feedbackId, 'Sua senha precisa ter no mínimo 6 caracteres.', true);
            if (senha !== confirmarSenha) return showFeedback(feedbackId, 'As senhas não coincidem.', true);

            submitButton.disabled = true;
            submitButton.textContent = "Processando...";

            const fileInput = document.getElementById('logo_arquivo');
            let fileData = null;
            const convertBase64 = (file) => {
                return new Promise((resolve, reject) => {
                    const fileReader = new FileReader();
                    fileReader.readAsDataURL(file);
                    fileReader.onload = () => resolve(fileReader.result);
                    fileReader.onerror = (error) => reject(error);
                });
            };

            try {
                if (fileInput && fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    if (file.size > 5 * 1024 * 1024) throw new Error("O logo deve ter no máximo 5MB.");
                    const base64 = await convertBase64(file);
                    fileData = { name: file.name, base64: base64 };
                }

                if (formWrapper) formWrapper.classList.add('hidden');
                if (loadingFeedback) loadingFeedback.classList.remove('hidden');

                const empresaData = {
                    nomeEmpresa: document.getElementById('nome_empresa').value,
                    cnpj: document.getElementById('cnpj').value,
                    telefoneEmpresa: document.getElementById('telefone_empresa').value,
                    nomeResponsavel: document.getElementById('nome_responsavel').value,
                    email: document.getElementById('email').value,
                    senha: senha,
                    logo: fileData
                };

                const response = await fetch('/api/registerUser', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(empresaData)
                });
                
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Erro no cadastro.');

                localStorage.setItem('sessionToken', data.token);
                localStorage.setItem('userName', data.userName);
                
                // >>> ALTERAÇÃO AQUI: Redireciona para Dashboard
                window.location.href = 'dashboard.html';

            } catch (error) {
                if (loadingFeedback) loadingFeedback.classList.add('hidden');
                if (formWrapper) formWrapper.classList.remove('hidden');
                showFeedback(feedbackId, error.message, true);
                submitButton.disabled = false;
                submitButton.textContent = "Criar Conta e Acessar";
            }
        });
    }

    // --- ESQUECI / REDEFINIR SENHA / VERIFICAR EMAIL (Mantidos iguais) ---
    const esqueciSenhaForm = document.getElementById('esqueci-senha-form');
    if (esqueciSenhaForm) {
        esqueciSenhaForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const btn = event.target.querySelector('button');
            const wrapper = document.getElementById('form-wrapper');
            btn.disabled = true; btn.textContent = 'Enviando...';
            try {
                const response = await fetch('/api/forgotPassword', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: document.getElementById('email').value })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                wrapper.innerHTML = `<div class="auth-header"><h1>Link Enviado!</h1><p>${data.message}</p></div>`;
            } catch (error) {
                wrapper.innerHTML = `<div class="auth-header"><h1>Erro</h1><p>${error.message}</p> <a href="esqueci-senha.html">Tentar novamente</a></div>`;
            }
        });
    }

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
            submitButton.disabled = true; submitButton.textContent = 'Salvando...';
            const token = new URLSearchParams(window.location.search).get('token');
            try {
                const response = await fetch('/api/resetPassword', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: token, novaSenha: novaSenha })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                window.location.href = `login.html?reset=success`;
            } catch (error) {
                showFeedback('form-error-feedback', error.message, true);
                submitButton.disabled = false; submitButton.textContent = 'Redefinir Senha';
            }
        });
    }

    const feedbackText = document.getElementById('feedback-text');
    if (feedbackText) {
        const token = new URLSearchParams(window.location.search).get('token');
        (async () => {
            if (!token) return;
            feedbackText.textContent = 'Verificando validação...';
            try {
                const response = await fetch('/api/verifyEmail', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: token })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                window.location.href = 'login.html?verified=true';
            } catch (error) {
                feedbackText.textContent = `Erro: ${error.message || 'Link inválido.'}`;
            }
        })();
    }
}

// ============================================================
// PARTE 2: FUNÇÕES PROTEGIDAS (Sidebar, Notificações)
// ============================================================

function initializeProtectedPage() {
    const sessionToken = localStorage.getItem("sessionToken");
    const userName = localStorage.getItem("userName");

    if (!sessionToken) { window.location.href = "login.html"; return; }

    const greetingEl = document.getElementById('user-greeting');
    if(greetingEl && userName) greetingEl.textContent = `Olá, ${userName}!`;

    const logoutButton = document.getElementById('logout-button');
    if(logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.clear();
            window.location.href = 'login.html';
        });
    }

    carregarLogoUsuario(sessionToken);
    setupNotifications();

    // Lógica antiga do Painel (Tabela) só roda se o elemento existir
    // Como removemos 'pedidos-list-body' do novo painel.html, isso será ignorado lá.
    if (document.getElementById('pedidos-list-body')) {
        inicializarPainelDePedidos();
    }
}

async function carregarLogoUsuario(token) {
    const cachedLogo = localStorage.getItem('userLogo');
    const sidebarLogo = document.querySelector('.sidebar-logo');
    if (cachedLogo && sidebarLogo) sidebarLogo.src = cachedLogo;

    try {
        const response = await fetch('/api/getUserData', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token })
        });
        if (response.ok) {
            const data = await response.json();
            if (data.logo_url) {
                if (sidebarLogo) sidebarLogo.src = data.logo_url;
                localStorage.setItem('userLogo', data.logo_url);
            }
        }
    } catch (error) { console.error("Erro ao carregar logo:", error); }
}

function setupNotifications() {
    const btnBell = document.getElementById('btn-notificacoes');
    const dropdown = document.getElementById('notif-dropdown');
    const badge = document.getElementById('notif-badge');
    const list = document.getElementById('notif-list');

    if (!btnBell || !dropdown) return;

    async function loadNotifs() {
        try {
            const res = await fetch('/api/getGlobalNotifications');
            if (!res.ok) return; 
            const notifications = await res.json();
            if (!notifications || notifications.length === 0) {
                list.innerHTML = '<div style="padding:15px; text-align:center; font-size:0.85rem; color:#94a3b8;">Nenhuma notificação no momento.</div>';
                return;
            }
            const lastSeenId = localStorage.getItem('lastSeenNotifId') || 0;
            const newestId = notifications[0].id;
            if (newestId > lastSeenId) badge.classList.add('active');
            else badge.classList.remove('active');

            list.innerHTML = notifications.map(n => `
                <div class="notif-item ${n.tipo || 'info'}">
                    <h4>${n.titulo}</h4>
                    <p>${n.mensagem}</p>
                    <span class="notif-date">${new Date(n.criado_em).toLocaleDateString('pt-BR')}</span>
                </div>
            `).join('');
            btnBell.dataset.newestId = newestId;
        } catch (err) { console.error("Erro notificações:", err); }
    }

    btnBell.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
        if (dropdown.classList.contains('active')) {
            badge.classList.remove('active');
            if (btnBell.dataset.newestId) localStorage.setItem('lastSeenNotifId', btnBell.dataset.newestId);
        }
    });

    window.addEventListener('click', (e) => {
        if (!e.target.closest('.notification-wrapper')) dropdown.classList.remove('active');
    });
    loadNotifs();
}

// ============================================================
// PARTE 3: LÓGICA DO DASHBOARD (Mantida para compatibilidade)
// ============================================================
// Esta parte será ignorada no novo painel.html pois não encontrará os IDs
let todosPedidos = [];
let pedidosFiltrados = [];
let paginaAtual = 1;
const itensPorPagina = 20;
let currentStatusFilter = 'todos';

function inicializarPainelDePedidos() {
    setupModalCreditos();
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

async function atualizarDadosPainel() {
    const sessionToken = localStorage.getItem("sessionToken");
    const pedidosListBody = document.getElementById("pedidos-list-body");
    const saldoValorEl = document.getElementById("saldo-valor");
    if(pedidosListBody) pedidosListBody.innerHTML = `<div class="loading-pedidos"><div class="spinner"></div><span>Atualizando informações...</span></div>`;

    try {
        const response = await fetch('/api/getPanelData', {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: sessionToken })
        });
        if (!response.ok) {
            if (await handleAuthError(response)) return;
            throw new Error("Erro ao buscar dados.");
        }
        const data = await response.json();
        if(saldoValorEl) saldoValorEl.textContent = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data.saldo || 0);
        todosPedidos = data.pedidos || [];
        aplicarFiltros(); 
    } catch (error) { console.error("Erro no painel:", error); }
}

function aplicarFiltros() {
    const searchInput = document.getElementById("search-input");
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
    let listaTemp = todosPedidos;
    if (currentStatusFilter !== 'todos') {
        listaTemp = listaTemp.filter(pedido => {
            const stageId = (pedido.STAGE_ID || "").toUpperCase();
            if (currentStatusFilter === 'pagamento') return stageId.includes("NEW");
            if (currentStatusFilter === 'cancelado') return stageId.includes("LOSE");
            if (currentStatusFilter === 'andamento') return !stageId.includes("NEW") && !stageId.includes("LOSE") && !stageId.includes("WON");
            return true;
        });
    }
    if (searchTerm) {
        listaTemp = listaTemp.filter(p => (p.TITLE || "").toLowerCase().includes(searchTerm) || (p.ID || "").toString().includes(searchTerm));
    }
    pedidosFiltrados = listaTemp;
    paginaAtual = 1;
    renderizarPedidos();
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
            let acaoHtml = "";
            const stageId = (pedido.STAGE_ID || "").toUpperCase();
            const id = pedido.ID;
            if (stageId.includes("NEW")) {
                statusInfo = { texto: 'Aguardando Pagamento', classe: 'status-pagamento' };
                acaoHtml = `<div class="dropdown-pagamento"><button type="button" class="btn-pagar" data-deal-id="${id}">Pagar <i class="fas fa-caret-down"></i></button><div class="dropdown-content"><button type="button" class="btn-pagar-saldo" data-deal-id="${id}">💰 Usar Saldo</button><button type="button" class="btn-gerar-cobranca" data-deal-id="${id}">💠 Gerar PIX</button></div></div>`;
            } else if (stageId.includes("LOSE")) {
                statusInfo = { texto: 'Cancelado', classe: 'status-cancelado' };
                acaoHtml = `<a href="pedido.html?id=${id}" class="btn-ver-pedido">Ver Motivo</a>`;
            } else if (stageId === "C17:UC_2OEE24") {
                statusInfo = { texto: 'Em Análise', classe: 'status-analise' };
                acaoHtml = `<a href="pedido.html?id=${id}" class="btn-ver-pedido">Ver Detalhes</a>`;
            } else if (stageId.includes("WON") || stageId === "C17:WON") {
                statusInfo = { texto: "Concluído", classe: "status-aprovado" };
                acaoHtml = `<a href="pedido.html?id=${id}" class="btn-ver-pedido">Ver Arquivos</a>`;
            } else {
                statusInfo = { texto: 'Em Andamento', classe: 'status-andamento' };
                acaoHtml = `<a href="pedido.html?id=${id}" class="btn-ver-pedido">Acompanhar</a>`;
            }
            const valorFormatado = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(pedido.OPPORTUNITY) || 0);
            html += `<div class="pedido-item"><div class="col-id"><strong>#${id}</strong></div><div class="col-titulo">${pedido.TITLE}</div><div class="col-status"><span class="status-badge ${statusInfo.classe}">${statusInfo.texto}</span></div><div class="col-valor">${valorFormatado}</div><div class="col-acoes" style="overflow: visible;">${acaoHtml}</div></div>`;
        });
        pedidosListBody.innerHTML = html;
    } else {
        pedidosListBody.innerHTML = `<div class="loading-pedidos" style="padding: 30px;">Nenhum pedido encontrado.</div>`;
    }
}

function ativarDropdownsDePagamento() {
    const pedidosListBody = document.getElementById('pedidos-list-body');
    if (!pedidosListBody) return;
    pedidosListBody.addEventListener('click', async function(event) {
        const target = event.target;
        const btnPagar = target.closest('.btn-pagar');
        if (btnPagar) {
            const dropdown = btnPagar.closest('.dropdown-pagamento');
            document.querySelectorAll('.dropdown-pagamento.active').forEach(d => { if(d !== dropdown) d.classList.remove('active'); });
            if(dropdown) dropdown.classList.toggle('active');
            event.stopPropagation(); 
            return;
        }
        if (target.classList.contains('btn-pagar-saldo')) {
            if (!confirm('Pagar com saldo?')) return;
            try {
                await fetch('/api/payWithBalance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), dealId: target.dataset.dealId }) });
                alert('Sucesso!'); atualizarDadosPainel();
            } catch (error) { alert(`Erro: ${error.message}`); }
        }
        if (target.classList.contains('btn-gerar-cobranca')) {
            try {
                const res = await fetch('/api/generatePixForDeal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), dealId: target.dataset.dealId }) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                window.open(data.url, '_blank');
            } catch (error) { alert(`Erro: ${error.message}`); }
        }
    });
    window.addEventListener('click', function(event) {
        if (!event.target.closest('.dropdown-pagamento')) document.querySelectorAll('.dropdown-pagamento.active').forEach(d => d.classList.remove('active'));
    });
}

function setupModalCreditos() {
    const modal = document.getElementById("modal-adquirir-creditos");
    const btnOpen = document.querySelector(".btn-add-credito");
    const form = document.getElementById("adquirir-creditos-form");
    if (!modal || !btnOpen) return;
    const btnClose = modal.querySelector(".close-modal");
    btnOpen.addEventListener("click", (e) => { e.preventDefault(); modal.classList.add("active"); });
    if(btnClose) btnClose.addEventListener("click", () => modal.classList.remove("active"));
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("active"); });
    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const btn = form.querySelector("button[type='submit']");
            const valor = document.getElementById("creditos-valor").value;
            if (!valor || parseFloat(valor) < 5) return showFeedback("creditos-form-error", "Mínimo R$ 5,00.", true);
            btn.disabled = true; btn.textContent = "Gerando...";
            try {
                const res = await fetch('/api/addCredit', { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: localStorage.getItem("sessionToken"), valor: valor }) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                window.open(data.url, '_blank'); modal.classList.remove("active"); form.reset();
            } catch (error) { showFeedback("creditos-form-error", error.message, true); } 
            finally { btn.disabled = false; btn.textContent = "Gerar Cobrança"; }
        });
    }
}