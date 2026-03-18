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

        data.extrato.forEach(item => {
            const li = document.createElement('li');
            li.style.cssText = "display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 10px; padding: 15px 10px; border-bottom: 1px solid #f1f5f9; align-items: center;";
            
            let statusHtml = `<span class="badge-status badge-producao">${item.status}</span>`;
            if(item.status === 'PAGO') statusHtml = `<span class="badge-status badge-finalizado">PAGO</span>`;
            else if(item.status === 'PENDENTE') statusHtml = `<span class="badge-status badge-entrada">PENDENTE</span>`;

            let acaoHtml = '-';
            if(item.status !== 'PAGO') {
                acaoHtml = `<button onclick="abrirModalPix(${item.id}, '${item.designer}', '${item.pix}', ${item.valor})" class="btn-add-mini" style="background:#2ecc71; font-size:0.7rem;">PAGAR PIX</button>`;
            } else {
                acaoHtml = `<span style="color:#27ae60; font-size:0.75rem;"><i class="fas fa-check"></i> OK</span>`;
            }

            li.innerHTML = `
                <div><div style="font-weight:600;">#${item.id} - ${item.descricao}</div><div style="font-size:0.75rem; color:#888;">${new Date(item.data).toLocaleDateString()}</div></div>
                <div><div style="font-weight:600;">${item.designer}</div><div style="font-size:0.7rem; color:#2980b9;">PIX: ${item.pix || 'Não informado'}</div></div>
                <div>${statusHtml}</div>
                <div style="text-align:right; font-weight:700;">${fmtMoeda(item.valor)}</div>
                <div style="text-align:center;">${acaoHtml}</div>
            `;
            lista.appendChild(li);
        });
    } catch (err) { console.error(err); }
}

window.abrirModalPix = (id, designer, pix, valor) => {
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
            <p style="font-size:0.85rem; color:#666; margin-top:15px;">Já fez o pagamento? Informe o link do comprovante (ex: Drive/Imgur):</p>
            <input type="url" id="link-comprovante" class="form-control" placeholder="Link do comprovante..." style="margin-top:10px;">
        </div>
    `;
    const rodape = `<button onclick="confirmarPagamentoInformado(${id})" class="btn-submit btn-pay">INFORMAR QUE PAGUEI</button>`;
    
    // Usando a gaveta ou modal do layout se disponível
    if(window.abrirGaveta) {
        window.abrirGaveta("Pagamento Direto", corpo, rodape);
    } else {
        alert(`Pague PIX para ${designer}: ${pix}\nValor: ${fmtMoeda(valor)}`);
    }
}

async function confirmarPagamentoInformado(id) {
    const link = document.getElementById('link-comprovante').value;
    if(!link) return alert("Por favor, informe o link do comprovante.");
    
    const token = localStorage.getItem('sessionToken');
    try {
        const res = await fetch('/api/carteira/informarPagamento', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: token, acertoId: id, comprovanteUrl: link })
        });
        if(res.ok) {
            alert("Pagamento informado! O status será atualizado.");
            if(window.fecharGaveta) window.fecharGaveta();
            carregarAcertosGrafica();
        }
    } catch(e) { alert("Erro ao informar pagamento."); }
}