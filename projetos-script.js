// /projetos-script.js
console.log('[Projetos] Script carregado.');

// ============================================================
// ESTADO GLOBAL
// ============================================================
const state = {
    projetos: [],
    draggingId: null,
    sessionToken: localStorage.getItem('sessionToken'),
};

const COLUNAS = [
    { id: 'PRODUCAO', label: 'Produção',  icone: 'fa-cog'      },
    { id: 'AGENDAR',  label: 'Agendar',   icone: 'fa-calendar' },
    { id: 'INSTALAR', label: 'Instalar',  icone: 'fa-wrench'   },
];

// ============================================================
// INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Projetos] DOM carregado. Inicializando...');

    if (!state.sessionToken) {
        console.warn('[Projetos] Sem sessionToken. Redirecionando para login.');
        window.location.href = '/login.html';
        return;
    }

    inicializarBotoes();
    carregarProjetos();
});

function inicializarBotoes() {
    console.log('[Projetos] Inicializando botões...');

    // Botão NOVO PROJETO
    document.getElementById('btn-novo-projeto')?.addEventListener('click', abrirModalCriacao);

    // Modal criação — fechar
    document.getElementById('btn-fechar-modal-criar')?.addEventListener('click', fecharModalCriacao);
    document.getElementById('overlay-modal-criar')?.addEventListener('click', fecharModalCriacao);

    // Modal criação — adicionar tarefa
    document.getElementById('btn-adicionar-tarefa')?.addEventListener('click', adicionarCampoTarefa);

    // Modal criação — salvar
    document.getElementById('btn-salvar-projeto')?.addEventListener('click', salvarProjeto);

    // Modal detalhe — fechar
    document.getElementById('btn-fechar-modal-detalhe')?.addEventListener('click', fecharModalDetalhe);
    document.getElementById('overlay-modal-detalhe')?.addEventListener('click', fecharModalDetalhe);

    // Modal edição — fechar
    document.getElementById('btn-fechar-modal-editar')?.addEventListener('click', fecharModalEdicao);
    document.getElementById('btn-cancelar-editar')?.addEventListener('click', fecharModalEdicao);
    document.getElementById('overlay-modal-editar')?.addEventListener('click', fecharModalEdicao);

    // Modal edição — adicionar tarefa
    document.getElementById('btn-adicionar-tarefa-editar')?.addEventListener('click', adicionarCampoTarefaEditar);

    // Modal edição — salvar
    document.getElementById('btn-salvar-edicao')?.addEventListener('click', salvarEdicao);

    // Permitir Enter no campo de tarefa inline para adicionar mais (criação)
    document.getElementById('lista-tarefas-criar')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            adicionarCampoTarefa();
        }
    });

    // Permitir Enter no campo de tarefa inline para adicionar mais (edição)
    document.getElementById('lista-tarefas-editar')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            adicionarCampoTarefaEditar();
        }
    });

    console.log('[Projetos] Botões inicializados.');
}

// ============================================================
// CARREGAR PROJETOS DA API
// ============================================================
async function carregarProjetos() {
    console.log('[Projetos] Carregando projetos da API...');
    mostrarLoadingColunas(true);

    try {
        const res = await fetch('/api/projetos/listar', {
            headers: { 'Authorization': state.sessionToken }
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Erro ao carregar projetos.');
        }

        const data = await res.json();
        state.projetos = data.projetos || [];
        console.log(`[Projetos] ${state.projetos.length} projeto(s) carregado(s).`);

        renderizarKanban();
    } catch (error) {
        console.error('[Projetos] ERRO ao carregar projetos:', error);
        mostrarErroGeral('Não foi possível carregar os projetos. Tente novamente.');
    } finally {
        mostrarLoadingColunas(false);
    }
}

// ============================================================
// RENDERIZAR KANBAN
// ============================================================
function renderizarKanban() {
    console.log('[Projetos] Renderizando cards...');
    const board = document.getElementById('kanban-board');
    if (!board) return;
    board.innerHTML = '';

    const ordenados = ordenarPorData(state.projetos);
    console.log(`[Projetos] ${ordenados.length} projeto(s) ordenados por data.`);

    if (ordenados.length === 0) {
        board.innerHTML = `<div class="kanban-vazio" style="padding:48px;text-align:center;grid-column:1/-1">
            <i class="fas fa-folder-open" style="font-size:2rem;display:block;margin-bottom:12px;color:#c7d2fe;"></i>
            Nenhum projeto cadastrado.
        </div>`;
        return;
    }

    ordenados.forEach(projeto => board.appendChild(criarElementoCard(projeto)));
    console.log('[Projetos] Cards renderizados.');
}

function ordenarPorData(projetos) {
    return [...projetos].sort((a, b) => {
        const da = a.data_instalacao ? new Date(String(a.data_instalacao).substring(0, 10) + 'T00:00:00') : null;
        const db = b.data_instalacao ? new Date(String(b.data_instalacao).substring(0, 10) + 'T00:00:00') : null;
        if (da && db) return da - db;
        if (da) return -1; // com data vem primeiro
        if (db) return 1;  // sem data vai por último
        return a.id - b.id;
    });
}

function criarElementoColuna(col, projetos) {
    const div = document.createElement('div');
    div.className = 'kanban-coluna';
    div.dataset.coluna = col.id;

    div.innerHTML = `
        <div class="kanban-coluna-header">
            <span class="kanban-coluna-titulo">${col.label}</span>
            <span class="kanban-coluna-count">${projetos.length}</span>
        </div>
        <div class="kanban-cards-area" data-coluna="${col.id}">
            ${projetos.length === 0 ? `<div class="kanban-vazio">Nenhum projeto aqui</div>` : ''}
        </div>
    `;

    const area = div.querySelector('.kanban-cards-area');

    // Adiciona os cards
    projetos.forEach(projeto => {
        const card = criarElementoCard(projeto);
        area.appendChild(card);
    });

    // Drag & Drop na área da coluna
    area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.classList.add('drag-over');
        const vazio = area.querySelector('.kanban-vazio');
        if (vazio) vazio.style.display = 'none';
    });

    area.addEventListener('dragleave', (e) => {
        if (!area.contains(e.relatedTarget)) {
            area.classList.remove('drag-over');
            const vazio = area.querySelector('.kanban-vazio');
            if (vazio && area.querySelectorAll('.kanban-card').length === 0) {
                vazio.style.display = '';
            }
        }
    });

    area.addEventListener('drop', async (e) => {
        e.preventDefault();
        area.classList.remove('drag-over');
        const projetoId = e.dataTransfer.getData('projetoId');
        const colunaOrigem = e.dataTransfer.getData('colunaOrigem');
        const novaColuna = col.id;

        if (!projetoId || colunaOrigem === novaColuna) {
            console.log('[Projetos] Drop cancelado: mesmo coluna ou sem id.');
            return;
        }

        console.log(`[Projetos] Drop: projeto #${projetoId} de "${colunaOrigem}" → "${novaColuna}"`);
        await moverProjeto(Number(projetoId), novaColuna);
    });

    return div;
}

function criarElementoCard(projeto) {
    const total = projeto.tarefas?.length || 0;
    const concluidas = projeto.tarefas?.filter(t => t.concluida).length || 0;
    const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0;

    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.dataset.id = projeto.id;
    card.draggable = true;

    // Monta lista de tarefas inline
    const tarefasHtml = total > 0 ? `
        <div class="kanban-card-tarefas-lista">
            ${projeto.tarefas.map(t => `
                <label class="kanban-card-tarefa-item ${t.concluida ? 'concluida' : ''}" data-tarefa-id="${t.id}">
                    <input
                        type="checkbox"
                        class="kanban-card-tarefa-check"
                        ${t.concluida ? 'checked' : ''}
                        onchange="event.stopPropagation(); toggleTarefa(${t.id}, this.checked, ${projeto.id})"
                    >
                    <span class="kanban-card-tarefa-texto">${escapeHtml(t.texto)}</span>
                </label>
            `).join('')}
        </div>
        <div class="kanban-card-progresso-wrap">
            <div class="kanban-card-progresso-barra">
                <div class="kanban-card-progresso-fill" style="width: ${percentual}%"></div>
            </div>
            <span class="kanban-card-progresso-pct">${percentual}%</span>
        </div>
    ` : '';

    const ESTAGIO = {
        PRODUCAO: { label: 'Produção', icone: 'fa-cog',      cls: 'estagio-producao' },
        AGENDAR:  { label: 'Agendar',   icone: 'fa-calendar', cls: 'estagio-agendar'  },
        INSTALAR: { label: 'Instalar',  icone: 'fa-wrench',   cls: 'estagio-instalar' },
    };
    const est = ESTAGIO[projeto.coluna] || ESTAGIO.PRODUCAO;
    const estagioBadge = `<div class="kanban-card-estagio ${est.cls}"><i class="fas ${est.icone}"></i> ${est.label}</div>`;

    // Badge de data de instalação
    let dataBadgeHtml = '';
    if (projeto.data_instalacao) {
        const urgencia = calcularUrgenciaData(projeto.data_instalacao);
        dataBadgeHtml = `<div class="kanban-card-data urgencia-${urgencia.classe}${urgencia.pulsar ? ' pulsar' : ''}">
            <i class="fas fa-calendar-day"></i> ${formatarData(projeto.data_instalacao)} &mdash; ${urgencia.label}
        </div>`;
    }

    card.innerHTML = `
        ${estagioBadge}
        <div class="kanban-card-titulo">${escapeHtml(projeto.titulo)}</div>
        ${dataBadgeHtml}
        ${tarefasHtml}
        <div class="kanban-card-acoes">
            <button class="btn-card-acao btn-card-editar" onclick="event.stopPropagation(); abrirModalEdicao(${projeto.id})"><i class="fas fa-pen"></i> Editar</button>
            <button class="btn-card-acao btn-card-deletar" onclick="event.stopPropagation(); deletarProjeto(${projeto.id})"><i class="fas fa-trash"></i> Deletar</button>
        </div>
    `;

    // Clique no card (fora de tarefas e botões) abre modal de detalhe
    card.addEventListener('click', (e) => {
        if (e.target.closest('.kanban-card-tarefas-lista')) return;
        if (e.target.closest('.kanban-card-acoes')) return;
        abrirModalDetalhe(projeto.id);
    });

    return card;
}

// ============================================================
// MOVER PROJETO (API)
// ============================================================
async function moverProjeto(projetoId, novaColuna) {
    console.log(`[Projetos] Chamando API moverColuna: projeto #${projetoId} → ${novaColuna}`);

    // Atualiza estado local imediatamente (UI otimista)
    const projeto = state.projetos.find(p => p.id === projetoId);
    if (projeto) {
        projeto.coluna = novaColuna;
    }
    renderizarKanban();

    try {
        const res = await fetch('/api/projetos/moverColuna', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: state.sessionToken, projetoId, novaColuna })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Erro ao mover projeto.');
        }

        const data = await res.json();
        console.log(`[Projetos] Projeto movido com sucesso: ${data.message}`);
    } catch (error) {
        console.error('[Projetos] ERRO ao mover projeto:', error);
        // Reverte em caso de erro
        if (projeto) {
            projeto.coluna = projeto._colunaAnterior || 'SEGUNDA';
        }
        renderizarKanban();
        alert('Erro ao mover o projeto. Tente novamente.');
    }
}

// ============================================================
// MODAL CRIAÇÃO DE PROJETO
// ============================================================
function abrirModalCriacao() {
    console.log('[Projetos] Abrindo modal de criação...');
    document.getElementById('modal-criar').classList.add('ativo');
    document.getElementById('overlay-modal-criar').classList.add('ativo');
    document.getElementById('input-titulo-projeto').focus();

    // Limpa campos anteriores
    document.getElementById('input-titulo-projeto').value = '';
    document.getElementById('input-data-instalacao').value = '';
    document.getElementById('lista-tarefas-criar').innerHTML = '';
    adicionarCampoTarefa(); // começa com 1 tarefa vazia
}

function fecharModalCriacao() {
    console.log('[Projetos] Fechando modal de criação.');
    document.getElementById('modal-criar').classList.remove('ativo');
    document.getElementById('overlay-modal-criar').classList.remove('ativo');
}

function adicionarCampoTarefa() {
    const lista = document.getElementById('lista-tarefas-criar');
    const idx = lista.children.length;

    const item = document.createElement('div');
    item.className = 'tarefa-input-item';
    item.innerHTML = `
        <i class="fas fa-grip-vertical tarefa-drag-icon"></i>
        <input 
            type="text" 
            class="tarefa-input-field" 
            placeholder="Descreva a tarefa ${idx + 1}..."
            id="tarefa-input-${idx}"
            autocomplete="off"
        >
        <button class="tarefa-remover-btn" title="Remover tarefa" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    lista.appendChild(item);
    item.querySelector('input').focus();
    console.log(`[Projetos] Campo de tarefa ${idx + 1} adicionado.`);
}

async function salvarProjeto() {
    const titulo = document.getElementById('input-titulo-projeto').value.trim();
    const dataInstalacao = document.getElementById('input-data-instalacao').value || null;
    const inputs = document.querySelectorAll('#lista-tarefas-criar .tarefa-input-field');
    const tarefas = Array.from(inputs)
        .map(i => i.value.trim())
        .filter(t => t.length > 0);

    console.log(`[Projetos] Salvando projeto: "${titulo}" com ${tarefas.length} tarefa(s)`);

    if (!titulo) {
        alert('Por favor, informe o título do projeto.');
        document.getElementById('input-titulo-projeto').focus();
        return;
    }

    if (tarefas.length === 0) {
        alert('Adicione ao menos uma tarefa ao projeto.');
        return;
    }

    const btn = document.getElementById('btn-salvar-projeto');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...';

    try {
        const res = await fetch('/api/projetos/criar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionToken: state.sessionToken,
                titulo,
                tarefas,
                dataInstalacao,
                coluna: document.getElementById('input-coluna-projeto')?.value || 'PRODUCAO'
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Erro ao criar projeto.');
        }

        const data = await res.json();
        console.log(`[Projetos] Projeto criado com sucesso: #${data.projeto.id}`);

        state.projetos.push(data.projeto);
        renderizarKanban();
        fecharModalCriacao();
    } catch (error) {
        console.error('[Projetos] ERRO ao criar projeto:', error);
        alert(`Erro ao criar projeto: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Criar Projeto';
    }
}

// ============================================================
// MODAL DETALHE DO PROJETO
// ============================================================
function abrirModalDetalhe(projetoId) {
    const projeto = state.projetos.find(p => p.id === projetoId);
    if (!projeto) {
        console.warn(`[Projetos] Projeto #${projetoId} não encontrado no estado local.`);
        return;
    }

    console.log(`[Projetos] Abrindo detalhe do projeto #${projetoId}: "${projeto.titulo}"`);

    // Título
    document.getElementById('detalhe-titulo').textContent = projeto.titulo;

    // Barra de progresso
    atualizarBarraProgresso(projeto);

    // Lista de tarefas
    renderizarTarefasDetalhe(projeto);

    document.getElementById('modal-detalhe').classList.add('ativo');
    document.getElementById('overlay-modal-detalhe').classList.add('ativo');
    document.getElementById('modal-detalhe').dataset.projetoId = projetoId;
}

function fecharModalDetalhe() {
    console.log('[Projetos] Fechando modal de detalhe.');
    document.getElementById('modal-detalhe').classList.remove('ativo');
    document.getElementById('overlay-modal-detalhe').classList.remove('ativo');
}

function atualizarBarraProgresso(projeto) {
    const total = projeto.tarefas?.length || 0;
    const concluidas = projeto.tarefas?.filter(t => t.concluida).length || 0;
    const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0;

    const fill = document.getElementById('detalhe-progresso-fill');
    const pct  = document.getElementById('detalhe-progresso-pct');
    const info = document.getElementById('detalhe-progresso-info');

    if (fill) fill.style.width = `${percentual}%`;
    if (pct)  pct.textContent  = `${percentual}%`;
    if (info) info.textContent = `${concluidas} de ${total} tarefas concluídas`;

    // Cor dinâmica por progresso
    let cor = '#4f46e5';
    if (percentual >= 100) cor = '#10b981';
    else if (percentual >= 50) cor = '#f59e0b';
    if (fill) fill.style.background = cor;

    console.log(`[Projetos] Progresso renderizado: ${percentual}% (${concluidas}/${total})`);
}

function renderizarTarefasDetalhe(projeto) {
    const lista = document.getElementById('detalhe-tarefas-lista');
    if (!lista) return;

    if (!projeto.tarefas || projeto.tarefas.length === 0) {
        lista.innerHTML = '<p class="detalhe-sem-tarefas">Nenhuma tarefa cadastrada.</p>';
        return;
    }

    lista.innerHTML = projeto.tarefas.map(tarefa => `
        <label class="detalhe-tarefa-item ${tarefa.concluida ? 'concluida' : ''}" data-tarefa-id="${tarefa.id}">
            <input 
                type="checkbox" 
                class="detalhe-tarefa-checkbox"
                ${tarefa.concluida ? 'checked' : ''}
                onchange="toggleTarefa(${tarefa.id}, this.checked)"
            >
            <span class="detalhe-tarefa-texto">${escapeHtml(tarefa.texto)}</span>
        </label>
    `).join('');
}

// ============================================================
// TOGGLE TAREFA (API)
// ============================================================
async function toggleTarefa(tarefaId, concluida, projetoIdOverride) {
    console.log(`[Projetos] Toggle tarefa #${tarefaId} → concluida: ${concluida}`);

    // Busca o projeto — usa override (chamada do card inline) ou o modal aberto
    const projetoId = projetoIdOverride != null
        ? Number(projetoIdOverride)
        : Number(document.getElementById('modal-detalhe')?.dataset.projetoId);
    const projeto = state.projetos.find(p => p.id === projetoId);

    if (projeto) {
        const tarefa = projeto.tarefas.find(t => t.id === tarefaId);
        if (tarefa) tarefa.concluida = concluida;

        // Atualiza modal se estiver aberto para este projeto
        const modalEl = document.getElementById('modal-detalhe');
        const modalAberto = modalEl?.classList.contains('ativo');
        const modalProjetoId = Number(modalEl?.dataset.projetoId);
        if (modalAberto && modalProjetoId === projetoId) {
            atualizarBarraProgresso(projeto);
            const labelModal = document.querySelector(`#detalhe-tarefas-lista [data-tarefa-id="${tarefaId}"]`);
            if (labelModal) labelModal.classList.toggle('concluida', concluida);
        }

        // Atualiza o card no board (tarefas + barra)
        atualizarCardNoBoard(projeto);
    }

    try {
        const res = await fetch('/api/projetos/toggleTarefa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: state.sessionToken, tarefaId, concluida })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Erro ao atualizar tarefa.');
        }

        const data = await res.json();
        console.log(`[Projetos] Tarefa #${tarefaId} atualizada. Progresso: ${data.progresso.percentual}%`);
    } catch (error) {
        console.error('[Projetos] ERRO ao fazer toggle da tarefa:', error);
        // Reverte em caso de erro
        if (projeto) {
            const tarefa = projeto.tarefas.find(t => t.id === tarefaId);
            if (tarefa) tarefa.concluida = !concluida;
            atualizarCardNoBoard(projeto);
            const modalEl = document.getElementById('modal-detalhe');
            if (modalEl?.classList.contains('ativo') && Number(modalEl.dataset.projetoId) === projetoId) {
                atualizarBarraProgresso(projeto);
                const labelModal = document.querySelector(`#detalhe-tarefas-lista [data-tarefa-id="${tarefaId}"]`);
                if (labelModal) labelModal.classList.toggle('concluida', !concluida);
            }
        }
        alert('Erro ao atualizar a tarefa. Tente novamente.');
    }
}

function atualizarCardNoBoard(projeto) {
    const card = document.querySelector(`.kanban-card[data-id="${projeto.id}"]`);
    if (!card) return;

    const total = projeto.tarefas?.length || 0;
    const concluidas = projeto.tarefas?.filter(t => t.concluida).length || 0;
    const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0;

    // Atualiza barra de progresso
    const fillEl = card.querySelector('.kanban-card-progresso-fill');
    const pctEl  = card.querySelector('.kanban-card-progresso-pct');
    if (fillEl) fillEl.style.width = `${percentual}%`;
    if (pctEl)  pctEl.textContent  = `${percentual}%`;

    // Atualiza estado visual de cada tarefa inline
    projeto.tarefas?.forEach(t => {
        const label = card.querySelector(`.kanban-card-tarefa-item[data-tarefa-id="${t.id}"]`);
        if (!label) return;
        label.classList.toggle('concluida', t.concluida);
        const check = label.querySelector('.kanban-card-tarefa-check');
        if (check) check.checked = t.concluida;
    });

    console.log(`[Projetos] Card #${projeto.id} atualizado no board: ${percentual}% (${concluidas}/${total})`);
}

// ============================================================
// UTILITÁRIOS
// ============================================================
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function mostrarLoadingColunas(show) {
    const board = document.getElementById('kanban-board');
    if (!board) return;
    if (show) {
        board.innerHTML = `<div class="kanban-loading">Carregando...</div>`;
    }
}

function mostrarErroGeral(msg) {
    const board = document.getElementById('kanban-board');
    if (!board) return;
    board.innerHTML = `
        <div class="kanban-erro">
            <i class="fas fa-exclamation-triangle"></i>
            <p>${msg}</p>
            <button onclick="carregarProjetos()" class="btn-tentar-novamente">Tentar novamente</button>
        </div>
    `;
}

// ============================================================
// URGÊNCIA DE DATA
// ============================================================
function calcularUrgenciaData(dataInstalacao) {
    if (!dataInstalacao) return null;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const data = new Date(String(dataInstalacao).substring(0, 10) + 'T00:00:00');
    const dias = Math.round((data - hoje) / (1000 * 60 * 60 * 24));

    console.log(`[Projetos] Urgência: ${dias} dias para instalação.`);

    if (dias < 0)  return { classe: 'critica', label: 'Atrasado!',  pulsar: true  };
    if (dias === 0) return { classe: 'critica', label: 'Hoje!',      pulsar: true  };
    if (dias === 1) return { classe: 'urgente', label: 'Amanhã',    pulsar: false };
    if (dias <= 3)  return { classe: 'alerta',  label: `${dias} dias`, pulsar: false };
    if (dias <= 7)  return { classe: 'boa',     label: `${dias} dias`, pulsar: false };
    return             { classe: 'ok',      label: `${dias} dias`, pulsar: false };
}

function formatarData(dataStr) {
    if (!dataStr) return '';
    const d = new Date(String(dataStr).substring(0, 10) + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
}

// ============================================================
// MODAL EDIÇÃO DE PROJETO
// ============================================================
function abrirModalEdicao(projetoId) {
    const projeto = state.projetos.find(p => p.id === projetoId);
    if (!projeto) {
        console.warn(`[Projetos] Projeto #${projetoId} não encontrado para edição.`);
        return;
    }

    console.log(`[Projetos] Abrindo modal de edição do projeto #${projetoId}: "${projeto.titulo}"`);

    // Preenche campos
    document.getElementById('editar-projeto-id').value = projetoId;
    document.getElementById('editar-titulo-projeto').value = projeto.titulo;

    // Preenche estágio
    const selectEstagio = document.getElementById('editar-coluna-projeto');
    if (selectEstagio) selectEstagio.value = projeto.coluna || 'PRODUCAO';
    
    // Preenche data de instalação
    const dataRaw = projeto.data_instalacao
        ? String(projeto.data_instalacao).substring(0, 10)
        : '';
    document.getElementById('editar-data-instalacao').value = dataRaw;

    // Preenche tarefas existentes
    const lista = document.getElementById('lista-tarefas-editar');
    lista.innerHTML = '';
    (projeto.tarefas || []).forEach((t, i) => {
        const item = document.createElement('div');
        item.className = 'tarefa-input-item';
        item.innerHTML = `
            <i class="fas fa-grip-vertical tarefa-drag-icon"></i>
            <input
                type="text"
                class="tarefa-input-field"
                placeholder="Tarefa ${i + 1}..."
                id="editar-tarefa-input-${i}"
                value="${escapeHtml(t.texto)}"
                autocomplete="off"
            >
            <button class="tarefa-remover-btn" title="Remover tarefa" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        lista.appendChild(item);
    });

    // Garante ao menos 1 campo se não houver tarefas
    if ((projeto.tarefas || []).length === 0) adicionarCampoTarefaEditar();

    document.getElementById('modal-editar').classList.add('ativo');
    document.getElementById('overlay-modal-editar').classList.add('ativo');
    document.getElementById('editar-titulo-projeto').focus();
}

function fecharModalEdicao() {
    console.log('[Projetos] Fechando modal de edição.');
    document.getElementById('modal-editar').classList.remove('ativo');
    document.getElementById('overlay-modal-editar').classList.remove('ativo');
}

function adicionarCampoTarefaEditar() {
    const lista = document.getElementById('lista-tarefas-editar');
    const idx = lista.children.length;

    const item = document.createElement('div');
    item.className = 'tarefa-input-item';
    item.innerHTML = `
        <i class="fas fa-grip-vertical tarefa-drag-icon"></i>
        <input
            type="text"
            class="tarefa-input-field"
            placeholder="Descreva a tarefa ${idx + 1}..."
            id="editar-tarefa-input-${idx}"
            autocomplete="off"
        >
        <button class="tarefa-remover-btn" title="Remover tarefa" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    lista.appendChild(item);
    item.querySelector('input').focus();
    console.log(`[Projetos] Campo de tarefa de edição ${idx + 1} adicionado.`);
}

async function salvarEdicao() {
    const projetoId = Number(document.getElementById('editar-projeto-id').value);
    const titulo = document.getElementById('editar-titulo-projeto').value.trim();
    const dataInstalacao = document.getElementById('editar-data-instalacao').value || null;
    const inputs = document.querySelectorAll('#lista-tarefas-editar .tarefa-input-field');
    const tarefas = Array.from(inputs)
        .map(i => i.value.trim())
        .filter(t => t.length > 0);

    console.log(`[Projetos] Salvando edição do projeto #${projetoId}: "${titulo}" com ${tarefas.length} tarefa(s)`);

    if (!titulo) {
        alert('Por favor, informe o título do projeto.');
        document.getElementById('editar-titulo-projeto').focus();
        return;
    }

    if (tarefas.length === 0) {
        alert('Adicione ao menos uma tarefa ao projeto.');
        return;
    }

    const btn = document.getElementById('btn-salvar-edicao');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    try {
        const res = await fetch('/api/projetos/editar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionToken: state.sessionToken,
                projetoId,
                titulo,
                tarefas,
                dataInstalacao,
                coluna: document.getElementById('editar-coluna-projeto')?.value || 'PRODUCAO'
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Erro ao editar projeto.');
        }

        const data = await res.json();
        console.log(`[Projetos] Projeto #${projetoId} editado com sucesso.`);

        // Atualiza estado local
        const idx = state.projetos.findIndex(p => p.id === projetoId);
        if (idx !== -1) state.projetos[idx] = data.projeto;

        renderizarKanban();
        fecharModalEdicao();
    } catch (error) {
        console.error('[Projetos] ERRO ao editar projeto:', error);
        alert(`Erro ao salvar alterações: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Salvar Alterações';
    }
}

// ============================================================
// DELETAR PROJETO
// ============================================================
async function deletarProjeto(projetoId) {
    const projeto = state.projetos.find(p => p.id === projetoId);
    if (!projeto) return;

    const confirmar = confirm(`Deletar o projeto "${projeto.titulo}"?\n\nEsta ação não pode ser desfeita.`);
    if (!confirmar) {
        console.log(`[Projetos] Deleção do projeto #${projetoId} cancelada pelo usuário.`);
        return;
    }

    console.log(`[Projetos] Deletando projeto #${projetoId}: "${projeto.titulo}"`);

    // Remove localmente de imediato (UI otimista)
    state.projetos = state.projetos.filter(p => p.id !== projetoId);
    renderizarKanban();

    try {
        const res = await fetch('/api/projetos/deletar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: state.sessionToken, projetoId })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || 'Erro ao deletar projeto.');
        }

        console.log(`[Projetos] Projeto #${projetoId} deletado com sucesso.`);
    } catch (error) {
        console.error('[Projetos] ERRO ao deletar projeto:', error);
        // Reverte em caso de erro
        state.projetos.push(projeto);
        renderizarKanban();
        alert(`Erro ao deletar projeto: ${error.message}`);
    }
}
