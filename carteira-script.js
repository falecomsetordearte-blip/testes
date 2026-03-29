// carteira-script.js - VERSÃO CONTA CORRENTE (LEDGER)

document.addEventListener('DOMContentLoaded', () => {
    console.log('[INIT] Carteira carregada.');
    carregarAcertosGrafica();
});

const fmtMoeda = (valor) => parseFloat(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function carregarAcertosGrafica() {
    const token = localStorage.getItem('sessionToken');
    if (!token) return window.location.href = '/login.html';

    try {
        console.log('[API] Buscando Totais...');
        const resDados = await fetch('/api/carteira/dados', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: token })
        });
        const d = await resDados.json();

        // Atualiza os Cards do Topo
        document.getElementById('val-andamento').innerText = fmtMoeda(d.saldo_pendente);
        document.getElementById('val-pagar').innerText = fmtMoeda(d.saldo_em_analise);
        document.getElementById('val-saldo').innerText = fmtMoeda(d.pago_mes);

        console.log('[API] Buscando Extrato Detalhado...');
        const lista = document.getElementById('lista-historico');
        lista.innerHTML = '<li style="text-align:center; padding:20px; color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> Carregando extrato...</li>';

        const resExtrato = await fetch('/api/carteira/extrato', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: token })
        });
        const data = await resExtrato.json();
        lista.innerHTML = '';

        if (!data.extrato || data.extrato.length === 0) {
            lista.innerHTML = '<li style="text-align:center; padding:20px; color:#94a3b8;">Nenhum débito ou movimentação recente.</li>';
            return;
        }

        // --- LÓGICA DE AGRUPAMENTO (CONTA CORRENTE) ---
        const grupos = {};

        data.extrato.forEach(item => {
            const desId = item.designer_id;
            if (!grupos[desId]) {
                grupos[desId] = {
                    id: desId,
                    nome: item.designer,
                    pix: item.pix,
                    totalPendente: 0, // Dívida Real
                    totalEmAnalise: 0, // Pagamentos esperando aprovação
                    itens: []
                };
            }

            grupos[desId].itens.push(item);

            // Artes que ainda não foram pagas entram como Dívida (+)
            if (item.status === 'PENDENTE' && !item.is_pagamento) {
                grupos[desId].totalPendente += item.valor;
            }
            // Pagamentos enviados que o designer não clicou em Confirmar ainda (-)
            if (item.status === 'AGUARDANDO_CONFIRMACAO' && item.is_pagamento) {
                grupos[desId].totalEmAnalise += item.valor;
            }
        });

        // Renderiza cada Designer como um "Banco"
        Object.values(grupos).forEach((grupo, idx) => {
            const designerIdStr = `designer-${grupo.id}`;
            const li = document.createElement('li');
            li.style.cssText = "border-bottom: 1px solid #f1f5f9; list-style: none;";

            // Calcula o Saldo Líquido que a gráfica ainda deve a ele
            let dividaRestante = grupo.totalPendente - grupo.totalEmAnalise;
            if (dividaRestante < 0) dividaRestante = 0; // Crédito extra não exibe negativo na tela da gráfica

            let bgStyle = "background: #fff;";
            let acaoHtml = "-";

            if (dividaRestante > 0) {
                bgStyle = "background: #fffcf8;"; // Fundo laranjinha fraco
                acaoHtml = `<button onclick="abrirModalPagamento(${grupo.id}, '${grupo.nome}', '${grupo.pix}', ${dividaRestante})" class="btn-add-mini" style="background:#2ecc71; margin: 0 auto;">ENVIAR PIX</button>`;
            } else if (grupo.totalEmAnalise > 0) {
                bgStyle = "background: #f0fdf4;"; // Fundo verde fraco
                acaoHtml = `<span style="font-size:0.75rem; color:#16a34a; font-weight:700;"><i class="fas fa-clock"></i> AGUARDANDO DESIGNER</span>`;
            } else {
                acaoHtml = `<span style="color:#27ae60; font-size:0.8rem; font-weight:700;"><i class="fas fa-check-double"></i> QUITE</span>`;
            }

            li.innerHTML = `
                <div style="display: grid; grid-template-columns: 2.5fr 1fr 1fr 1fr 1.5fr; gap: 10px; padding: 15px 10px; align-items: center; cursor:pointer; ${bgStyle}" onclick="toggleDetalhes('${designerIdStr}')">
                    <div>
                        <div style="font-weight:700; color: #1e293b; font-size: 0.95rem;">
                            <i class="fas fa-chevron-right" id="icon-${designerIdStr}" style="margin-right:8px; transition: 0.2s; color:#94a3b8;"></i> ${grupo.nome}
                        </div>
                    </div>
                    <div><div style="font-size:0.75rem; color:#2980b9; font-weight: 600; word-break: break-all;">${grupo.pix || 'N/A'}</div></div>
                    <div style="text-align:right; font-weight:800; color:#c0392b;">${fmtMoeda(dividaRestante)}</div>
                    <div style="text-align:right; font-weight:700; color:#f39c12;">${fmtMoeda(grupo.totalEmAnalise)}</div>
                    <div style="text-align:center;" onclick="event.stopPropagation()">${acaoHtml}</div>
                </div>
                
                <div id="detalhes-${designerIdStr}" style="display:none; background: #f8fafc; padding: 15px 20px 15px 40px; border-top: 1px solid #edf2f7; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 10px; text-transform: uppercase;">Extrato de Movimentações (Ativas)</div>
                    ${grupo.itens.map(item => {
                let rowColor = item.is_pagamento ? "color: #27ae60;" : "color: #c0392b;"; // Verde para pagamentos, Vermelho para dívidas de artes
                let prefixoValor = item.is_pagamento ? "- " : "+ ";
                let statusBadge = "";

                if (item.status === 'PENDENTE') statusBadge = `<span class="badge-status badge-producao">A PAGAR</span>`;
                else if (item.status === 'AGUARDANDO_CONFIRMACAO') statusBadge = `<span class="badge-status badge-analise">AGUARDANDO APROVAÇÃO</span>`;
                else if (item.status === 'RECUSADO') statusBadge = `<span class="badge-status badge-producao">RECUSADO PELO DESIGNER</span>`;
                else statusBadge = `<span class="badge-status badge-finalizado">${item.status}</span>`;

                return `
                            <div style="display: grid; grid-template-columns: 2.5fr 1fr 1fr 1fr; gap: 10px; padding: 10px 0; border-bottom: 1px dashed #e2e8f0; font-size:0.85rem; align-items: center;">
                                <div>
                                    <span style="font-weight:600; color:#334155;">${item.descricao}</span>
                                    ${item.comprovante_url ? `<a href="${item.comprovante_url}" target="_blank" style="margin-left:8px; color:#3498db; font-size:0.75rem;"><i class="fas fa-file-invoice"></i> Ver Recibo</a>` : ''}
                                </div>
                                <div style="color:#888;">${new Date(item.data).toLocaleDateString()}</div>
                                <div>${statusBadge}</div>
                                <div style="text-align:right; font-weight:700; ${rowColor}">${prefixoValor}${fmtMoeda(item.valor)}</div>
                            </div>
                        `;
            }).join('')}
                </div>
            `;
            lista.appendChild(li);
        });

    } catch (err) {
        console.error('[ERRO] Falha ao renderizar carteira:', err);
    }
}

window.toggleDetalhes = (id) => {
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

window.abrirModal = (id) => document.getElementById(id).classList.add('active');
window.fecharModal = (id) => document.getElementById(id).classList.remove('active');

// Modal para informar um pagamento Avulso
window.abrirModalPagamento = (designerId, designerNome, pix, valorSugerido) => {
    console.log(`[PAGAMENTO] Abrindo modal para Designer ${designerId} - Sugestão: ${valorSugerido}`);
    document.getElementById('modal-pag-titulo').innerText = `Enviar Pagamento para ${designerNome}`;

    const corpo = `
        <div style="text-align:center; padding: 10px 0;">
            <div style="background:#f1f5f9; padding:15px; border-radius:8px; margin-bottom:20px; text-align: left;">
                <div style="font-size:0.8rem; color:#64748b; margin-bottom:5px; font-weight: 600;">CHAVE PIX DO DESIGNER:</div>
                <div style="font-weight:800; font-size:1.1rem; color:#2980b9; word-break:break-all;">${pix || 'NÃO CADASTRADA'}</div>
            </div>
            
            <div style="text-align: left; margin-bottom: 15px;">
                <label style="font-size:0.85rem; font-weight:600; color:#475569;">Valor da Transferência (R$):</label>
                <input type="text" id="input-valor-pix" class="form-control input-moeda" value="${valorSugerido.toFixed(2).replace('.', ',')}" style="font-size: 1.2rem; font-weight: 700; color: #27ae60;">
                <small style="color:#94a3b8; font-size: 0.75rem;">Você pode apagar e informar um valor parcial se preferir.</small>
            </div>

            <div style="text-align: left;">
                <label style="font-size:0.85rem; font-weight:600; color:#475569;">Anexe o Comprovante (Imagem/PDF):</label>
                <input type="file" id="arquivo-comprovante" class="form-control" style="margin-top:5px; padding: 8px;" accept="image/*,application/pdf">
            </div>
        </div>
    `;

    const rodape = `<button onclick="confirmarEnvioPagamento('${designerId}')" id="btn-confirmar-pag" class="btn-submit btn-pay"><i class="fas fa-paper-plane"></i> INFORMAR PAGAMENTO</button>`;

    document.getElementById('modal-pag-corpo').innerHTML = corpo;
    document.getElementById('modal-pag-rodape').innerHTML = rodape;

    // Aplica a máscara de moeda no input
    IMask(document.getElementById('input-valor-pix'), {
        mask: Number, scale: 2, thousandsSeparator: '.', padFractionalZeros: true, normalizeZeros: true, radix: ',', mapToRadix: ['.']
    });

    abrirModal('modal-pagamento');
}

window.confirmarEnvioPagamento = async (designerId) => {
    const inputValor = document.getElementById('input-valor-pix').value.trim();
    const arquivo = document.getElementById('arquivo-comprovante').files[0];

    if (!inputValor || inputValor === '0,00') return alert('Informe um valor válido maior que zero.');
    if (!arquivo) {
        if (!confirm("Tem certeza que deseja avisar o designer sem anexar o comprovante? Ele poderá recusar o pagamento.")) return;
    }

    const btn = document.getElementById('btn-confirmar-pag');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Enviando...`;

    const token = localStorage.getItem('sessionToken');
    const formData = new FormData();
    formData.append('sessionToken', token);
    formData.append('designerId', designerId);
    formData.append('valor', inputValor);
    if (arquivo) formData.append('comprovanteFile', arquivo);

    try {
        console.log(`[PAGAMENTO] Disparando requisição para salvar PIX de R$${inputValor}...`);
        const res = await fetch('/api/carteira/informarPagamento', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (res.ok) {
            console.log('[PAGAMENTO] Sucesso!');
            fecharModal('modal-pagamento');

            // Exibe notificação suave
            const div = document.createElement('div');
            div.style.cssText = "position:fixed; top:20px; right:20px; background:#2ecc71; color:white; padding:15px 25px; border-radius:8px; font-weight:600; box-shadow:0 4px 15px rgba(0,0,0,0.2); z-index:99999;";
            div.innerText = "Pagamento enviado para aprovação do Designer!";
            document.body.appendChild(div);
            setTimeout(() => div.remove(), 4000);

            // Recarrega a tela
            carregarAcertosGrafica();
        } else {
            alert("Erro: " + data.message);
            btn.disabled = false;
            btn.innerHTML = `<i class="fas fa-paper-plane"></i> INFORMAR PAGAMENTO`;
        }
    } catch (e) {
        console.error(e);
        alert("Erro na conexão ao informar pagamento.");
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-paper-plane"></i> INFORMAR PAGAMENTO`;
    }
}