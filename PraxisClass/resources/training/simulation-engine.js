// Generated from lib/training/simulation-engine.ts. Run npm run gen:training.
window.TrainingSimulation = (() => { const exports = {};
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROUTE_POINTS = exports.VISION_SAMPLES = void 0;
exports.retrySimulation = retrySimulation;
exports.visionSimulation = visionSimulation;
exports.routeSimulation = routeSimulation;
function retrySimulation(scenario, design, followups, conflict = false) {
    if (!['V1', 'V2', 'V3'].includes(scenario) || !Number.isInteger(followups) || followups < 0 || followups > 4 ||
        !['plain', 'dedupe'].includes(design.mode) || !['same', 'new'].includes(design.retryKey) || !['same', 'new'].includes(design.newKey))
        throw new Error('无效的重试仿真输入。');
    const tickets = [];
    const records = new Map();
    const received = [];
    const events = [];
    function send(seq, operationId, payload, intent) {
        if (seq === 1 && scenario === 'V1') {
            events.push({ seq, intent, operationId, payload, network: '请求未到达', server: '没有收到请求', response: '等待超时，结果未知' });
            return;
        }
        const key = `U-DEMO:${operationId}`, old = design.mode === 'dedupe' ? records.get(key) : undefined;
        let server, id = '';
        if (old && old.payload !== payload)
            server = '参数冲突，不创建、不修改原记录';
        else if (old) {
            id = old.id;
            server = `关联原工单 ${id}`;
        }
        else {
            id = `T-${101 + tickets.length}`;
            tickets.push({ id, operationId, payload });
            records.set(key, { id, payload });
            server = `创建并记录 ${id}`;
        }
        const lost = seq === 1 && scenario === 'V2';
        if (id && !lost)
            received.push(id);
        events.push({ seq, intent, operationId, payload, network: lost ? '请求到达，响应丢失' : '请求与响应均到达', server, response: lost ? '等待超时，结果未知' : id ? `成功 ${id}` : '参数冲突' });
    }
    send(1, 'R-001', 'P-01', '创建第一张');
    for (let n = 1; n <= followups; n++) {
        const isNew = scenario === 'V3';
        // V3 expresses one second intent. Later sends retry that intent with its chosen key.
        const operationId = (isNew ? design.newKey : design.retryKey) === 'same' ? 'R-001' : `R-${String(isNew ? 2 : n + 1).padStart(3, '0')}`;
        send(n + 1, operationId, 'P-01', isNew ? n === 1 ? '明确的新操作' : '重试第二项意图' : '重试原操作');
    }
    if (conflict)
        send(followups + 2, 'R-001', 'P-02', '可选参数冲突对照');
    return { caller: 'U-DEMO', events, tickets, total: tickets.length, client: { sent: events.length, received, responses: events.map(({ seq, operationId, response }) => ({ seq, operationId, response })) } };
}
exports.VISION_SAMPLES = [
    { id: 'Q01', label: 'normal', score: 8 }, { id: 'Q02', label: 'normal', score: 18 },
    { id: 'Q03', label: 'normal', score: 32 }, { id: 'Q04', label: 'normal', score: 55 },
    { id: 'Q05', label: 'normal', score: 72 }, { id: 'Q06', label: 'defect', score: 48 },
    { id: 'Q07', label: 'defect', score: 68 }, { id: 'Q08', label: 'defect', score: 92 },
];
function visionSimulation(threshold, condition = 'BASIC') {
    if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100 || !['BASIC', 'EXTENSION'].includes(condition))
        throw new Error('阈值须为 0–100 的整数。');
    const groups = exports.VISION_SAMPLES.map((s) => ({ ...s, destination: s.score >= threshold ? 'review' : 'release', classification: s.label === 'defect' ? s.score >= threshold ? 'TP' : 'FN' : s.score >= threshold ? 'FP' : 'TN' }));
    const count = (kind) => groups.filter((s) => s.classification === kind).length;
    const TP = count('TP'), FN = count('FN'), FP = count('FP'), TN = count('TN'), review = TP + FP;
    const maxReview = condition === 'BASIC' ? 5 : 4;
    return { dataset: 'VISION-WASHER-1.0', rule: 'VISION-GTE-1.0', scoreScale: 'integer-0-100', condition, conditionVersion: 1, threshold, groups, TP, FN, FP, TN, review, maxReview, accuracy: (TP + TN) / 8, recall: TP / 3, meets: FN === 0 && review <= maxReview, groupKey: groups.filter((s) => s.destination === 'review').map((s) => s.id).join(',') };
}
exports.ROUTE_POINTS = { D: [0, 0], A: [4, 0], B: [0, 1], C: [1, 1] };
function routeSimulation(order, condition = 'BASIC') {
    if (order.length !== 3 || new Set(order).size !== 3 || order.some((s) => !['A', 'B', 'C'].includes(s)) || !['BASIC', 'TRANSFER', 'EXTENSION'].includes(condition))
        throw new Error('请将 A、B、C 各安排一次；遗漏、重复和未知地点不能计算。');
    let time = 0;
    const arrivals = { A: 0, B: 0, C: 0 };
    const stops = ['D', ...order, 'D'];
    const timeline = [{ x: 0, y: 0, time: 0, event: '出发', point: 'D' }];
    const legs = stops.slice(1).map((to, i) => {
        const from = stops[i], start = time;
        let [x, y] = [...exports.ROUTE_POINTS[from]];
        const [tx, ty] = exports.ROUTE_POINTS[to];
        const nodes = [{ x, y }];
        const advance = () => {
            time++;
            nodes.push({ x, y });
            const point = Object.entries(exports.ROUTE_POINTS).find(([, p]) => p[0] === x && p[1] === y)?.[0] ?? '';
            const atEnd = x === tx && y === ty;
            timeline.push({ x, y, time, point, event: atEnd ? to === 'D' ? '返程完成' : `办理 ${to}` : point ? `途经 ${point}，不办理${point === 'D' ? '、不结束' : ''}` : '移动' });
        };
        while (x !== tx) {
            x += Math.sign(tx - x);
            advance();
        }
        while (y !== ty) {
            y += Math.sign(ty - y);
            advance();
        }
        if (to !== 'D')
            arrivals[to] = time;
        return { from, to, distance: time - start, start, end: time, nodes };
    });
    const urgent = condition === 'TRANSFER' ? 'B' : 'A';
    const deadline = condition === 'TRANSFER' ? 1 : condition === 'EXTENSION' ? 3 : 4;
    return { map: 'WAREHOUSE-4P-1.0', rule: 'WAREHOUSE-HFIRST-1.0', condition, conditionVersion: 1, order: [...order], legs, timeline, arrivals, total: time, urgent, deadline, meets: arrivals[urgent] <= deadline };
}

return exports; })();
