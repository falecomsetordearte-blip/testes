// /designer/designer-script.js - VERSÃO COMPLETA E ATUALIZADA

(function() {
    const sessionToken = localStorage.getItem('designerToken');
    const path = window.location.pathname;

    const paginasPublicas = ['login.html', 'cadastro.html', 'esqueci-senha.html', 'redefinir-senha.html'];
    const ehPaginaPublica = paginasPublicas.some(pg => path.includes(pg));

    if (!sessionToken && !ehPaginaPublica) { 
        window.location.href = 'login.html'; 
        return; 
    }

    document.addEventListener('DOMContentLoaded', () => {
        // Inicializa o Dashboard se estiver na página do painel
        if (document.querySelector('main.main-painel')) {
            carregarDashboardDesigner();
        }
        
        // Configura o botão de logout padrão do painel
        const logoutBtn = document.getElementById('logout-button');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => { 
                localStorage.clear(); 
                window.location.href = 'login.html'; 
            });
        }

        // =========================================================
        // LÓGICA DAS TELAS DE AUTENTICAÇÃO (LOGIN, CADASTRO, SENHA)
        // =========================================================

        // --- LÓGICA DE LOGIN ---
        const loginForm = document.getElementById('designer-login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const senha = document.getElementById('senha').value;
                const btnSubmit = loginForm.querySelector('button[type="submit"]');
                const feedback = document.getElementById('form-error-feedback');
                
                btnSubmit.disabled = true; 
                btnSubmit.textContent = 'Entrando...'; 
                feedback.classList.add('hidden');

                try {
                    const res = await fetch('/api/designer/login', {
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, senha })
                    });
                    
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message || 'Erro ao fazer login.');
                    
                    // Salva a sessão e redireciona
                    localStorage.setItem('designerToken', data.token);
                    localStorage.setItem('designerInfo', JSON.stringify({ name: data.nome, nivel: data.nivel }));
                    window.location.href = 'painel.html';
                } catch (error) {
                    feedback.textContent = error.message; 
                    feedback.classList.remove('hidden');
                    btnSubmit.disabled = false; 
                    btnSubmit.textContent = 'Entrar';
                }
            });
        }

        // --- LÓGICA DE CADASTRO ---
        const cadastroForm = document.getElementById('designer-cadastro-form');
        if (cadastroForm) {
            cadastroForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const nome = document.getElementById('nome').value;
                const email = document.getElementById('email').value;
                const senha = document.getElementById('senha').value;
                const confirmarSenha = document.getElementById('confirmar-senha').value;
                
                const btnSubmit = cadastroForm.querySelector('button[type="submit"]');
                const feedback = document.getElementById('form-error-feedback');
                
                feedback.classList.add('hidden');

                if (senha !== confirmarSenha) {
                    feedback.textContent = "As senhas não coincidem.";
                    feedback.classList.remove('hidden');
                    return;
                }

                btnSubmit.disabled = true; 
                btnSubmit.textContent = 'Cadastrando...'; 

                try {
                    const res = await fetch('/api/designer/register', {
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ nome, email, senha })
                    });
                    
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message || 'Erro ao criar conta.');
                    
                    // Se a API de cadastro já retornar o token, faz o login automático
                    if (data.token) {
                        localStorage.setItem('designerToken', data.token);
                        localStorage.setItem('designerInfo', JSON.stringify({ name: data.nome, nivel: data.nivel }));
                        window.location.href = 'painel.html';
                    } else {
                        // Se não retornar token, avisa e manda pro login
                        const corpo = `<p style="color:var(--success); font-weight:600; text-align:center;">Conta criada com sucesso!</p>`;
                        window.abrirGaveta("Sucesso!", corpo, `<button onclick="window.location.href='login.html'" class="btn-full btn-primary">Fazer Login</button>`);
                    }
                } catch (error) {
                    feedback.textContent = error.message; 
                    feedback.classList.remove('hidden');
                    btnSubmit.disabled = false; 
                    btnSubmit.textContent = 'Cadastrar e Entrar';
                }
            });
        }

        // --- LÓGICA DE ESQUECI A SENHA ---
        const esqueciSenhaForm = document.getElementById('designer-esqueci-senha-form');
        if (esqueciSenhaForm) {
            esqueciSenhaForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const btnSubmit = esqueciSenhaForm.querySelector('button[type="submit"]');
                
                btnSubmit.disabled = true; 
                btnSubmit.textContent = 'Enviando link...';

                try {
                    const res = await fetch('/api/designer/forgotPassword', {
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    });
                    
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message || 'Erro ao processar solicitação.');
                    
                    // Mostra o sucesso usando a gaveta (substituindo o alert)
                    const corpo = `<p style="color:var(--success); font-weight:600; text-align:center;">${data.message}</p>`;
                    window.abrirGaveta("E-mail Enviado!", corpo, `<button onclick="window.location.href='login.html'" class="btn-full btn-primary">Voltar ao Login</button>`);
                } catch (error) {
                    window.mostrarErro(error.message);
                    btnSubmit.disabled = false; 
                    btnSubmit.textContent = 'Enviar Link de Recuperação';
                }
            });
        }

        // --- LÓGICA DE REDEFINIR A SENHA (CRIAR NOVA SENHA) ---
        const redefinirSenhaForm = document.getElementById('designer-redefinir-senha-form');
        if (redefinirSenhaForm) {
            redefinirSenhaForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const novaSenha = document.getElementById('nova-senha').value;
                const confirmarSenha = document.getElementById('confirmar-senha').value;
                const feedback = document.getElementById('form-error-feedback');
                const btnSubmit = redefinirSenhaForm.querySelector('button[type="submit"]');

                feedback.classList.add('hidden');

                if (novaSenha !== confirmarSenha) {
                    feedback.textContent = "As senhas não coincidem.";
                    feedback.classList.remove('hidden');
                    return;
                }

                // Captura o token da URL (ex: ?token=abc123xyz)
                const urlParams = new URLSearchParams(window.location.search);
                const token = urlParams.get('token');

                if (!token) {
                    feedback.textContent = "Token inválido ou ausente. Solicite um novo link.";
                    feedback.classList.remove('hidden');
                    return;
                }

                btnSubmit.disabled = true; 
                btnSubmit.textContent = 'Salvando...';

                try {
                    const res = await fetch('/api/designer/resetPassword', {
                        method: 'POST', 
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token, novaSenha })
                    });
                    
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message || 'Erro ao redefinir senha.');
                    
                    const corpo = `<p style="color:var(--success); font-weight:600; text-align:center;">${data.message}</p>`;
                    window.abrirGaveta("Senha Atualizada!", corpo, `<button onclick="window.location.href='login.html'" class="btn-full btn-primary">Ir para Login</button>`);
                } catch (error) {
                    feedback.textContent = error.message; 
                    feedback.classList.remove('hidden');
                    btnSubmit.disabled = false; 
                    btnSubmit.textContent = 'Salvar Nova Senha';
                }
            });
        }
    });

    // =========================================================
    // FUNÇÕES GLOBAIS DA GAVETA (MODAL LATERAL)
    // =========================================================
    
    window.fecharGaveta = () => {
        const overlay = document.getElementById('drawer-overlay');
        const panel = document.getElementById('drawer-panel');
        if(overlay) overlay.classList.remove('active');
        if(panel) panel.classList.remove('active');
    };

    window.abrirGaveta = (titulo, htmlCorpo, htmlRodape = '') => {
        document.getElementById('drawer-title').innerText = titulo;
        document.getElementById('drawer-content').innerHTML = htmlCorpo;
        document.getElementById('drawer-footer').innerHTML = htmlRodape;
        
        document.getElementById('drawer-overlay').classList.add('active');
        document.getElementById('drawer-panel').classList.add('active');
    };

    // FUNÇÃO PARA SUBSTITUIR O ALERT EM CASOS DE ERRO
    window.mostrarErro = (mensagem) => {
        const corpo = `<div style="color: #e11d48; background: #fff1f2; padding: 15px; border-radius: 8px; border: 1px solid #fda4af;">
            <i class="fas fa-exclamation-circle"></i> <strong>Erro:</strong> ${mensagem}
        </div>`;
        const rodape = `<button onclick="fecharGaveta()" class="btn-full btn-secondary">Entendi</button>`;
        window.abrirGaveta("Ops! Algo deu errado", corpo, rodape);
    };

    // =========================================================
    // FUNÇÕES DO DASHBOARD (PAINEL PRINCIPAL)
    // =========================================================

    async function carregarDashboardDesigner() {
        const designerInfo = JSON.parse(localStorage.getItem('designerInfo'));
        if (designerInfo) {
            document.getElementById('designer-greeting').textContent = `Olá, ${designerInfo.name}!`;
        }

        try {
            const res = await fetch('/api/designer/getDashboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: sessionToken })
            });
            const data = await res.json();
            
            if (!res.ok) {
                // Se a sessão for inválida, limpa o storage e desloga
                if (res.status === 401 || res.status === 403) {
                    localStorage.clear();
                    window.location.href = 'login.html';
                    return;
                }
                throw new Error(data.message);
            }

            // Atualiza os cards estatísticos
            document.getElementById('designer-saldo-disponivel').textContent = formatarMoeda(data.designer.saldo);
            document.getElementById('designer-saldo-pendente').textContent = formatarMoeda(data.designer.pendente);
            document.getElementById('designer-pedidos-ativos').textContent = data.meusPedidos.length;
            
            // Atualiza os contadores das abas
            document.getElementById('count-meus').textContent = data.meusPedidos.length;
            document.getElementById('count-mercado').textContent = data.mercado.length;

            // Atualiza a barra de Nível e Pontos no cabeçalho
            const badgeNivel = document.getElementById('badge-nivel');
            const niveis = { 1: { t: 'Ouro', c: 'lvl-1' }, 2: { t: 'Prata', c: 'lvl-2' }, 3: { t: 'Bronze', c: 'lvl-3' } };
            const n = niveis[data.designer.nivel] || niveis[3];
            
            if (badgeNivel) {
                badgeNivel.innerHTML = `<i class="fas fa-medal"></i> Nível ${n.t}`;
                badgeNivel.className = `stat-badge ${n.c}`;
            }
            
            const valPontos = document.getElementById('val-pontos');
            if (valPontos) {
                valPontos.textContent = data.designer.pontuacao;
            }

            // Renderiza as listas
            renderizarMeusTrabalhos(data.meusPedidos);
            renderizarMercado(data.mercado);

        } catch (error) { 
            console.error(error); 
            window.mostrarErro('Falha ao carregar os dados do painel.');
        }
    }

    function renderizarMeusTrabalhos(pedidos) {
        const container = document.getElementById('atendimentos-list');
        if (!container) return;

        if (pedidos.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:40px; color:var(--text-muted);">Nenhum atendimento ativo.</p>`;
            return;
        }
        
        container.innerHTML = pedidos.map(p => `
            <div class="list-item" style="grid-template-columns: 0.5fr 3fr 1fr 1fr 1.2fr;">
                <div style="color:var(--secondary-color);">#${p.id}</div>
                <div>
                    <div style="font-weight:600;">${p.titulo}</div>
                    <button onclick="verBriefing('${b64EncodeUnicode(p.briefing_completo || 'Sem detalhes.')}')" class="btn-outline-sm">LER BRIEFING</button>
                </div>
                <div><span style="background:#fef3c7; color:#b45309; padding:4px 10px; border-radius:12px; font-size:0.7rem; font-weight:700;">PRODUÇÃO</span></div>
                <div style="font-weight:700; color:var(--success);">${formatarMoeda(p.valor_designer)}</div>
                <div style="text-align: right; display: flex; gap: 8px; justify-content: flex-end;">
                    <a href="${p.link_acompanhar}" target="_blank" class="btn-action" style="background:#25D366;"><i class="fab fa-whatsapp"></i> Chat</a>
                    <button onclick="prepararFinalizacao(${p.id})" class="btn-action">Finalizar</button>
                </div>
            </div>
        `).join('');
    }

    function renderizarMercado(pedidos) {
        const container = document.getElementById('mercado-list'); 
        if (!container) return;

        if (pedidos.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:40px; color:var(--text-muted);">Nenhum pedido disponível no momento.</p>`;
            return;
        }
        
        container.innerHTML = pedidos.map(p => `
            <div class="list-item" style="grid-template-columns: 0.5fr 3fr 1fr 1fr;">
                <div style="color:var(--secondary-color);">#${p.id}</div>
                <div>
                    <div style="font-weight:600;">${p.titulo}</div>
                    <button onclick="verBriefing('${b64EncodeUnicode(p.briefing_completo || 'Sem detalhes.')}')" class="btn-outline-sm">LER BRIEFING</button>
                </div>
                <div style="font-weight:700; color:var(--success); font-size:1.1rem;">${formatarMoeda(p.valor_designer)}</div>
                <div style="text-align: right;">
                    <button onclick="confirmarAssumir(${p.id})" class="btn-action" style="padding:10px 20px;">ATENDER</button>
                </div>
            </div>
        `).join('');
    }

    // =========================================================
    // AÇÕES DOS BOTÕES DAS LISTAS
    // =========================================================

    window.verBriefing = (b64) => {
        const texto = decodeURIComponent(Array.prototype.map.call(atob(b64), c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        const corpo = `
            <span class="drawer-label">Instruções e Detalhes</span>
            <div class="briefing-box">${texto}</div>
        `;
        const rodape = `<button onclick="fecharGaveta()" class="btn-full btn-secondary">Fechar</button>`;
        window.abrirGaveta("Briefing do Pedido", corpo, rodape);
    };

    window.confirmarAssumir = (id) => {
        const corpo = `<p style="font-size:1rem; color:var(--text-main); line-height:1.5;">Deseja assumir o atendimento deste pedido agora? Você será responsável pela comunicação e entrega da arte.</p>`;
        const rodape = `
            <button id="btn-exec-assumir" class="btn-full btn-primary">SIM, ATENDER PEDIDO</button>
            <button onclick="fecharGaveta()" class="btn-full btn-secondary">Cancelar</button>
        `;
        window.abrirGaveta("Confirmar Atendimento", corpo, rodape);
        
        document.getElementById('btn-exec-assumir').onclick = async () => {
            const btn = document.getElementById('btn-exec-assumir');
            btn.disabled = true;
            btn.textContent = 'Aguarde...';

            try {
                const res = await fetch('/api/designer/assumirPedido', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: sessionToken, pedidoId: id })
                });
                const data = await res.json();
                
                if (!res.ok) throw new Error(data.message);
                
                fecharGaveta();
                if (data.chatLink) window.open(data.chatLink, '_blank');
                carregarDashboardDesigner();
                
            } catch (e) { 
                fecharGaveta();
                setTimeout(() => window.mostrarErro(e.message), 300);
            }
        };
    };

    window.prepararFinalizacao = (id) => {
        const corpo = `
            <span class="drawer-label">Link do Layout Aprovado (JPG/PNG)</span>
            <input type="url" id="f-layout" class="drawer-input" placeholder="Cole o link do layout aqui..." required>
            
            <span class="drawer-label">Link para Impressão (PDF/AI/CDR)</span>
            <input type="url" id="f-impressao" class="drawer-input" placeholder="Cole o link do arquivo final aqui..." required>
        `;
        const rodape = `
            <button id="btn-exec-finalizar" class="btn-full btn-primary">FINALIZAR E RECEBER</button>
            <button onclick="fecharGaveta()" class="btn-full btn-secondary">Voltar</button>
        `;
        window.abrirGaveta("Entregar Trabalho", corpo, rodape);

        document.getElementById('btn-exec-finalizar').onclick = async () => {
            const linkLayout = document.getElementById('f-layout').value.trim();
            const linkImpressao = document.getElementById('f-impressao').value.trim();
            
            if(!linkLayout || !linkImpressao) {
                alert("Por favor, preencha os dois links para finalizar.");
                return;
            }

            const btn = document.getElementById('btn-exec-finalizar');
            btn.disabled = true;
            btn.textContent = 'Enviando...';

            try {
                const res = await fetch('/api/designer/finalizarPedido', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: sessionToken, pedidoId: id, linkLayout, linkImpressao })
                });
                
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || "Não foi possível finalizar.");
                
                fecharGaveta();
                
                // Mensagem de sucesso personalizada
                setTimeout(() => {
                    const corpoSucesso = `<p style="color:var(--success); font-weight:600; font-size: 1.1rem; text-align:center;">${data.message}</p>`;
                    window.abrirGaveta("Sucesso!", corpoSucesso, `<button onclick="fecharGaveta()" class="btn-full btn-primary">Excelente!</button>`);
                    carregarDashboardDesigner();
                }, 300);

            } catch (e) { 
                fecharGaveta();
                setTimeout(() => window.mostrarErro(e.message), 300);
            }
        };
    };

    // =========================================================
    // UTILITÁRIOS
    // =========================================================

    function formatarMoeda(valor) { 
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0); 
    }
    
    // Decodifica strings em Base64 lidando com caracteres especiais/acentos do Javascript
    window.b64EncodeUnicode = (str) => {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (m, p1) => String.fromCharCode('0x' + p1)));
    };

})();