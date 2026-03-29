// carteira-script.js - VERSÃO CONTA CORRENTE (LEDGER) SEM ALERTS NATIVOS

document.addEventListener('DOMContentLoaded', () => {
    carregarAcertosGrafica();
});

const fmtMoeda = (valor) => parseFloat(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- UTILITÁRIOS DE MODAL CUSTOMIZADO ---
window.customAlert = (mensagem, isError = false) => {
    const id = 'alert-' + Date.now();
    const cor = isError ? '#ef4444' : '#10b981';
    const icone = isError ? 'fa-times-circle' : 'fa-check-circle';
    const titulo = isError ? 'Erro' : 'Sucesso';
    const html = `
        <div id="${id}" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:999999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(2px);">
            <div style="background:white; padding:30px; border-radius:12px; width:90%; max-width:350px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.2); animation: popIn 0.3s ease;">
                <div style="font-size:3rem; color:${cor}; margin-bottom:15px;"><i class="fas ${icone}"></i></div>
                <h3 style="margin:0 0 10px 0; color:#1e293b; font-family:'Poppins', sans-serif;">${titulo}</h3>
                <p style="color:#64748b; font-size:0.95rem; margin-bottom:25px; line-height:1.5; font-family:'Poppins', sans-serif;">${mensagem}</p>
                <button onclick="document.getElementById('${id}').remove()" style="width:100%; padding:12px; border:none; border-radius:8px; background:${cor}; color:white; font-weight:600; cursor:pointer; font-family:'Poppins', sans-serif;">Entendi</button>
            </div>
        </div>
        <style>@keyframes popIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }</style>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.customConfirm = (mensagem, callbackSim) => {
    const id = 'confirm-' + Date.now();
    const html = `
        <div id="${id}" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:999999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(2px);">
            <div style="background:white; padding:30px; border-radius:12px; width:90%; max-width:400px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.2); animation: popIn 0.3s ease;">
                <div style="font-size:3rem; color:#f59e0b; margin-bottom:15px;"><i class="fas fa-exclamation-triangle"></i></div>
                <h3 style="margin:0 0 10px 0; color:#1e293b; font-family:'Poppins', sans-serif;">Atenção</h3>
                <p style="color:#64748b; font-size:0.95rem; margin-bottom:25px; line-height:1.5; font-family:'Poppins', sans-serif;">${mensagem}</p>
                <div style="display:flex; gap:10px;">
                    <button onclick="document.getElementById('${id}').remove()" style="flex:1; padding:12px; border:none; border-radius:8px; background:#f1f5f9; color:#475569; font-weight:600; cursor:pointer; font-family:'Poppins', sans-serif;">Cancelar</button>
                    <button id="btn-sim-${id}" style="flex:1; padding:12px; border:none; border-radius:8px; background:#10b981; color:white; font-weight:600; cursor:pointer; font-family:'Poppins', sans-serif;">Sim, Continuar</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById(`btn-sim-${id}`).onclick = () => {
        document.getElementById(id).remove();
        callbackSim();
    };
};
// ------------------------------------------

async function carregarAcertosGrafica() {
    const token = localStorage.getItem('sessionToken');
    if (!token) return window.location.href = '/login.html';

    try {
        const resDados = await fetch('/api/carteira/dados', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: token })
        });
        const d = await resDados.json();

        document.getElementById('val-andamento').innerText = fmtMoeda(d.saldo_pendente);
        document.getElementById('val-pagar').innerText = fmtMoeda(d.saldo_em_analise);
        document.getElementById('val-saldo').innerText = fmtMoeda(d.pago_mes);

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

        const grupos = {};
        data.extrato.forEach(item => {
            const desId = item.designer_id;
            if (!grupos[desId]) grupos[desId] = { id: desId, nome: item.designer, pix: item.pix, totalPendente: 0, totalEmAnalise: 0, itens: [] };
            grupos[desId].itens.push(item);

            if (item.status === 'PENDENTE' && !item.is_pagamento) grupos[desId].totalPendente += item.valor;
            if (item.status === 'AGUARDANDO_CONFIRMACAO' && item.is_pagamento) grupos[desId].totalEmAnalise += item.valor;
        });

        Object.values(grupos).forEach((grupo, idx) => {
            const designerIdStr = `designer-${grupo.id}`;
            const li = document.createElement('li');
            li.style.cssText = "border-bottom: 1px solid #f1f5f9; list-style: none;";

            let dividaRestante = grupo.totalPendente - grupo.totalEmAnalise;
            if (dividaRestante < 0) dividaRestante = 0;

            let bgStyle = "background: #fff;";
            let acaoHtml = "-";

            if (dividaRestante > 0) {
                bgStyle = "background: #fffcf8;";
                acaoHtml = `<button onclick="abrirModalPagamento(${grupo.id}, '${grupo.nome}', '${grupo.pix}', ${dividaRestante})" class="btn-add-mini" style="background:#2ecc71; margin: 0 auto;">ENVIAR PIX</button>`;
            } else if (grupo.totalEmAnalise > 0) {
                bgStyle = "background: #f0fdf4;";
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
                    <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 10px; text-transform: uppercase;">Extrato de Movimentações</div>
                    ${grupo.itens.map(item => {
                let rowColor = item.is_pagamento ? "color: #27ae60;" : "color: #c0392b;";
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
    } catch (err) { console.error(err); }
}

window.toggleDetalhes = (id) => {
    const el = document.getElementById(`detalhes-${id}`);
    const icon = document.getElementById(`icon-${id}`);
    if (el.style.display === 'none') { el.style.display = 'block'; icon.style.transform = 'rotate(90deg)'; }
    else { el.style.display = 'none'; icon.style.transform = 'rotate(0deg)'; }
}

window.abrirModal = (id) => document.getElementById(id).classList.add('active');
window.fecharModal = (id) => document.getElementById(id).classList.remove('active');

window.abrirModalPagamento = (designerId, designerNome, pix, valorSugerido) => {
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

    IMask(document.getElementById('input-valor-pix'), {
        mask: Number, scale: 2, thousandsSeparator: '.', padFractionalZeros: true, normalizeZeros: true, radix: ',', mapToRadix: ['.']
    });

    abrirModal('modal-pagamento');
}

window.confirmarEnvioPagamento = (designerId) => {
    const inputValor = document.getElementById('input-valor-pix').value.trim();
    const arquivo = document.getElementById('arquivo-comprovante').files[0];

    if (!inputValor || inputValor === '0,00') {
        customAlert('Informe um valor válido maior que zero.', true);
        return;
    }

    const processarPagamento = async () => {
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
            const res = await fetch('/api/carteira/informarPagamento', { method: 'POST', body: formData });
            const data = await res.json();

            if (res.ok) {
                fecharModal('modal-pagamento');
                customAlert("Pagamento enviado para aprovação do Designer!");
                carregarAcertosGrafica();
            } else {
                customAlert(data.message, true);
                btn.disabled = false;
                btn.innerHTML = `<i class="fas fa-paper-plane"></i> INFORMAR PAGAMENTO`;
            }
        } catch (e) {
            customAlert("Erro na conexão ao informar pagamento.", true);
            btn.disabled = false;
            btn.innerHTML = `<i class="fas fa-paper-plane"></i> INFORMAR PAGAMENTO`;
        }
    };

    if (!arquivo) {
        customConfirm("Deseja avisar o designer sem anexar o comprovante? Ele poderá recusar o pagamento se não localizar em sua conta.", processarPagamento);
    } else {
        processarPagamento();
    }
}