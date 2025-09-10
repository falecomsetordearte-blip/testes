// /script.js - VERSÃO COMPLETA E CORRIGIDA

async function handleAuthError(response) {
    if (response.status === 401 || response.status === 403) {
        localStorage.clear();
        window.location.href = "login.html";
        return true;
    }
    return false;
}

function detectarErroSessaoSubstituida(error) {
    const mensagemErro = error.message || error.toString();
    const padroesSessaoInvalida = [
        'Unexpected token',
        'is not valid JSON',
        'Você entrou',
        'message\': Você',
        'SyntaxError'
    ];
    const isErroSessao = padroesSessaoInvalida.some(padrao =>
        mensagemErro.includes(padrao)
    );
    return isErroSessao;
}

function exibirAlertaSessaoSubstituida() {
    let modal = document.getElementById('modal-sessao-substituida');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-sessao-substituida';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content sessao-substituida">
                    <div class="modal-body">
                        <h3>Sessão Expirada</h3>
                        <p>Entre novamente.</p>
                    </div>
                    <div class="modal-footer">
                        <button id="btn-ok-login" class="btn btn-primary">OK</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        if (!document.getElementById('sessao-substituida-styles')) {
            const styles = document.createElement('style');
            styles.id = 'sessao-substituida-styles';
            styles.textContent = `
                #modal-sessao-substituida .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); display: flex; justify-content: center; align-items: center; z-index: 10000; }
                #modal-sessao-substituida .modal-content.sessao-substituida { background: white; border-radius: 12px; padding: 0; max-width: 350px; width: 90%; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3); animation: slideIn 0.3s ease-out; }
                #modal-sessao-substituida .modal-body { padding: 30px 25px 20px 25px; text-align: center; }
                #modal-sessao-substituida .modal-body h3 { margin: 0 0 15px 0; color: #333; font-size: 1.3em; font-weight: 600; }
                #modal-sessao-substituida .modal-body p { margin: 0; color: #666; line-height: 1.5; }
                #modal-sessao-substituida .modal-footer { padding: 0 25px 25px 25px; text-align: center; }
                #modal-sessao-substituida .btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 30px; border-radius: 8px; font-size: 1em; font-weight: 500; cursor: pointer; transition: all 0.3s ease; min-width: 100px; }
                #modal-sessao-substituida .btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4); }
                @keyframes slideIn { from { opacity: 0; transform: translateY(-50px); } to { opacity: 1; transform: translateY(0); } }
            `;
            document.head.appendChild(styles);
        }
    }
    modal.style.display = 'block';
    const btnOk = document.getElementById('btn-ok-login');
    btnOk.onclick = () => {
        localStorage.clear();
        window.location.href = "login.html";
    };
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            localStorage.clear();
            window.location.href = "login.html";
        }
    });
}

const CRIAR_PEDIDO_WEBHOOK_URL = 'https://hook.us2.make.com/548en3dbsynv4c2e446jvcwrizl7trut';
const PAGAR_COM_SALDO_URL = 'https://hook.us2.make.com/3dtcbbrxqh1s2o8cdcjxj37iyq4bd736';
const GERAR_COBRANCA_URL = 'https://hook.us2.make.com/7ub1y8w9v23rkyd6tumh84p5l21knquv';
const ADICIONAR_CREDITOS_URL = 'https://hook.us2.make.com/5p9m8o8p6hhglqlmxkj5sc7t2ztr8yic';

function showFeedback(containerId, message, isError = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.textContent = message;
    container.className = `form-feedback ${isError ? 'error' : 'success'}`;
    container.classList.remove('hidden');
}

function hideFeedback(containerId) {
    const container = document.getElementById(containerId);
    if (container) container.classList.add('hidden');
}

function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

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
        if (!aceiteTermos) {
            return showFeedback('form-error-feedback', 'Você precisa aceitar os Termos para continuar.', true);
        }
        if (senha.length < 6) {
            return showFeedback('form-error-feedback', 'Sua senha precisa ter no mínimo 6 caracteres.', true);
        }
        if (senha !== confirmarSenha) {
            return showFeedback('form-error-feedback', 'As senhas não coincidem.', true);
        }
        submitButton.disabled = true;
        formWrapper.classList.add('hidden');
        loadingFeedback.classList.remove('hidden');
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
            if (!response.ok) {
                throw new Error(data.message || 'Ocorreu um erro desconhecido.');
            }
            
            console.log('[DEBUG] Cadastro bem-sucedido. Salvando dados e redirecionando para assinatura.html');
            
            const registrationData = {
                contactId: data.contactId,
                companyId: data.companyId,
                asaasCustomerId: data.asaasCustomerId,
                companyName: document.getElementById('nome_empresa').value,
                responsibleName: document.getElementById('nome_responsavel').value
            };
            localStorage.setItem('pendingRegistration', JSON.stringify(registrationData));

            window.location.href = 'assinatura.html';
        } catch (error) {
            loadingFeedback.classList.add('hidden');
            formWrapper.classList.remove('hidden');
            showFeedback('form-error-feedback', error.message, true);
            submitButton.disabled = false;
        }
    });
}

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
            if (!response.ok) {
                throw new Error(data.message || 'Ocorreu um erro desconhecido.');
            }
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
            formWrapper.innerHTML = `<div class="auth-header"><img src="https://setordearte.com.br/images/logo-redonda.svg" alt="Logo Setor de Arte"><h1>Link Enviado!</h1><p>${data.message || 'Se um e-mail correspondente for encontrado em nosso sistema, um link para redefinição de senha será enviado.'}</p></div>`;
        } catch (error) {
            formWrapper.innerHTML = `<div class="auth-header"><img src="https://setordearte.com.br/images/logo-redonda.svg" alt="Logo Setor de Arte"><h1>Ocorreu um Erro</h1><p>${error.message || 'Não foi possível processar a solicitação. Por favor, tente novamente mais tarde.'}</p></div>`;
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
        if (novaSenha.length < 6) {
            return showFeedback('form-error-feedback', 'Sua senha precisa ter no mínimo 6 caracteres.', true);
        }
        if (novaSenha !== confirmarSenha) {
            return showFeedback('form-error-feedback', 'As senhas não coincidem.', true);
        }
        submitButton.disabled = true;
        submitButton.textContent = 'Salvando...';
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        if (!token) {
            showFeedback('form-error-feedback', 'Token de redefinição não encontrado. Link inválido.', true);
            submitButton.disabled = false;
            submitButton.textContent = 'Salvar Nova Senha';
            return;
        }
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
            submitButton.textContent = 'Salvar Nova Senha';
        }
    });
}

if (window.location.pathname.endsWith('/verificacao.html')) {
    const feedbackText = document.getElementById('feedback-text');
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    (async () => {
        if (!token) {
            feedbackText.textContent = 'Link de verificação inválido ou incompleto.';
            return;
        }
        try {
            const response = await fetch('/api/verifyEmail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message);
            }
            window.location.href = 'login.html?verified=true';
        } catch (error) {
            feedbackText.textContent = `Erro: ${error.message || 'Não foi possível verificar seu e-mail.'}`;
        }
    })();
}

if (window.location.pathname.endsWith('/login.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        const urlParams = new URLSearchParams(window.location.search);
        const isVerified = urlParams.get('verified');
        const resetSuccess = urlParams.get('reset');
        if (isVerified === 'true') {
            showFeedback('form-error-feedback', 'E-mail verificado com sucesso! Você já pode fazer o login.', false);
        }
        if (resetSuccess === 'success') {
             showFeedback('form-error-feedback', 'Senha redefinida com sucesso! Você já pode fazer o login com a nova senha.', false);
        }
    });
}

let todosPedidos = [];
let paginaAtual = 1;
const itensPorPagina = 20;
let pedidosFiltrados = [];

async function atualizarDadosPainel() {
    const sessionToken = localStorage.getItem("sessionToken");
    const pedidosListBody = document.getElementById("pedidos-list-body");
    const saldoValorEl = document.getElementById("saldo-valor");
    if (!sessionToken) {
        localStorage.clear();
        window.location.href = "login.html";
        return;
    }
    pedidosListBody.innerHTML = `<div class="loading-pedidos"><div class="spinner"></div><span>Carregando seus pedidos...</span></div>`;
    try {
        const response = await fetch('/api/getPanelData', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: sessionToken })
        });
        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            if (detectarErroSessaoSubstituida(jsonError)) {
                exibirAlertaSessaoSubstituida();
                return;
            }
            throw jsonError;
        }
        if (!response.ok) {
            if (await handleAuthError(response)) { return; }
            throw new Error(data.message || "Erro ao buscar dados.");
        }
        if (data.statusConta && data.statusConta !== '1') {
            document.body.innerHTML = `<div class="auth-page"><div class="auth-container" style="text-align: center;"><img src="https://setordearte.com.br/images/logo-redonda.svg" alt="Logo Setor de Arte" style="height: 80px; margin-bottom: 20px;"><h1>Acesso Suspenso</h1><p style="color: var(--cinza-texto); line-height: 1.6;">Sua assinatura está com uma pendência de pagamento...</p><a href="login.html" style="display: inline-block; margin-top: 30px; color: var(--azul-principal); font-weight: 600;">Sair</a></div></div>`;
            localStorage.clear();
            return;
        }
        saldoValorEl.textContent = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data.saldo || 0);
        todosPedidos = data.pedidos || [];
        paginaAtual = 1;
        aplicarFiltros();
    } catch (error) {
        const errorMessage = `Falha ao carregar dados do painel. Causa: ${error.message}`;
        console.error(errorMessage);
        if (pedidosListBody) {
             pedidosListBody.innerHTML = `<div class="loading-pedidos" style="color: var(--erro);">${errorMessage}</div>`;
        }
    }
}

function renderizarPedidos() {
    const pedidosListBody = document.getElementById("pedidos-list-body");
    pedidosListBody.innerHTML = "";
    if (pedidosFiltrados && pedidosFiltrados.length > 0) {
        const indiceInicio = (paginaAtual - 1) * itensPorPagina;
        const indiceFim = indiceInicio + itensPorPagina;
        const pedidosPagina = pedidosFiltrados.slice(indiceInicio, indiceFim);
        let pedidosHtml = "";
        pedidosPagina.forEach(pedido => {
            let statusInfo = { texto: "Desconhecido", classe: "" };
            let notificacaoHtml = '';
            if (pedido.notificacao === true) {
                notificacaoHtml = '<span class="notificacao-badge"><i class="fa-solid fa-circle"></i></span>';
            }
            let acaoHtml = `<a href="pedido.html?id=${pedido.ID}" class="btn-ver-pedido">Ver Detalhes${notificacaoHtml}</a>`;
            const stageId = pedido.STAGE_ID || "";
            // Lógica de status completa e unificada
            if (stageId.includes("NEW")) {
                statusInfo = { texto: 'Aguardando Pagamento', classe: 'status-pagamento' };
                acaoHtml = `<div class="dropdown-pagamento"><button class="btn-pagar" data-deal-id="${pedido.ID}">Pagar Agora</button><div class="dropdown-content"><button class="btn-pagar-saldo" data-deal-id="${pedido.ID}">Usar Saldo</button><button class="btn-gerar-cobranca" data-deal-id="${pedido.ID}">PIX</button></div></div>`;
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
            pedidosHtml += `<div class="pedido-item"><div class="col-id"><strong>#${pedido.ID}</strong></div><div class="col-titulo">${pedido.TITLE}</div><div class="col-status"><span class="status-badge ${statusInfo.classe}">${statusInfo.texto}</span></div><div class="col-valor">${valorFormatado}</div><div class="col-acoes">${acaoHtml}</div></div>`;
        });
        pedidosListBody.innerHTML = pedidosHtml;
    } else {
        pedidosListBody.innerHTML = `<div class="loading-pedidos" style="padding: 50px 20px;">Nenhum pedido encontrado.</div>`;
    }
}
function ativarDropdownsDePagamento() {
    const pedidosListBody = document.getElementById('pedidos-list-body');

    pedidosListBody.addEventListener('click', async function(event) {
        const target = event.target;
        const dropdown = target.closest('.dropdown-pagamento');

        if (target.classList.contains('btn-pagar')) {
            document.querySelectorAll('.dropdown-pagamento.active').forEach(d => d !== dropdown && d.classList.remove('active'));
            dropdown.classList.toggle('active');
            return;
        }

        if (target.classList.contains('btn-pagar-saldo')) {
            const dealId = target.dataset.dealId;
            if (!confirm('Tem certeza que deseja usar seu saldo para pagar este pedido?')) return;

            target.disabled = true;
            target.textContent = 'Processando...';

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

        if (target.classList.contains('btn-gerar-cobranca')) {
            const dealId = target.dataset.dealId;
            target.disabled = true;
            target.textContent = 'Gerando...';

            try {
                const response = await fetch('/api/generatePixForDeal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), dealId: dealId })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);

                window.open(data.url, '_blank');
                dropdown.classList.remove('active');
            } catch (error) {
                alert(`Erro: ${error.message}`);
            } finally {
                target.disabled = false;
                target.textContent = 'PIX';
            }
        }
    });

    window.addEventListener('click', function(event) {
        if (!event.target.closest('.dropdown-pagamento')) {
            document.querySelectorAll('.dropdown-pagamento.active').forEach(dropdown => {
                dropdown.classList.remove('active');
            });
        }
    });
}
function aplicarFiltros() {
    const searchInput = document.getElementById("search-input");
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
    if (searchTerm) {
        pedidosFiltrados = todosPedidos.filter(pedido =>
            (pedido.TITLE || "").toLowerCase().includes(searchTerm) ||
            (pedido.ID || "").toString().includes(searchTerm)
        );
    } else {
        pedidosFiltrados = todosPedidos;
    }
    paginaAtual = 1;
    renderizarPedidos();
}

function inicializarPainel() {
    const sessionToken = localStorage.getItem("sessionToken");
    const userName = localStorage.getItem("userName");
    if (!sessionToken || !userName) {
        localStorage.clear();
        window.location.href = "login.html";
        return;
    }
    document.getElementById("user-greeting").textContent = `Olá, ${userName}!`;

    const modalNovoPedido = document.getElementById("modal-novo-pedido");
    const btnOpenModalNovoPedido = document.querySelector(".btn-novo-pedido");
    const btnCloseModalNovoPedido = modalNovoPedido.querySelector(".close-modal");
    const formNovoPedido = document.getElementById("novo-pedido-form");

    btnOpenModalNovoPedido.addEventListener("click", () => modalNovoPedido.classList.add("active"));
    btnCloseModalNovoPedido.addEventListener("click", () => modalNovoPedido.classList.remove("active"));
    
    const wppInput = document.getElementById('cliente-final-wpp');
    if (wppInput) {
        const phoneMask = IMask(wppInput, {
            mask: '(00) 00000-0000'
        });
    }

    const videoToggle = document.getElementById('video-explicativo-toggle');
    const videoContainer = document.getElementById('video-explicativo-container');
    videoToggle.addEventListener('click', (e) => {
        e.preventDefault();
        videoContainer.classList.toggle('hidden');
        if (videoContainer.classList.contains('hidden')) {
            videoToggle.textContent = 'Assistir Vídeo Explicativo';
        } else {
            videoToggle.textContent = 'Fechar Vídeo';
        }
    });

    const btnAddMaterial = document.getElementById('btn-add-material');
    const materiaisContainer = document.getElementById('materiais-container');
    
    btnAddMaterial.addEventListener('click', () => {
        const itemCount = materiaisContainer.querySelectorAll('.material-item').length;
        const newItemNumber = itemCount + 1;

        const newItemDiv = document.createElement('div');
        newItemDiv.classList.add('material-item');
        newItemDiv.innerHTML = `
            <label class="item-label">Item ${newItemNumber}</label>
            <div class="form-group">
                <label for="material-descricao-${newItemNumber}">Descreva o Material</label>
                <input type="text" id="material-descricao-${newItemNumber}" class="material-descricao" placeholder="Ex. Cartão de Visita 1000 unidades" required>
            </div>
            <div class="form-group">
                <label for="material-detalhes-${newItemNumber}">Como o cliente deseja a arte?</label>
                <textarea id="material-detalhes-${newItemNumber}" class="material-detalhes" rows="3" required></textarea>
            </div>
        `;
        materiaisContainer.appendChild(newItemDiv);
    });
    
    function resetMateriaisForm() {
        const materiaisContainer = document.getElementById('materiais-container');
        materiaisContainer.innerHTML = `
            <div class="material-item">
                <label class="item-label">Item 1</label>
                <div class="form-group">
                    <label for="material-descricao-1">Descreva o Material</label>
                    <input type="text" id="material-descricao-1" class="material-descricao" placeholder="Ex. Banner 60x100 3 unidades" required>
                </div>
                <div class="form-group">
                    <label for="material-detalhes-1">Como o cliente deseja a arte?</label>
                    <textarea id="material-detalhes-1" class="material-detalhes" rows="3" required></textarea>
                </div>
            </div>
        `;
    }

    formNovoPedido.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitButton = formNovoPedido.querySelector("button[type='submit']");
        submitButton.disabled = true;
        submitButton.textContent = "Criando...";
        hideFeedback("pedido-form-error");

        const todosOsItens = document.querySelectorAll('#materiais-container .material-item');
        let briefingFormatado = '';
        todosOsItens.forEach((item, index) => {
            const descricao = item.querySelector('.material-descricao').value;
            const detalhes = item.querySelector('.material-detalhes').value;
            
            briefingFormatado += `--- Item ${index + 1} ---\n`;
            briefingFormatado += `Material: ${descricao}\n`;
            briefingFormatado += `Detalhes da Arte: ${detalhes}\n\n`;
        });

        const formato = document.getElementById("pedido-formato").value;
        briefingFormatado += `--- Formato de Entrega ---\n${formato}`;

        const pedidoData = {
            sessionToken: localStorage.getItem("sessionToken"),
            titulo: document.getElementById("pedido-titulo").value,
            valorDesigner: document.getElementById("pedido-valor").value,
            nomeCliente: document.getElementById("cliente-final-nome").value,
            wppCliente: document.getElementById("cliente-final-wpp").value,
            briefingFormatado: briefingFormatado,
        };

        try {
            const response = await fetch('/api/createDeal', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(pedidoData)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Erro ao criar pedido.");
            }

            modalNovoPedido.classList.remove("active");
            formNovoPedido.reset();
            resetMateriaisForm();
            await atualizarDadosPainel();

        } catch (error) {
            showFeedback("pedido-form-error", error.message, true);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Criar Pedido";
        }
    });
    
    const modalCreditos = document.getElementById("modal-adquirir-creditos");
    const btnOpenModalCreditos = document.querySelector(".btn-add-credito");
    const btnCloseModalCreditos = modalCreditos.querySelector(".close-modal");
    const formCreditos = document.getElementById("adquirir-creditos-form");

    if (btnOpenModalCreditos) {
        btnOpenModalCreditos.addEventListener("click", () => modalCreditos.classList.add("active"));
    }
    
    btnCloseModalCreditos.addEventListener("click", () => modalCreditos.classList.remove("active"));

    formCreditos.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitButton = formCreditos.querySelector("button[type='submit']");
        const valorInput = document.getElementById("creditos-valor");
        hideFeedback("creditos-form-error");

        const valor = valorInput.value;
        const sessionToken = localStorage.getItem("sessionToken");

        if (!valor || parseFloat(valor) < 5) {
            showFeedback("creditos-form-error", "Por favor, insira um valor de no mínimo R$ 5,00.", true);
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "Gerando...";

        try {
            const response = await fetch('/api/addCredit', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: sessionToken, valor: valor })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Erro desconhecido ao gerar cobrança.");
            }

            window.open(data.url, '_blank');
            modalCreditos.classList.remove("active");
            formCreditos.reset();
            alert("Sua cobrança foi gerada! Conclua o pagamento na nova aba que foi aberta.");

        } catch (error) {
            showFeedback("creditos-form-error", error.message, true);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Gerar Cobrança";
        }
    });

    document.getElementById("logout-button").addEventListener("click", () => {
        localStorage.clear();
        window.location.href = "login.html";
    });
    
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.addEventListener("input", aplicarFiltros);
    }
    ativarDropdownsDePagamento();
    atualizarDadosPainel();
}

document.addEventListener("DOMContentLoaded", () => {
    const sessionToken = localStorage.getItem("sessionToken");
    const userName = localStorage.getItem("userName");

    // Lógica de proteção genérica para todas as páginas logadas
    if (document.querySelector(".app-layout")) { // .app-layout está em todas as páginas internas
        console.log("[DEBUG] Página logada detectada.");
        console.log("[DEBUG] Verificando sessão: Token=", sessionToken, "UserName=", userName);
        
        if (!sessionToken || !userName) {
            console.error("[AUTH] Sessão inválida. Redirecionando para login.");
            localStorage.clear();
            window.location.href = "login.html";
            return;
        }
        
        // Preenche a saudação em todas as páginas logadas
        const greetingEl = document.getElementById('user-greeting');
        if(greetingEl) greetingEl.textContent = `Olá, ${userName}!`;
        
        const logoutButton = document.getElementById('logout-button');
        if(logoutButton) logoutButton.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = 'login.html';
        });
    }

    // Lógica específica para a página do painel de pedidos
    if (document.getElementById('pedidos-list-body')) {
        console.log("[DEBUG] Inicializando Painel de Pedidos...");
        inicializarPainel();
    }
});





