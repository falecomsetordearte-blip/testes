// /designer/designer-script.js - VERSÃO COMPLETA E ATUALIZADA

(function () {
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

                    if (data.token) {
                        localStorage.setItem('designerToken', data.token);
                        localStorage.setItem('designerInfo', JSON.stringify({ name: data.nome, nivel: data.nivel }));
                        window.location.href = 'painel.html';
                    } else {
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
        if (overlay) overlay.classList.remove('active');
        if (panel) panel.classList.remove('active');
    };

    window.abrirGaveta = (titulo, htmlCorpo, htmlRodape = '') => {
        document.getElementById('drawer-title').innerText = titulo;
        document.getElementById('drawer-content').innerHTML = htmlCorpo;
        document.getElementById('drawer-footer').innerHTML = htmlRodape;

        document.getElementById('drawer-overlay').classList.add('active');
        document.getElementById('drawer-panel').classList.add('active');
    };

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
                if (res.status === 401 || res.status === 403) {
                    localStorage.clear();
                    window.location.href = 'login.html';
                    return;
                }
                throw new Error(data.message);
            }

            document.getElementById('designer-faturamento-mes').textContent = formatarMoeda(data.designer.faturamento_mes);
            document.getElementById('designer-acertos-pendentes').textContent = formatarMoeda(data.designer.acertos_pendentes);
            document.getElementById('designer-pedidos-ativos').textContent = data.meusPedidos.length;
            document.getElementById('count-meus').textContent = data.meusPedidos.length;
            document.getElementById('count-mercado').textContent = data.mercado.length;

            const badgeNivel = document.getElementById('badge-nivel');
            const niveis = { 1: { t: 'Ouro', c: 'lvl-1' }, 2: { t: 'Prata', c: 'lvl-2' }, 3: { t: 'Bronze', c: 'lvl-3' } };
            const n = niveis[data.designer.nivel] || niveis[3];

            if (badgeNivel) {
                badgeNivel.innerHTML = `<i class="fas fa-medal"></i> Nível ${n.t}`;
                badgeNivel.className = `stat-badge ${n.c}`;
            }

            const valPontos = document.getElementById('val-pontos');
            if (valPontos) valPontos.textContent = data.designer.pontuacao;

            renderizarMeusTrabalhos(data.meusPedidos);
            renderizarMercado(data.mercado);
            carregarHistoricoAcertos();

        } catch (error) {
            console.error(error);
            window.mostrarErro('Falha ao carregar os dados do painel.');
        }
    }

    async function carregarHistoricoAcertos() {
        const container = document.getElementById('saques-list');
        if (!container) return;

        try {
            const res = await fetch('/api/designer/getAcertos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: sessionToken })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message);

            window.acertosCache = data.acertos; // Cache para filtro
            renderizarHistoricoFiltrado('TODOS');

        } catch (error) {
            console.error(error);
            container.innerHTML = `<p style="text-align:center; padding:20px; color:var(--danger);">Erro ao carregar histórico.</p>`;
        }
    }

    window.renderizarHistoricoFiltrado = (statusFiltro) => {
        const container = document.getElementById('saques-list');
        const acertos = window.acertosCache || [];
        
        const filtrados = statusFiltro === 'TODOS' ? acertos : acertos.filter(a => a.status === statusFiltro);

        if (filtrados.length === 0) {
            container.innerHTML = `
                ${renderizarControlesFiltro(statusFiltro)}
                <p style="text-align:center; padding:40px; color:var(--text-muted);">Nenhum acerto encontrado para este filtro.</p>
            `;
            return;
        }

        // Agrupar por Empresa
        const grupos = {};
        filtrados.forEach(a => {
            if (!grupos[a.empresa]) {
                grupos[a.empresa] = { nome: a.empresa, empresa_id: a.empresa_id, total: 0, itens: [] };
            }
            grupos[a.empresa].itens.push(a);
            grupos[a.empresa].total += a.valor;
        });

        const htmlGrupos = Object.values(grupos).map((grupo, idx) => {
            const empId = `emp-${idx}`;
            return `
                <div style="border-bottom: 1px solid #f1f5f9; margin-bottom: 5px; border-radius: 8px; overflow: hidden; background: #fff;">
                        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr; gap: 10px; padding: 15px; align-items: center; cursor:pointer;" onclick="toggleDetalhesEmpresa('${empId}')">
                            <div style="font-weight:700; color:var(--text-main);"><i class="fas fa-chevron-right" id="icon-${empId}" style="margin-right:8px; transition:0.2s;"></i> ${grupo.nome}</div>
                            <div style="font-size:0.8rem; color:var(--text-muted);">${grupo.itens.length} registro(s)</div>
                            <div style="font-weight:700; color:var(--success); text-align:right;">${formatarMoeda(grupo.total)}</div>
                            <div style="text-align:right; display: flex; gap: 5px; justify-content: flex-end;" onclick="event.stopPropagation()">
                                ${grupo.itens.some(i => i.comprovante_url) ? `<button onclick="baixarComprovantes('${empId}')" class="btn-outline-sm" title="Baixar todos comprovantes"><i class="fas fa-download"></i></button>` : ''}
                                <div style="position:relative; display:flex; align-items:center;">
                                    <input type="text" id="valor-recebido-${empId}" class="input-moeda-manual" placeholder="R$ 0,00" style="width:100px; padding:6px; border-radius:6px; border:1px solid #ddd; font-size:0.8rem; text-align:right;">
                                    <button onclick="registrarPagamentoManual('${grupo.empresa_id}', '${empId}')" class="btn-action-sm" style="margin-left:5px; background:var(--success); padding:6px 10px;" title="Registrar Recebimento">
                                        <i class="fas fa-check"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div id="detalhes-${empId}" style="display:none; background: #f8fafc; padding: 10px 15px 10px 40px; border-top: 1px solid #edf2f7;">
                            ${grupo.itens.map(item => {
                                let statusHtml = `<span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:8px; font-size:0.65rem; font-weight:700;">${item.status}</span>`;
                                if(item.status === 'PAGO') statusHtml = `<span style="background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:8px; font-size:0.65rem; font-weight:700;">RECEBIDO</span>`;
                                else if(item.status === 'AGUARDANDO_CONFIRMACAO') statusHtml = `<span style="background:#dcfce7; color:#16a34a; padding:2px 8px; border-radius:8px; font-size:0.65rem; font-weight:700;">AGUARDANDO VOCÊ</span>`;
                                
                                let linkDoc = item.comprovante_url ? `<a href="${item.comprovante_url}" target="_blank" title="Baixar Comprovante" style="color:var(--primary-color);" class="btn-doc-${empId}"><i class="fas fa-file-invoice-dollar"></i></a>` : '-';

                                return `
                                    <div style="display: grid; grid-template-columns: 1fr 2fr 1fr 1fr 0.5fr; gap: 10px; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; font-size:0.85rem; align-items: center;">
                                        <div style="color:var(--text-muted); font-size:0.75rem;">${new Date(item.data).toLocaleDateString()}</div>
                                        <div style="font-weight:500;">${item.descricao}</div>
                                        <div>${statusHtml}</div>
                                        <div style="font-weight:600; text-align:right;">${formatarMoeda(item.valor)}</div>
                                        <div style="text-align:right;">${linkDoc}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }).join('');

            container.innerHTML = `
                ${renderizarControlesFiltro(statusFiltro)}
                <div class="list-header" style="grid-template-columns: 2fr 1fr 1fr 1.5fr; margin-bottom: 10px; background:transparent;">
                    <div>Empresa / Gráfica</div>
                    <div>Registros</div>
                    <div style="text-align:right;">Pendência Atual</div>
                    <div style="text-align:right;">Registrar Recebimento</div>
                </div>
                ${htmlGrupos}
            `;
            
            carregarMascarasMoeda();
        }

        window.carregarMascarasMoeda = () => {
            document.querySelectorAll('.input-moeda-manual').forEach(el => {
                IMask(el, {
                    mask: 'R$ num',
                    blocks: {
                        num: {
                            mask: Number,
                            thousandsSeparator: '.',
                            padFractionalZeros: true,
                            normalizeZeros: true,
                            radix: ',',
                            mapToRadix: ['.']
                        }
                    }
                });
            });
        }

        window.baixarComprovantes = (empId) => {
            const links = document.querySelectorAll(`.btn-doc-${empId}`);
            links.forEach(l => { if(l.href) window.open(l.href, '_blank'); });
        }

        window.registrarPagamentoManual = async (empresaId, empId) => {
            const input = document.getElementById(`valor-recebido-${empId}`);
            let valorStr = input.value.replace('R$ ', '').replace(/\./g, '').replace(',', '.').trim();
            const valorNum = parseFloat(valorStr);

            if(isNaN(valorNum) || valorNum <= 0) return alert("Informe um valor válido.");
            
            if(!confirm(`Confirma que recebeu ${formatarMoeda(valorNum)} desta empresa?`)) return;

            try {
                const res = await fetch('/api/designer/registrarPagamento', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken: sessionToken, empresaId, valor: valorNum })
                });
                if(res.ok) {
                    alert("Pagamento registrado e acertos abatidos!");
                    carregarDashboard();
                    carregarHistoricoAcertos();
                } else {
                    const data = await res.json();
                    alert("Erro: " + data.message);
                }
            } catch(e) { console.error(e); alert("Erro ao registrar pagamento."); }
        }

        function renderizarControlesFiltro(selecionado) {
        return `
            <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 20px; background: #fff; padding: 15px; border-radius: 12px; box-shadow: var(--shadow-sm);">
                <span style="font-weight:600; font-size:0.9rem; color:var(--secondary-color);">Filtrar Status:</span>
                <select onchange="renderizarHistoricoFiltrado(this.value)" style="padding: 8px 15px; border-radius: 8px; border: 1px solid #e2e8f0; font-family: 'Poppins'; outline:none; cursor:pointer;">
                    <option value="TODOS" ${selecionado === 'TODOS' ? 'selected' : ''}>Todos os Registros</option>
                    <option value="PENDENTE" ${selecionado === 'PENDENTE' ? 'selected' : ''}>Pendentes de Recebimento</option>
                    <option value="PAGO" ${selecionado === 'PAGO' ? 'selected' : ''}>Recebidos (Confirmados)</option>
                </select>
            </div>
        `;
    }

    window.toggleDetalhesEmpresa = (id) => {
        const el = document.getElementById(`detalhes-${id}`);
        const icon = document.getElementById(`icon-${id}`);
        if (el.style.display === 'none') {
            el.style.display = 'block';
            icon.style.transform = 'rotate(90deg)';
        } else {
            el.style.display = 'none';
            icon.style.transform = 'rotate(0deg)';
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
                    <button onclick="abrirChatEmbutido(${p.id}, '${p.titulo}')" class="btn-action" style="background:#25D366;"><i class="fab fa-whatsapp"></i> Chat Grupo</button>
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
        const corpo = `<p style="font-size:1rem; color:var(--text-main); line-height:1.5;">Deseja assumir este pedido? Você será responsável pela comunicação e entrega da arte.</p>`;
        const rodape = `
            <button id="btn-exec-assumir" class="btn-full btn-primary">SIM, ATENDER</button>
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
            <input type="url" id="f-layout" class="drawer-input" placeholder="Cole o link do layout..." required>
            <span class="drawer-label">Link para Impressão (PDF/AI/CDR)</span>
            <input type="url" id="f-impressao" class="drawer-input" placeholder="Cole o link do arquivo final..." required>
        `;
        const rodape = `
            <button id="btn-exec-finalizar" class="btn-full btn-primary">FINALIZAR E RECEBER</button>
            <button onclick="fecharGaveta()" class="btn-full btn-secondary">Voltar</button>
        `;
        window.abrirGaveta("Entregar Trabalho", corpo, rodape);

        document.getElementById('btn-exec-finalizar').onclick = async () => {
            const linkLayout = document.getElementById('f-layout').value.trim();
            const linkImpressao = document.getElementById('f-impressao').value.trim();

            if (!linkLayout || !linkImpressao) {
                alert("Por favor, preencha os dois links.");
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
    // UTILITÁRIOS & MINI CHAT
    // =========================================================

    function formatarMoeda(valor) {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
    }

    window.b64EncodeUnicode = (str) => {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (m, p1) => String.fromCharCode('0x' + p1)));
    };

    const chatStyle = document.createElement('style');
    chatStyle.textContent = `
        .chat-container { flex: 1; overflow-y: auto; padding: 15px; background: #efeae2; border-radius: 8px; display: flex; flex-direction: column; gap: 10px; height: 60vh; scroll-behavior: smooth; }
        .chat-bubble { max-width: 85%; padding: 10px 14px; border-radius: 8px; font-size: 0.9rem; position: relative; word-wrap: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
        .chat-in { background: #ffffff; align-self: flex-start; border-top-left-radius: 0; }
        .chat-out { background: #dcf8c6; align-self: flex-end; border-top-right-radius: 0; }
        .chat-sender { font-size: 0.7rem; font-weight: 700; color: #075e54; margin-bottom: 4px; display: block; }
        .chat-time { font-size: 0.65rem; color: #999; text-align: right; display: block; margin-top: 5px; }
        .chat-input-row { display: flex; gap: 10px; margin-top: 15px; align-items: center; }
    `;
    document.head.appendChild(chatStyle);

    window.chatInterval = null;
    const fecharGavetaOriginal = window.fecharGaveta;
    window.fecharGaveta = () => {
        if (window.chatInterval) clearInterval(window.chatInterval);
        fecharGavetaOriginal();
    };

    window.abrirChatEmbutido = async (pedidoId, pedidoTitulo) => {
        const corpo = `
            <div class="chat-container" id="chat-msgs-container">
                <p style="text-align:center; color:#888; margin-top: 20px;"><i class="fas fa-spinner fa-spin"></i> Conectando...</p>
            </div>
            <div id="chat-file-preview" style="display:none; padding:10px; background:#f1f5f9; border-radius:8px; margin-top:10px; font-size:0.8rem; display:flex; justify-content:space-between; align-items:center;">
                <span id="chat-file-name" style="color:var(--primary-color); font-weight:600;"></span>
                <button onclick="document.getElementById('chat-file-input').value=''; document.getElementById('chat-file-preview').style.setProperty('display', 'none', 'important');" style="border:none; background:none; color:red; cursor:pointer;">&times;</button>
            </div>
            <div class="chat-input-row" style="position:relative;">
                <input type="file" id="chat-file-input" style="display:none;" onchange="const f=this.files[0]; if(f){ document.getElementById('chat-file-name').innerText=f.name; document.getElementById('chat-file-preview').style.setProperty('display', 'flex', 'important'); }">
                <button onclick="document.getElementById('chat-file-input').click()" class="btn-action" style="padding: 10px 15px; background:#64748b; font-size: 1.1rem; border-radius: 8px;" title="Anexar Arquivo"><i class="fas fa-paperclip"></i></button>
                <input type="text" id="chat-texto-input" class="drawer-input" style="margin:0; flex:1;" placeholder="Escreva..." autocomplete="off">
                <button id="btn-enviar-chat" class="btn-action" style="padding: 14px 20px; font-size: 1.2rem; border-radius: 8px;"><i class="fas fa-paper-plane"></i></button>
            </div>
        `;
        window.abrirGaveta(`Atendimento: ${pedidoId} - ${pedidoTitulo}`, corpo, "");

        const container = document.getElementById('chat-msgs-container');
        const input = document.getElementById('chat-texto-input');
        const btnEnviar = document.getElementById('btn-enviar-chat');
        const fileInput = document.getElementById('chat-file-input');
        let totalMensagensCache = 0;

        const carregarMensagens = async () => {
            try {
                const fd = new FormData();
                fd.append('action', 'get');
                fd.append('pedidoId', pedidoId);

                const res = await fetch('/api/designer/chat', {
                    method: 'POST',
                    body: fd
                });
                const data = await res.json();

                if (res.ok && data.mensagens.length !== totalMensagensCache) {
                    totalMensagensCache = data.mensagens.length;
                    container.innerHTML = data.mensagens.map(m => {
                        let msgHtml = m.texto;
                        if (m.type === 'image' && m.file) {
                            msgHtml = `<img src="${m.file.link}" style="max-width:100%; border-radius:8px; cursor:pointer; margin-bottom:5px;" onclick="window.open('${m.file.link}', '_blank')"><br><small>${m.texto}</small>`;
                        } else if ((m.type === 'audio' || m.type === 'voice') && m.file) {
                            msgHtml = `<audio src="${m.file.link}" controls style="max-width:100%; height:32px;"></audio><br><small>${m.texto}</small>`;
                        } else if (m.type === 'video' && m.file) {
                            msgHtml = `<video src="${m.file.link}" controls style="max-width:100%; border-radius:8px;"></video><br><small>${m.texto}</small>`;
                        } else if (m.file) {
                            msgHtml = `<div style="background:rgba(0,0,0,0.05); padding:10px; border-radius:8px; display:flex; align-items:center; gap:10px;">
                                <i class="fas fa-file-alt" style="font-size:1.2rem;"></i>
                                <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.75rem;">${m.file.name}</div>
                                <a href="${m.file.link}" target="_blank" style="color:var(--primary-color);"><i class="fas fa-download"></i></a>
                            </div><small>${m.texto}</small>`;
                        }

                        return `
                            <div class="chat-bubble ${m.lado === 'in' ? 'chat-in' : 'chat-out'}">
                                <span class="chat-sender">${m.remetente}</span>
                                ${msgHtml}
                                <span class="chat-time">${new Date(m.hora * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        `;
                    }).join('');
                    container.scrollTop = container.scrollHeight;
                } else if (!res.ok) {
                    clearInterval(window.chatInterval);
                    container.innerHTML = `<p style="text-align:center; color:#c0392b;">${data.message || 'Erro ao carregar chat.'}</p>`;
                }
            } catch (err) {
                console.error(err);
                clearInterval(window.chatInterval);
            }
        };

        const enviarMensagem = async () => {
            const texto = input.value;
            const arquivo = fileInput.files[0];
            if (!texto.trim() && !arquivo) return;

            btnEnviar.disabled = true; input.disabled = true;
            try {
                const fd = new FormData();
                fd.append('action', 'send');
                fd.append('pedidoId', pedidoId);
                if (texto) fd.append('texto', texto);
                if (arquivo) fd.append('file', arquivo);

                await fetch('/api/designer/chat', {
                    method: 'POST',
                    body: fd
                });
                
                input.value = '';
                fileInput.value = '';
                document.getElementById('chat-file-preview').style.setProperty('display', 'none', 'important');
                await carregarMensagens();
            } catch (err) {
                alert('Não foi possível enviar a mensagem.');
            } finally {
                btnEnviar.disabled = false; input.disabled = false; input.focus();
            }
        };

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') enviarMensagem();
        });
        btnEnviar.onclick = enviarMensagem;

        await carregarMensagens();
        window.chatInterval = setInterval(carregarMensagens, 5000);
    };

})();