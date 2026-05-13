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
    { id: 'SEGUNDA', label: 'Segunda-feira' },
    { id: 'TERCA',   label: 'Terça-feira'  },
    { id: 'QUARTA',  label: 'Quarta-feira' },
    { id: 'QUINTA',  label: 'Quinta-feira' },
    { id: 'SEXTA',   label: 'Sexta-feira'  },
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

    // Permitir Ctrl+Enter no campo de tarefa inline para adicionar mais
    document.getElementById('lista-tarefas-criar')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            adicionarCampoTarefa();
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
    console.log('[Projetos] Renderizando Kanban...');
    const board = document.getElementById('kanban-board');
    if (!board) return;

    board.innerHTML = '';

    COLUNAS.forEach(col => {
        const projetosDaColuna = state.projetos.filter(p => p.coluna === col.id);
        console.log(`[Projetos] Coluna ${col.label}: ${projetosDaColuna.length} projeto(s).`);

        const colEl = criarElementoColuna(col, projetosDaColuna);
        board.appendChild(colEl);
    });

    console.log('[Projetos] Kanban renderizado.');
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

    card.innerHTML = `
        <div class="kanban-card-titulo">${escapeHtml(projeto.titulo)}</div>
        <div class="kanban-card-meta">
            <span class="kanban-card-tarefas">
                <i class="fas fa-check-square"></i> ${concluidas}/${total} tarefas
            </span>
        </div>
        ${total > 0 ? `
        <div class="kanban-card-progresso-wrap">
            <div class="kanban-card-progresso-barra">
                <div class="kanban-card-progresso-fill" style="width: ${percentual}%"></div>
            </div>
            <span class="kanban-card-progresso-pct">${percentual}%</span>
        </div>` : ''}
    `;

    // Drag start
    card.addEventListener('dragstart', (e) => {
        state.draggingId = projeto.id;
        e.dataTransfer.setData('projetoId', projeto.id);
        e.dataTransfer.setData('colunaOrigem', projeto.coluna);
        card.classList.add('dragging');
        console.log(`[Projetos] Drag start: projeto #${projeto.id} (${projeto.coluna})`);
    });

    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        state.draggingId = null;
        document.querySelectorAll('.kanban-cards-area').forEach(a => a.classList.remove('drag-over'));
    });

    // Clique abre modal de detalhe
    card.addEventListener('click', () => {
        if (state.draggingId !== null) return; // evita abrir durante drag
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
                coluna: 'SEGUNDA' // sempre começa na segunda
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
async function toggleTarefa(tarefaId, concluida) {
    console.log(`[Projetos] Toggle tarefa #${tarefaId} → concluida: ${concluida}`);

    // Atualiza estado local imediatamente (UI otimista)
    const projetoId = Number(document.getElementById('modal-detalhe')?.dataset.projetoId);
    const projeto = state.projetos.find(p => p.id === projetoId);
    
    if (projeto) {
        const tarefa = projeto.tarefas.find(t => t.id === tarefaId);
        if (tarefa) tarefa.concluida = concluida;
        atualizarBarraProgresso(projeto);

        // Atualiza o label da tarefa visualmente
        const label = document.querySelector(`[data-tarefa-id="${tarefaId}"]`);
        if (label) {
            label.classList.toggle('concluida', concluida);
        }

        // Atualiza o card no board
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
            atualizarBarraProgresso(projeto);
            atualizarCardNoBoard(projeto);
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

    const metaEl  = card.querySelector('.kanban-card-tarefas');
    const fillEl  = card.querySelector('.kanban-card-progresso-fill');
    const pctEl   = card.querySelector('.kanban-card-progresso-pct');

    if (metaEl)  metaEl.innerHTML  = `<i class="fas fa-check-square"></i> ${concluidas}/${total} tarefas`;
    if (fillEl)  fillEl.style.width = `${percentual}%`;
    if (pctEl)   pctEl.textContent  = `${percentual}%`;
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
        board.innerHTML = COLUNAS.map(col => `
            <div class="kanban-coluna">
                <div class="kanban-coluna-header">
                    <span class="kanban-coluna-titulo">${col.label}</span>
                </div>
                <div class="kanban-cards-area">
                    <div class="kanban-loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>Carregando...</span>
                    </div>
                </div>
            </div>
        `).join('');
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
