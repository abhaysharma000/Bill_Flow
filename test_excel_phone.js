const http = require('http');

async function test() {
    const list = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9222/json', (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });

    const page = list.find(p => p.type === 'page');
    if (!page) throw new Error('No page target found: ' + JSON.stringify(list));
    console.log('Connecting to:', page.title);

    const ws = new WebSocket(page.webSocketDebuggerUrl.replace('localhost', '127.0.0.1'));
    let id = 1;
    const pending = new Map();
    ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id && pending.has(msg.id)) {
            const cb = pending.get(msg.id);
            pending.delete(msg.id);
            cb(msg);
        }
    };
    function send(method, params = {}) {
        return new Promise(r => {
            const reqId = id++;
            pending.set(reqId, r);
            ws.send(JSON.stringify({ id: reqId, method, params }));
        });
    }

    await new Promise(r => ws.onopen = r);
    await send('Runtime.enable');

    async function evaluate(expression) {
        const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (res.result?.exceptionDetails) {
            console.error('Eval error:', res.result.exceptionDetails);
        }
        return res.result?.result?.value;
    }

    // 1. Check XLSX & NativeDownloader
    const envCheck = await evaluate(`({
        hasXLSX: typeof window.XLSX !== 'undefined',
        xlsxVersion: typeof window.XLSX !== 'undefined' ? window.XLSX.version : null,
        hasNativeDownloader: typeof window.NativeDownloader !== 'undefined',
        hasSaveBase64File: Boolean(window.NativeDownloader && window.NativeDownloader.saveBase64File),
        currentScreen: window.app ? window.app.currentScreen : null,
        totalProducts: (window.app && window.app.products) ? window.app.products.length : 0
    })`);
    console.log('Environment Check:', envCheck);

    // 2. Switch to screen-products
    await evaluate(`window.app.switchScreen('screen-products')`);
    await new Promise(r => setTimeout(r, 400));

    // 3. Open Product Options Modal
    const modalRes = await evaluate(`(() => {
        const btnMenu = document.getElementById('btn-products-menu');
        if (btnMenu) btnMenu.click();
        const modal = document.getElementById('product-options-modal');
        return {
            modalVisible: modal ? modal.classList.contains('active') : false,
            items: document.getElementById('pop-total-items')?.textContent,
            stock: document.getElementById('pop-total-stock')?.textContent,
            valuation: document.getElementById('pop-total-val')?.textContent
        };
    })()`);
    console.log('Modal Status:', modalRes);

    ws.close();
}

test().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
