// carteira-script.js

document.addEventListener('DOMContentLoaded', () => {
    const hoje = new Date();
    const passado = new Date();
    passado.setDate(passado.getDate() - 30);
    const inputFim = document.getElementById('filtro-fim');
    const inputInicio = document.getElementById('filtro-inicio');
    if (inputFim) inputFim.valueAsDate = hoje;
    if (inputInicio) inputInicio.valueAsDate = passado;

    carregarAcertosGrafica();
});

const fmtMoeda = (valor) => parseFloat(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function carregarAcertosGrafica() {
    const token = localStorage.getItem('sessionToken');
    if (!token) return window.location.href = '/login.html';

    try {
        // 1. Carregar Totais
        const resDados = await fetch('/api/carteira/dados', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: token })
        });
        const d = await resDados.json();
        document.getElementById('val-andamento').innerText = fmtMoeda(d.saldo_pendente);
        document.getElementById('val-pagar').innerText = fmtMoeda(d.saldo_atrasado);
        document.getElementById('val-saldo').innerText = fmtMoeda(d.pago_mes);

        // 2. Carregar Lista
        const dataInicio = document.getElementById('filtro-inicio').value;
        const dataFim = document.getElementById('filtro-fim').value;
        const lista = document.getElementById('lista-historico');
        lista.innerHTML = '<li style="text-align:center; padding:20px; color:#94a3b8;">Buscando...</li>';

        const resExtrato = await fetch('/api/carteira/extrato', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: token, dataInicio, dataFim })
        });
        const data = await resExtrato.json();
        lista.innerHTML = '';

        if (!data.extrato || data.extrato.length === 0) {
            lista.innerHTML = '<li style="text-align:center; padding:20px;">Nenhum acerto pendente ou pago no período.</li>';
            return;
        }

        // --- LÓGICA DE AGRUPAMENTO POR DESIGNER ---
        const grupos = {};
        data.extrato.forEach(item => {
            if (!grupos[item.designer]) {
                grupos[item.designer] = {
                    nome: item.designer,
                    pix: item.pix,
                    totalPendente: 0,
                    itens: []
                };
            }
            grupos[item.designer].itens.push(item);
            if (item.status !== 'PAGO') {
                grupos[item.designer].totalPendente += item.valor;
            }
        });

        Object.values(grupos).forEach((grupo, idx) => {
            const designerId = `designer-${idx}`;
            const li = document.createElement('li');
            li.style.cssText = "border-bottom: 1px solid #f1f5f9; list-style: none;";
            
            const temPendente = grupo.totalPendente > 0;
            const statusGeral = temPendente ? 'PENDENTE' : 'PAGO';
            let statusHtml = `<span class="badge-status badge-producao">${statusGeral}</span>`;
            if(!temPendente) statusHtml = `<span class="badge-status badge-finalizado">PAGO</span>`;

            let acaoHtml = '-';
            if(temPendente) {
                const idsPendenes = grupo.itens.filter(i => i.status !== 'PAGO').map(i => i.id).join(',');
                acaoHtml = `<button onclick="abrirModalPagamento('${idsPendenes}', '${grupo.nome}', '${grupo.pix}', ${grupo.totalPendente})" class="btn-add-mini" style="background:#2ecc71; font-size:0.7rem;">PAGAR TUDO</button>`;
            } else {
                acaoHtml = `<span style="color:#27ae60; font-size:0.75rem;"><i class="fas fa-check"></i> OK</span>`;
            }

            li.innerHTML = `
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 10px; padding: 15px 10px; align-items: center; cursor:pointer; background: #fff;" onclick="toggleDetalhes('${designerId}')">
                    <div>
                        <div style="font-weight:700; color: #1e293b;"><i class="fas fa-chevron-right" id="icon-${designerId}" style="margin-right:8px; transition: 0.2s;"></i> ${grupo.nome}</div>
                        <div style="font-size:0.75rem; color:#888;">${grupo.itens.length} pedido(s) no período</div>
                    </div>
                    <div><div style="font-size:0.7rem; color:#2980b9;">PIX: ${grupo.pix || 'Não informado'}</div></div>
                    <div>${statusHtml}</div>
                    <div style="text-align:right; font-weight:700;">${fmtMoeda(grupo.totalPendente || grupo.itens.reduce((acc, i) => acc + i.valor, 0))}</div>
                    <div style="text-align:center;" onclick="event.stopPropagation()">${acaoHtml}</div>
                </div>
                <div id="detalhes-${designerId}" style="display:none; background: #f8fafc; padding: 10px 10px 10px 40px; border-top: 1px solid #edf2f7;">
                    ${grupo.itens.map(item => `
                        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 10px; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; font-size:0.85rem; align-items: center;">
                            <div><span style="font-weight:600;">#${item.id}</span> - ${item.descricao}</div>
                            <div style="color:#888;">${new Date(item.data).toLocaleDateString()}</div>
                            <div><span class="badge-status ${item.status === 'PAGO' ? 'badge-finalizado' : 'badge-entrada'}" style="font-size:0.65rem;">${item.status}</span></div>
                            <div style="text-align:right; font-weight:600;">${fmtMoeda(item.valor)}</div>
                        </div>
                    `).join('')}
                </div>
            `;
            lista.appendChild(li);
        });
    } catch (err) { console.error(err); }
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

window.abrirModalPagamento = (ids, designer, pix, valor) => {
    const corpo = `
        <div style="text-align:center; padding: 10px;">
            <p style="margin-bottom:15px; color:#444;">Transfira via <strong>PIX</strong> direto para o designer abaixo:</p>
            <div style="background:#f1f5f9; padding:15px; border-radius:8px; margin-bottom:20px;">
                <div style="font-size:0.8rem; color:#64748b; margin-bottom:5px;">DESIGNER:</div>
                <div style="font-weight:700; font-size:1.1rem; color:#1e293b; margin-bottom:10px;">${designer}</div>
                <div style="font-size:0.8rem; color:#64748b; margin-bottom:5px;">CHAVE PIX:</div>
                <div style="font-weight:800; font-size:1.2rem; color:#2980b9; word-break:break-all;">${pix || 'NÃO CADASTRADA'}</div>
            </div>
            <div style="font-size:1.5rem; font-weight:800; color:#27ae60; margin-bottom:20px;">${fmtMoeda(valor)}</div>
            <hr>
            <p style="font-size:0.85rem; color:#666; margin-top:15px;">Já fez o pagamento? Anexe o comprovante (Opcional):</p>
            <input type="file" id="arquivo-comprovante" class="form-control" style="margin-top:10px;" accept="image/*,application/pdf">
            <p style="font-size:0.85rem; color:#666; margin-top:10px;">Ou informe o link (ex: Drive/Imgur):</p>
            <input type="url" id="link-comprovante" class="form-control" placeholder="Link do comprovante..." style="margin-top:5px;">
        </div>
    `;
    const rodape = `<button onclick="confirmarPagamentoMultiplo('${ids}')" id="btn-confirmar-pag" class="btn-submit btn-pay">MARCAR COMO PAGO</button>`;
    
    if(window.abrirGaveta) {
        window.abrirGaveta("Pagamento Direto", corpo, rodape);
    } else {
        alert(`Pague PIX para ${designer}: ${pix}\nValor: ${fmtMoeda(valor)}`);
    }
}

async function confirmarPagamentoMultiplo(ids) {
    const link = document.getElementById('link-comprovante').value;
    const arquivo = document.getElementById('arquivo-comprovante').files[0];
    
    if(!link && !arquivo) {
        if(!confirm("Deseja marcar como pago sem anexar comprovante?")) return;
    }

    const btn = document.getElementById('btn-confirmar-pag');
    btn.disabled = true;
    btn.innerText = "Processando...";
    
    const token = localStorage.getItem('sessionToken');
    const formData = new FormData();
    formData.append('sessionToken', token);
    formData.append('acertoIds', ids);
    if(link) formData.append('comprovanteUrl', link);
    if(arquivo) formData.append('comprovanteFile', arquivo);

    try {
        const res = await fetch('/api/carteira/informarPagamento', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if(res.ok) {
            alert("Pagamento registrado com sucesso!");
            if(window.fecharGaveta) window.fecharGaveta();
            carregarAcertosGrafica();
        } else {
            alert("Erro: " + data.message);
        }
    } catch(e) { 
        console.error(e);
        alert("Erro ao informar pagamento."); 
    } finally {
        btn.disabled = false;
        btn.innerText = "MARCAR COMO PAGO";
    }
}