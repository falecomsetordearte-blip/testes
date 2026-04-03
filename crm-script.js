// crm-script.js - LÓGICA DE META DIÁRIA AJUSTADA E LANÇAMENTO RÁPIDO COM VALIDAÇÕES EXTRAS

let currentStep = 1;
const totalSteps = 3;
let allCardsCache = [];
let globalMetasData = null;

document.addEventListener('DOMContentLoaded', () => {
    const sessionToken = localStorage.getItem('sessionToken');
    if (!sessionToken) { window.location.href = '/login.html'; return; }

    injectCleanStyles();
    createToastContainer();
    configurarMascaras();

    carregarKanban();
    // carregarMetasCRM(); // Desativado a pedido do usuário

    configurarBuscaCliente();

    const valTotalInput = document.getElementById('crm-valor');
    const valPagoInput = document.getElementById('crm-valor-pago');

    const clearZero = function (e) { if (Number(e.target.value) === 0) e.target.value = ''; };
    const restoreZero = function (e) { if (e.target.value.trim() === '') e.target.value = '0'; calcularSaldoRestante(); };

    if (valTotalInput) {
        valTotalInput.addEventListener('input', calcularSaldoRestante);
        valTotalInput.addEventListener('focus', clearZero);
        valTotalInput.addEventListener('blur', restoreZero);
    }
    if (valPagoInput) {
        valPagoInput.addEventListener('input', calcularSaldoRestante);
        valPagoInput.addEventListener('focus', clearZero);
        valPagoInput.addEventListener('blur', restoreZero);
    }

    const formatoSelect = document.getElementById('pedido-formato');
    if (formatoSelect) {
        formatoSelect.addEventListener('change', (e) => {
            const divVersao = document.getElementById('cdr-versao-container');
            if (divVersao) {
                e.target.value === 'CDR' ? divVersao.classList.remove('hidden') : divVersao.classList.add('hidden');
            }
        });
    }

    const btnAddMat = document.getElementById('btn-add-material');
    if (btnAddMat) {
        btnAddMat.addEventListener('click', () => adicionarMaterialNoForm());
    }
});

window.lancarVendaRapida = async function () {
    const input = document.getElementById('quick-venda-valor');
    const btn = document.getElementById('btn-quick-venda');
    const valor = parseFloat(input.value);

    if (isNaN(valor) || valor <= 0) {
        showToast("Digite um valor válido maior que zero.", "error");
        return;
    }

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        const res = await fetch('/api/crm/addVendaHoje', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionToken: localStorage.getItem('sessionToken'),
                valor: valor
            })
        });

        const data = await res.json();

        if (res.ok) {
            input.value = ''; 
            showToast(`+ R$ ${valor.toFixed(2)} somados a hoje!`, "success");
            await carregarMetasCRM(); 
        } else {
            showToast(data.error || "Erro ao lançar venda", "error");
        }
    } catch (err) {
        showToast("Erro de conexão.", "error");
    } finally {
        btn.innerHTML = '<i class="fas fa-plus"></i>';
        btn.disabled = false;
    }
};

async function carregarMetasCRM() {
    const container = document.getElementById('metas-widget-container');
    if (!container) return; // Evita erros se o widget for removido do HTML
    try {
        const res = await fetch('/api/crm/getMetas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken') })
        });

        globalMetasData = await res.json();

        if (globalMetasData && globalMetasData.metas) {
            // container.style.display = 'flex'; // OCULTO - remova o comentário para reexibir
            atualizarLabelsDoSelect(globalMetasData.metas);
            renderizarVisualizacaoMeta();
        } else {
            // container.style.display = 'flex'; // OCULTO - remova o comentário para reexibir
            document.getElementById('meta-text-left').innerHTML = `<span style="color:#e74c3c;"><i class="fas fa-exclamation-triangle"></i> Metas do mês não configuradas.</span>`;
            document.getElementById('meta-text-right').innerHTML = `<a href="/admin-metas.html" style="color:#3498db; font-weight:bold; text-decoration:underline;">⚙️ Configurar</a>`;
        }
    } catch (e) {
        console.error("Erro ao carregar metas:", e);
    }
}

function atualizarLabelsDoSelect(m) {
    const format = (dStr) => {
        if (!dStr) return '';
        const d = new Date(dStr);
        return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    };
    const sel = document.getElementById('filtro-metas');
    if (!sel) return;
    if (m.sem_1_inicio) sel.options[2].text = `📍 Semana 1 (${format(m.sem_1_inicio)} a ${format(m.sem_1_fim)})`;
    if (m.sem_2_inicio) sel.options[3].text = `📍 Semana 2 (${format(m.sem_2_inicio)} a ${format(m.sem_2_fim)})`;
    if (m.sem_3_inicio) sel.options[4].text = `📍 Semana 3 (${format(m.sem_3_inicio)} a ${format(m.sem_3_fim)})`;
    if (m.sem_4_inicio) sel.options[5].text = `📍 Semana 4 (${format(m.sem_4_inicio)} a ${format(m.sem_4_fim)})`;
}

function contarDiasRestantesNoMes() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth();
    const ultimoDiaDoMes = new Date(ano, mes + 1, 0).getDate();
    const diaHoje = hoje.getDate();
    const restantes = ultimoDiaDoMes - diaHoje + 1;
    return restantes > 0 ? restantes : 0;
}

window.renderizarVisualizacaoMeta = function () {
    if (!globalMetasData || !globalMetasData.metas) return;

    const filtro = document.getElementById('filtro-metas').value;
    const { metas, total_mes, total_hoje, vendas_semanas } = globalMetasData;

    let metaAlvo = 0;
    let atual = 0;
    let textoEsq = "";
    let textoDir = "";
    let premio = "";

    const fmt = (val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    if (filtro === 'diaria') {
        const metaMensal = Number(metas.meta_mensal) || 0;
        const totalVendidoMes = Number(total_mes) || 0;
        const saldoFaltante = metaMensal - totalVendidoMes;
        const diasRestantes = contarDiasRestantesNoMes();

        if (diasRestantes > 0 && saldoFaltante > 0) {
            metaAlvo = saldoFaltante / diasRestantes;
        } else {
            metaAlvo = 0;
        }

        atual = total_hoje;

        textoEsq = `Vendido Hoje: ${fmt(atual)}`;
        textoDir = `Alvo diário para bater o mês: ${fmt(metaAlvo)}`;

    } else if (filtro === 'mensal') {
        metaAlvo = Number(metas.meta_mensal);
        atual = total_mes;
        textoEsq = `Acumulado Mês: ${fmt(atual)}`;
        textoDir = `Meta: ${fmt(metaAlvo)}`;
        premio = metas.premio_mensal;

    } else {
        if (filtro === 'sem1') { atual = vendas_semanas.sem1; metaAlvo = Number(metas.meta_sem_1); premio = metas.premio_sem_1; }
        if (filtro === 'sem2') { atual = vendas_semanas.sem2; metaAlvo = Number(metas.meta_sem_2); premio = metas.premio_sem_2; }
        if (filtro === 'sem3') { atual = vendas_semanas.sem3; metaAlvo = Number(metas.meta_sem_3); premio = metas.premio_sem_3; }
        if (filtro === 'sem4') { atual = vendas_semanas.sem4; metaAlvo = Number(metas.meta_sem_4); premio = metas.premio_sem_4; }
        textoEsq = `Vendas na Semana: ${fmt(atual)}`;
        textoDir = `Alvo: ${fmt(metaAlvo)}`;
    }

    let porcentagem = metaAlvo > 0 ? (atual / metaAlvo) * 100 : (atual > 0 ? 100 : 0);
    const porcentagemBarra = porcentagem > 100 ? 100 : porcentagem;

    document.getElementById('meta-text-left').innerText = textoEsq;
    document.getElementById('meta-text-right').innerText = `${textoDir} (${porcentagem.toFixed(1)}%)`;

    const barra = document.getElementById('meta-progress-bar');
    barra.style.width = `${porcentagemBarra}%`;

    if (filtro === 'diaria' && porcentagem < 50 && metaAlvo > 0) barra.classList.add('danger');
    else barra.classList.remove('danger');

    const premioSpan = document.getElementById('meta-premio');
    if (premio && premio.trim() !== '') {
        document.getElementById('meta-premio-text').innerText = premio;
        premioSpan.classList.add('active');
        if (atual >= metaAlvo) {
            premioSpan.style.background = '#d4edda'; premioSpan.style.color = '#155724';
        } else {
            premioSpan.style.background = '#fdf2e9'; premioSpan.style.color = '#f39c12';
        }
    } else {
        premioSpan.classList.remove('active');
    }
}

function configurarBuscaCliente() {
    const input = document.getElementById('crm-nome');
    const btnBuscar = document.getElementById('btn-buscar-cliente');
    const list = document.getElementById('search-results-list');

    if (!input || !list) return;

    const performSearch = async (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        const term = input.value;
        if (term.length < 2) { showToast("Digite pelo menos 2 caracteres.", "error"); return; }

        btnBuscar.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        try {
            const res = await fetch('/api/crm/searchClients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), query: term })
            });
            const clientes = await res.json();
            list.innerHTML = '';
            if (clientes.length > 0) {
                clientes.forEach(c => {
                    const li = document.createElement('li');
                    li.innerHTML = `<span>${c.nome}</span> <small style="color:#aaa">${c.whatsapp}</small>`;
                    li.onclick = (event) => {
                        event.stopPropagation();
                        input.value = c.nome;
                        document.getElementById('crm-wpp').value = c.whatsapp;
                        list.style.display = 'none';
                    };
                    list.appendChild(li);
                });
                list.style.display = 'block';
            } else {
                showToast("Nenhum cliente encontrado.", "error");
                list.style.display = 'none';
            }
        } catch (e) {
            showToast("Erro ao buscar clientes.", "error");
        } finally {
            btnBuscar.innerHTML = '<i class="fas fa-search"></i>';
        }
    };

    if (btnBuscar) btnBuscar.addEventListener('click', performSearch);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(e); });
    input.addEventListener('input', () => { if (input.value === '') list.style.display = 'none'; });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.autocomplete-wrapper')) list.style.display = 'none';
    });
}

window.mudarPasso = function (direction) {
    if (direction === 1 && !validarPassoAtual()) return;
    currentStep += direction;
    renderizarPasso();
};

function renderizarPasso() {
    document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`step-${currentStep}`).classList.add('active');

    document.querySelectorAll('.step-indicator').forEach((ind, i) => {
        ind.classList.remove('active', 'completed');
        if (i + 1 < currentStep) ind.classList.add('completed');
        if (i + 1 === currentStep) ind.classList.add('active');
    });

    document.getElementById('btn-prev').style.display = currentStep === 1 ? 'none' : 'block';
    if (currentStep === totalSteps) {
        document.getElementById('btn-next').style.display = 'none';
        document.getElementById('final-buttons').style.display = 'flex';
    } else {
        document.getElementById('btn-next').style.display = 'flex';
        document.getElementById('final-buttons').style.display = 'none';
    }
}

function validarPassoAtual() {
    if (currentStep === 1) {
        if (!document.getElementById('pedido-servico-hidden').value) { showToast("Selecione o tipo de serviço.", "error"); return false; }
        if (document.getElementById('crm-nome').value.length < 2) { showToast("Informe o nome do cliente.", "error"); return false; }
        const titulo = document.getElementById('crm-titulo-manual').value;
        if (titulo.length > 30) { showToast("O Nome do Pedido não pode ter mais de 30 caracteres.", "error"); return false; }
    }

    if (currentStep === 2) {
        const arteOrigem = document.getElementById('pedido-arte-hidden').value;
        if (!arteOrigem) { showToast("Informe quem fará a arte.", "error"); return false; }

        if (arteOrigem === 'Setor de Arte') {
            const supWpp = document.getElementById('pedido-supervisao').value;
            const designerValor = document.getElementById('valor-designer').value;
            const formato = document.getElementById('pedido-formato').value;

            if (!supWpp || supWpp.length < 14) { showToast("Informe o WhatsApp da Supervisão completo.", "error"); return false; }
            if (!designerValor || parseFloat(designerValor) <= 0) { showToast("Informe o valor (maior que 0) para o Designer.", "error"); return false; }
            if (!formato) { showToast("Selecione o formato do arquivo (PDF, JPG, CDR).", "error"); return false; }
        }

        if (arteOrigem === 'Arquivo do Cliente') {
            const linkArquivo = document.getElementById('link-arquivo').value;
            const linkDrive = document.getElementById('link-arquivo-drive-arquivo').value;
            if ((!linkArquivo || linkArquivo.trim() === '') && (!linkDrive || linkDrive.trim() === '')) { 
                showToast("Cole o Link do Arquivo recebido do cliente ou envie para o Drive.", "error"); return false; 
            }
        }

        const entrega = document.getElementById('pedido-entrega-hidden').value;
        if (!entrega) { showToast("Selecione como será a Entrega/Instalação.", "error"); return false; }
    }

    return true;
}

window.selectCard = function (group, value, element) {
    document.getElementById(`pedido-${group}-hidden`).value = value;
    element.parentElement.querySelectorAll('.selection-card').forEach(c => c.classList.remove('selected'));
    element.classList.add('selected');

    if (group === 'arte') {
        const fileFields = document.getElementById('arquivo-cliente-fields');
        const setorFields = document.getElementById('setor-arte-fields');
        const proprioFields = document.getElementById('designer-proprio-fields');
        if (fileFields) fileFields.classList.toggle('hidden', value !== 'Arquivo do Cliente');
        if (setorFields) setorFields.classList.toggle('hidden', value !== 'Setor de Arte');
        if (proprioFields) proprioFields.classList.toggle('hidden', value !== 'Designer Próprio');
    }
};

async function carregarKanban() {
    try {
        const res = await fetch('/api/crm/listCards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken') })
        });
        const cards = await res.json();
        allCardsCache = cards;
        document.querySelectorAll('.kanban-items').forEach(c => c.innerHTML = '');
        cards.forEach(card => criarCardHTML(card));
        inicializarDragAndDrop();
    } catch (err) { console.error("Erro ao carregar Kanban:", err); }
}

function criarCardHTML(card) {
    const map = {
        'Novos': 'col-novos-list',
        'Visita Técnica': 'col-visita-list',
        'Aguardando Orçamento': 'col-orcamento-list',
        'Aguardando Pagamento': 'col-pagamento-list',
        'Abrir Pedido': 'col-abrir-list'
    };
    const container = document.getElementById(map[card.coluna]);
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'kanban-card';
    div.dataset.id = card.id;
    div.onclick = (e) => { if (!e.target.closest('button')) abrirPanelEdicao(card); };

    const valor = parseFloat(card.valor_orcamento || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    div.innerHTML = `
        <button class="btn-card-delete" onclick="window.confirmarExclusaoCard(${card.id}, event)"><i class="fas fa-trash-alt"></i></button>
        <div class="card-header-row"><span class="card-id">${card.titulo_automatico}</span></div>
        <div class="card-title">${card.nome_cliente}</div>
        <div class="card-footer-row">
            <span class="card-price">R$ ${valor}</span>
            <button class="btn-card-produzir" onclick="window.produzirCardDireto(${card.id}, this, event)"><i class="fas fa-rocket"></i> PRODUZIR</button>
        </div>
    `;
    container.appendChild(div);
}

function inicializarDragAndDrop() {
    document.querySelectorAll('.kanban-items').forEach(col => {
        if (col.getAttribute('init') === 'true') return;
        new Sortable(col, {
            group: 'crm',
            animation: 150,
            onEnd: function (evt) {
                fetch('/api/crm/moveCard', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionToken: localStorage.getItem('sessionToken'),
                        cardId: evt.item.dataset.id,
                        novaColuna: evt.to.parentElement.dataset.status
                    })
                }).then(() => carregarMetasCRM());
            }
        });
        col.setAttribute('init', 'true');
    });
}

window.produzirCardDireto = function (cardId, btnElement, event) {
    if (event) event.stopPropagation();

    if (btnElement.dataset.confirming === "true") {
        const card = allCardsCache.find(c => c.id == cardId);
        if (!card) return showToast("Erro: Card não encontrado.", "error");

        const cardElementHTML = btnElement.closest('.kanban-card');
        let extras = {};
        try { if (card.briefing_json) extras = (typeof card.briefing_json === 'string') ? JSON.parse(card.briefing_json) : card.briefing_json; } catch (e) { }

        let txt = "";
        if (extras.materiais) extras.materiais.forEach((d, i) => { txt += `--- Item ${i + 1} ---\nMaterial: ${d.descricao}\nDetalhes: ${d.detalhes}\n\n`; });

        // PEGA O VALOR DO CHECKBOX NOVO (COM FALLBACK PARA TRUE)
        const chkNotificar = document.getElementById('notificar-cliente');
        const notificarCliente = chkNotificar ? chkNotificar.checked : true;

        const payload = {
            sessionToken: localStorage.getItem('sessionToken'),
            titulo: card.titulo_automatico,
            servico: card.servico_tipo,
            arte: card.arte_origem,
            nomeCliente: card.nome_cliente,
            wppCliente: card.wpp_cliente,
            tipoEntrega: extras.tipo_entrega,
            briefingFormatado: txt,
            linkArquivo: extras.link_arquivo_drive || extras.link_arquivo || "",
            supervisaoWpp: extras.supervisao_wpp,
            valorDesigner: extras.valor_designer,
            formato: extras.formato,
            cdrVersao: extras.cdr_versao,
            notificarCliente: notificarCliente
        };

        if (cardElementHTML) cardElementHTML.classList.add('card-is-loading');

        fetch('/api/createDealForGrafica', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(res => res.json())
            .then(data => {
                if (data.dealId || data.success) {
                    return fetch('/api/crm/deleteCard', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), cardId: cardId })
                    });
                } else { throw new Error(data.message || "Erro na produção"); }
            })
            .then(() => {
                showToast('Enviado para Produção!', 'success');
                fecharPanel(); 
                carregarKanban();
                carregarMetasCRM();
            })
            .catch(err => {
                if (cardElementHTML) cardElementHTML.classList.remove('card-is-loading');
                showToast(err.message, 'error');
                btnElement.innerHTML = '<i class="fas fa-rocket"></i> PRODUZIR';
                btnElement.dataset.confirming = "false";
                btnElement.classList.remove('confirm-state');
            });

    } else {
        btnElement.dataset.confirming = "true";
        btnElement.innerHTML = '<i class="fas fa-exclamation"></i> Confirmar?';
        btnElement.classList.add('confirm-state');
        setTimeout(() => {
            btnElement.dataset.confirming = "false";
            btnElement.innerHTML = '<i class="fas fa-rocket"></i> PRODUZIR';
            btnElement.classList.remove('confirm-state');
        }, 3000);
    }
};

window.confirmarExclusaoCard = function (cardId, event) {
    if (event) event.stopPropagation();
    window.adminCustomDialog({
        type: 'confirm',
        title: 'Excluir Card',
        message: "Deseja realmente excluir este card permanentemente?",
        onConfirm: async () => {
            try {
                const res = await fetch('/api/crm/deleteCard', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), cardId: cardId })
                });
                if (res.ok) { showToast("Card excluído!", "success"); carregarKanban(); carregarMetasCRM(); }
                else { showToast("Erro ao excluir.", "error"); }
            } catch (err) { showToast("Erro de conexão.", "error"); }
        }
    });
};

document.getElementById('form-crm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const valorTotal = parseFloat(document.getElementById('crm-valor').value) || 0;
    if (valorTotal <= 0) {
        showToast("O Valor Total do pedido não pode ser zero.", "error");
        return;
    }

    let tituloInput = document.getElementById('crm-titulo-manual');
    if (tituloInput.value.trim() === '') {
        const codigoAleatorio = Math.floor(1000 + Math.random() * 9000);
        tituloInput.value = `PED-${codigoAleatorio}`;
        showToast(`Título vazio. Gerado código automático: ${tituloInput.value}`, 'success');
    }

    const btn = document.getElementById('btn-salvar-rascunho');
    const originalText = btn.innerText;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btn.disabled = true;

    const mats = [];
    document.querySelectorAll('.material-item').forEach(d => {
        const desc = d.querySelector('.mat-desc').value;
        if (desc) mats.push({ descricao: desc, detalhes: d.querySelector('.mat-det').value });
    });

    const payload = {
        sessionToken: localStorage.getItem('sessionToken'),
        id: document.getElementById('card-id-db').value,
        titulo_manual: tituloInput.value,
        nome_cliente: document.getElementById('crm-nome').value,
        wpp_cliente: document.getElementById('crm-wpp').value,
        servico_tipo: document.getElementById('pedido-servico-hidden').value,
        arte_origem: document.getElementById('pedido-arte-hidden').value,
        valor_orcamento: document.getElementById('crm-valor').value,
        valor_pago: document.getElementById('crm-valor-pago').value,
        valor_restante: document.getElementById('crm-valor-restante').value,
        briefing_json: JSON.stringify({
            tipo_entrega: document.getElementById('pedido-entrega-hidden').value,
            materiais: mats,
            link_arquivo: document.getElementById('link-arquivo').value || document.getElementById('link-arquivo-drive-arquivo').value,
            link_arquivo_drive: document.getElementById('link-arquivo-drive-arquivo').value || document.getElementById('link-arquivo-drive-setor').value || document.getElementById('link-arquivo-drive-proprio').value,
            supervisao_wpp: document.getElementById('pedido-supervisao').value,
            valor_designer: document.getElementById('valor-designer').value,
            formato: document.getElementById('pedido-formato').value,
            cdr_versao: document.getElementById('cdr-versao').value
        })
    };

    try {
        const res = await fetch('/api/crm/saveCard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            fecharPanel(); carregarKanban(); carregarMetasCRM();
            showToast('Salvo com sucesso!', 'success');
        } else { showToast('Erro ao salvar.', 'error'); }
    } catch (err) { showToast('Erro de conexão.', 'error'); }
    finally { btn.innerText = originalText; btn.disabled = false; }
});

window.abrirPanelEdicao = function (card) {
    resetarForm();
    document.getElementById('panel-titulo').innerText = 'Editar Oportunidade';
    document.getElementById('display-id-automatico').innerText = card.titulo_automatico || '';
    document.getElementById('card-id-db').value = card.id;
    document.getElementById('crm-titulo-manual').value = card.titulo_automatico || '';
    document.getElementById('crm-nome').value = card.nome_cliente;
    document.getElementById('crm-wpp').value = card.wpp_cliente;
    document.getElementById('crm-valor').value = card.valor_orcamento || 0;
    document.getElementById('crm-valor-pago').value = card.valor_pago || 0;
    calcularSaldoRestante();

    if (card.servico_tipo) {
        const el = document.querySelector(`#servico-grid .selection-card[onclick*="'${card.servico_tipo}'"]`);
        if (el) selectCard('servico', card.servico_tipo, el);
    }
    if (card.arte_origem) {
        const el = document.querySelector(`#arte-grid .selection-card[onclick*="'${card.arte_origem}'"]`);
        if (el) selectCard('arte', card.arte_origem, el);
    }

    let extras = {};
    try { if (card.briefing_json) extras = (typeof card.briefing_json === 'string') ? JSON.parse(card.briefing_json) : card.briefing_json; } catch (e) { }

    if (extras.tipo_entrega) {
        const el = document.querySelector(`#entrega-grid .selection-card[onclick*="'${extras.tipo_entrega}'"]`);
        if (el) selectCard('entrega', extras.tipo_entrega, el);
    }
    if (extras.link_arquivo) document.getElementById('link-arquivo').value = extras.link_arquivo;
    if (extras.supervisao_wpp) document.getElementById('pedido-supervisao').value = extras.supervisao_wpp;
    if (extras.valor_designer) document.getElementById('valor-designer').value = extras.valor_designer;
    if (extras.formato) document.getElementById('pedido-formato').value = extras.formato;
    if (extras.cdr_versao) document.getElementById('cdr-versao').value = extras.cdr_versao;

    const matContainer = document.getElementById('materiais-container');
    matContainer.innerHTML = '';
    if (extras.materiais && extras.materiais.length > 0) {
        extras.materiais.forEach(m => adicionarMaterialNoForm(m.descricao, m.detalhes));
    } else { adicionarMaterialNoForm(); }

    currentStep = 1;
    renderizarPasso();
    document.getElementById('slide-overlay').classList.add('active');
    document.getElementById('slide-panel').classList.add('active');
};

window.abrirPanelNovo = function () {
    resetarForm();
    document.getElementById('panel-titulo').innerText = 'Nova Oportunidade';
    document.getElementById('display-id-automatico').innerText = '# NOVO';
    currentStep = 1;
    renderizarPasso();
    adicionarMaterialNoForm();
    document.getElementById('slide-overlay').classList.add('active');
    document.getElementById('slide-panel').classList.add('active');
};

window.fecharPanel = function () {
    document.getElementById('slide-overlay').classList.remove('active');
    document.getElementById('slide-panel').classList.remove('active');
};

function resetarForm() {
    document.getElementById('form-crm').reset();
    document.getElementById('card-id-db').value = '';
    document.querySelectorAll('.selection-card').forEach(c => c.classList.remove('selected'));
    ['pedido-servico-hidden', 'pedido-arte-hidden', 'pedido-entrega-hidden'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('crm-valor').value = '0';
    document.getElementById('crm-valor-pago').value = '0';
    document.getElementById('crm-valor-restante').value = '0.00';
    document.getElementById('materiais-container').innerHTML = '';
    document.getElementById('arquivo-cliente-fields').classList.add('hidden');
    document.getElementById('setor-arte-fields').classList.add('hidden');
    const dp = document.getElementById('designer-proprio-fields');
    if (dp) dp.classList.add('hidden');
    
    ['arquivo','setor','proprio'].forEach(b => {
        const lr = document.getElementById('link-result-' + b);
        const lh = document.getElementById('link-arquivo-drive-' + b);
        if (lr) lr.style.display = 'none';
        if (lh) lh.value = '';
    });

    const chkNotificar = document.getElementById('notificar-cliente');
    if(chkNotificar) chkNotificar.checked = true;
}

function adicionarMaterialNoForm(desc = '', det = '') {
    const container = document.getElementById('materiais-container');
    const div = document.createElement('div');
    div.className = 'material-item';
    div.innerHTML = `
        <button type="button" class="btn-remove-material" onclick="this.closest('.material-item').remove()">
            <i class="fas fa-trash-alt"></i>
        </button>
        <div style="margin-bottom:10px">
            <input type="text" class="mat-desc form-control" value="${desc}" placeholder="Descrição do Material (Ex: Lona 440g)">
        </div>
        <div>
            <textarea class="mat-det form-control" rows="2" placeholder="Detalhes (Ex: Acabamento em ilhós, medida 1x2m)">${det}</textarea>
        </div>
    `;
    container.appendChild(div);
}

function calcularSaldoRestante() {
    const total = parseFloat(document.getElementById('crm-valor').value) || 0;
    const pago = parseFloat(document.getElementById('crm-valor-pago').value) || 0;
    const restante = total - pago;

    const inputRestante = document.getElementById('crm-valor-restante');
    if (!inputRestante) return;

    inputRestante.value = restante.toFixed(2);
    if (restante > 0) {
        inputRestante.style.color = '#e74c3c';
        inputRestante.style.backgroundColor = '#fff1f0';
    } else {
        inputRestante.style.color = '#27ae60';
        inputRestante.style.backgroundColor = '#f6ffed';
    }
}

function injectCleanStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .toast-message a { color: #e74c3c; font-weight: bold; text-decoration: underline; cursor: pointer; }
        .progress-fill.danger { background: linear-gradient(90deg, #e74c3c, #c0392b) !important; }
        .confirm-state { background: #e74c3c !important; color: white !important; }
        .kanban-card.card-is-loading {
            pointer-events: none !important;
            position: relative;
            overflow: hidden;
        }
        .kanban-card.card-is-loading::before {
            content: ""; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255, 255, 255, 0.85); z-index: 50;
        }
        .kanban-card.card-is-loading::after {
            content: "\\f110";
            font-family: "Font Awesome 6 Free"; font-weight: 900;
            position: absolute; top: 50%; left: 50%;
            transform: translate(-50%, -50%); font-size: 2.5rem;
            color: #27ae60; animation: fa-spin 1s infinite linear; z-index: 51;
        }
    `;
    document.head.appendChild(style);
}

function createToastContainer() {
    if (!document.querySelector('.toast-container')) {
        const div = document.createElement('div');
        div.className = 'toast-container';
        document.body.appendChild(div);
    }
}

function showToast(message, type = 'success', duration = 5000) {
    const container = document.querySelector('.toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div class="toast-message">${message}</div>`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, duration);
}

function configurarMascaras() {
    if (typeof IMask !== 'undefined') {
        ['crm-wpp', 'pedido-supervisao'].forEach(id => {
            const el = document.getElementById(id);
            if (el) IMask(el, { mask: '(00) 00000-0000' });
        });
    }
}

window.atualizarContadorArquivos = function (bloco) {
    const input = document.getElementById(`input-file-${bloco}`);
    const contador = document.getElementById(`count-${bloco}`);
    if (!input || !contador) return;
    const n = input.files.length;
    if (n === 0) contador.textContent = '';
    else if (n === 1) contador.textContent = `1 arquivo: ${input.files[0].name}`;
    else contador.textContent = `${n} arquivos selecionados`;
};

// Upload automático ao selecionar arquivos — sem botão extra
window.uploadAutomatico = async function (bloco) {
    const input = document.getElementById(`input-file-${bloco}`);
    if (!input || !input.files.length) return;

    // Atualiza contador
    atualizarContadorArquivos(bloco);

    // Mostra spinner no label
    const label = document.getElementById(`label-upload-${bloco}`);
    if (label) {
        label.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Enviando...</span>';
        label.style.pointerEvents = 'none';
    }

    // Chama o upload
    await uploadParaGoogleDrive(bloco);

    // Restaura label com check verde se sucesso, ou volta ao normal
    if (label) {
        const linkHidden = document.getElementById(`link-arquivo-drive-${bloco}`);
        if (linkHidden && linkHidden.value) {
            label.innerHTML = '<i class="fas fa-check-circle" style="color:#16a34a"></i> <span>Anexado! Clique para trocar</span>';
        } else {
            label.innerHTML = '<i class="fas fa-paperclip"></i> <span>Clique para anexar arquivo(s)</span>';
        }
        label.style.pointerEvents = '';
    }
};

// Função para atualizar a barra de progresso (Adicionado a pedido do usuário)
window.updateProgressBar = function (bloco, percent) {
    const container = document.getElementById(`progress-container-${bloco}`);
    const fill = document.getElementById(`progress-fill-${bloco}`);
    const text = document.getElementById(`progress-text-${bloco}`);

    if (container) container.style.display = 'block';
    if (fill) fill.style.width = percent + '%';
    if (text) text.innerText = percent + '%';

    // Se chegar em 100, aguarda um pouco e oculta
    if (percent >= 100) {
        setTimeout(() => {
            if (container) container.style.display = 'none';
            if (fill) fill.style.width = '0%';
        }, 3000);
    }
};

window.uploadParaGoogleDrive = async function (bloco) {
    const input = document.getElementById(`input-file-${bloco}`);
    const btn = document.getElementById(`btn-upload-${bloco}`);
    const linkResult = document.getElementById(`link-result-${bloco}`);
    const linkUrl = document.getElementById(`link-url-${bloco}`);
    const linkHidden = document.getElementById(`link-arquivo-drive-${bloco}`);
    const sessionToken = localStorage.getItem('sessionToken');

    if (!input || !input.files.length) { showToast('Selecione pelo menos um arquivo.', 'error'); return; }

    const tituloPedido = document.getElementById('crm-titulo-manual') ? document.getElementById('crm-titulo-manual').value : 'Pedido';
    btn.disabled = true;
    // btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    
    // Inicia a barra de progresso
    updateProgressBar(bloco, 0);

    const uploadedUrls = [];

    try {
        const { upload } = await import('https://esm.sh/@vercel/blob@2.3.1/client');
        const safeTitle = (tituloPedido || 'pedido').replace(/[^a-zA-Z0-9_-]/g, '_');

        let fileToUpload;
        let uploadPathname;

        if (input.files.length === 1) {
            // Arquivo único — envia diretamente
            fileToUpload = input.files[0];
            uploadPathname = `uploads/${safeTitle}/${Date.now()}-${fileToUpload.name}`;
            // btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Enviando arquivo...`;
        } else {
            // Múltiplos arquivos — compacta em ZIP antes de enviar
            // btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Compactando ${input.files.length} arquivos...`;
            const JSZip = (await import('https://esm.sh/jszip@3.10.1')).default;
            const zip = new JSZip();

            for (let i = 0; i < input.files.length; i++) {
                const f = input.files[i];
                const arrayBuf = await f.arrayBuffer();
                zip.file(f.name, arrayBuf);
            }

            const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
            fileToUpload = new File([zipBlob], `${safeTitle}-anexos.zip`, { type: 'application/zip' });
            uploadPathname = `uploads/${safeTitle}/${Date.now()}-${safeTitle}-anexos.zip`;
            // btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Enviando ZIP...`;
        }

        const blob = await upload(uploadPathname, fileToUpload, {
            access: 'public',
            handleUploadUrl: '/api/upload/blob',
            clientPayload: JSON.stringify({ sessionToken: sessionToken }),
            onUploadProgress: (progress) => {
                updateProgressBar(bloco, progress.percentage);
            }
        });

        uploadedUrls.push(blob.url);

        // Sucesso — monta o link final
        const finalLink = blob.url;

        linkUrl.href = blob.url;
        linkUrl.textContent = blob.url.length > 60 ? blob.url.substring(0, 60) + '...' : blob.url;
        linkResult.style.display = 'flex';
        if (linkHidden) linkHidden.value = finalLink;
        if (bloco === 'arquivo') {
            const el = document.getElementById('link-arquivo');
            if (el && !el.value) el.value = finalLink;
        }
        const msg = input.files.length === 1
            ? '1 arquivo enviado com sucesso!'
            : `${input.files.length} arquivos compactados e enviados com sucesso!`;
        showToast(msg, 'success');

    } catch (e) {
        console.error('[Upload Blob] Erro:', e);
        showToast(e.message || 'Erro de conexão ao fazer upload.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-arrow-up"></i> Enviar Arquivos';
    }
};