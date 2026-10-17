import { type BrowserResult, type Provider } from './contract';
export class BrowserResearchClient {
    private worker: Worker | null = null;
    private pending: { reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;
    private sequence = 0;
    async run(input: { file?: File; provider: Provider; allowFallback: boolean; cacheModel: boolean; fixture: string }, status: (state: string, loaded?: number, total?: number) => void): Promise<BrowserResult> {
        if (this.pending) throw new Error('DUPLICATE_REQUEST');
        if (!this.worker) this.worker = new Worker('/browser-ai/worker.js', { type: 'module', name: 'sonri-browser-research' });
        const worker = this.worker, id = ++this.sequence;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => this.dispose('INFERENCE_TIMEOUT'), 120000);
            this.pending = { reject, timer };
            worker.onerror = () => this.dispose('BROWSER_WORKER_FAILED');
            worker.onmessage = event => {
                if (event.data.id !== id) return;
                if (event.data.type === 'status') { status(event.data.state, event.data.loaded, event.data.total); return; }
                if (event.data.type === 'error') { this.dispose(event.data.error); return; }
                if (event.data.type === 'result') { clearTimeout(timer); this.pending = null; resolve(event.data.result); }
            };
            try { worker.postMessage({ id, action: 'run', ...input }); } catch { this.dispose('BROWSER_WORKER_FAILED'); }
        });
    }
    dispose(reason = 'CANCELLED') {
        this.worker?.terminate(); this.worker = null;
        if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(new Error(reason)); this.pending = null; }
    }
}
