const http = require('http');

async function testExportDirect() {
    const list = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9222/json', (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });

    const page = list.find(p => p.type === 'page');
    if (!page) throw new Error('No page target found');

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

    const exportRes = await evaluate(`(async () => {
        try {
            console.log('Starting export test in webview...');
            const res = await window.app.downloadProductsExcel('xlsx');
            return { success: true, res };
        } catch (err) {
            return { error: err.message, stack: err.stack };
        }
    })()`);
    console.log('Export Result:', exportRes);

    ws.close();
}

testExportDirect().catch(console.error);
