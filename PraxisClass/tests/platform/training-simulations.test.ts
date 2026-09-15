import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { z } from 'zod';
import { retrySimulation, visionSimulation, routeSimulation, type RetryDesign, type Stop } from '@/lib/training/simulation-engine';
import { retryEvidenceSchema, retryVisibleInput, simulationRule, visionEvidenceSchema, warehouseEvidenceSchema } from '@/lib/training/simulation-evidence';
import { buildExtraCaseHtml } from '@/lib/platform/training/extra-initializer';

const design: RetryDesign = { mode: 'dedupe', retryKey: 'same', newKey: 'new' };
describe('P3 deterministic teaching rules and evidence boundaries', () => {
  it('does not reveal the difference between initial timeout views', () => {
    const make = (scenario: 'V1' | 'V2') => retryVisibleInput({ current: { scenario, design, followups: 0, revealed: false, result: { secret: 'injected-server-result' } } });
    expect(make('V1')).toEqual(make('V2'));
    expect(z.json().safeParse(make('V1')).success).toBe(true);
    expect(JSON.stringify(make('V2'))).not.toMatch(/V2|tickets|total|injected-server-result|teachingPanorama/);
    expect(retrySimulation('V1', design, 0).total).toBe(0);
    expect(retrySimulation('V2', design, 0).total).toBe(1);
  });
  it('covers the nine required mode and intent comparisons, retaining response duplicates', () => {
    const choices = [{ ...design, mode: 'plain' as const }, { ...design, retryKey: 'new' as const }, design];
    expect(choices.map(d => ['V1', 'V2', 'V3'].map(s => retrySimulation(s as 'V1', d, 1).total))).toEqual([[1,2,2],[1,2,2],[1,1,2]]);
    expect(retrySimulation('V2', design, 3).client.received).toEqual(['T-101','T-101','T-101']);
    expect(retrySimulation('V3', { ...design, newKey: 'same' }, 1).total).toBe(1);
    const conflict = retrySimulation('V2', design, 1, true);
    expect(conflict.total).toBe(1); expect(conflict.tickets[0].payload).toBe('P-01'); expect(conflict.events.at(-1)?.response).toBe('参数冲突');
    expect(retrySimulation('V3', design, 3).total).toBe(2);
  });
  it('recomputes submitted retry truth and refuses mixed design revisions', () => {
    const r = { version:'RETRY-TICKET-1.0', designRevision:1, design, rulesReason:'reason', conclusion:'conclusion', limitations:'limits', assistance:'', rounds: ['V1','V2','V3'].map(scenario => ({ runId:crypto.randomUUID(),designRevision:1,scenario,design,followups:1,conflict:false,revealed:true,judgment:{conclusion:'unknown',reason:'timeout',observed:false,assisted:false},prediction:{total:1,reason:'prediction'},explanation:'observed',result:retrySimulation(scenario as 'V1',design,1) })) };
    expect(simulationRule('retry',r).status).toBe('passed');
    const changed = structuredClone(r); changed.rounds[0].result.total=99;
    expect(retryEvidenceSchema.safeParse(changed).success).toBe(false);
    changed.rounds[0]=structuredClone(r.rounds[0]);changed.rounds[0].designRevision=2;
    expect(retryEvidenceSchema.safeParse(changed).success).toBe(false);
    expect(simulationRule('retry',{...r,rounds:r.rounds.slice(0,2)}).status).toBe('unknown');
  });
  it('uses integer thresholds, equality and both workload constraints', () => {
    expect([50,75,45,32,48,49,0,100].map(t=>{const r=visionSimulation(t);return [r.TP,r.FN,r.FP,r.TN,r.review];})).toEqual([[2,1,2,3,4],[1,2,0,5,1],[3,0,2,3,5],[3,0,3,2,6],[3,0,2,3,5],[2,1,2,3,4],[3,0,5,0,8],[0,3,0,5,0]]);
    const thresholds=Array.from({length:101},(_,i)=>i);
    expect(thresholds.filter(t=>visionSimulation(t).meets)).toEqual(Array.from({length:16},(_,i)=>i+33));
    expect(thresholds.some(t=>visionSimulation(t,'EXTENSION').meets)).toBe(false);
    for(const value of [-1,101,48.5,0.48,NaN])expect(()=>visionSimulation(value)).toThrow();
  });
  it('does not count different thresholds with identical groups as two contrasts', () => {
    const observations=[33,45].map(threshold=>({runId:crypto.randomUUID(),threshold,condition:'BASIC',prediction:'p',explanation:'e',result:visionSimulation(threshold)}));
    const r={version:'VISION-QC-1.1',observations,finalRunId:observations[0].runId,comparison:'c',reasoning:'r',limitations:'l',assistance:'',extension:null};
    expect(simulationRule('vision',r).status).toBe('unknown');
    r.observations.push({runId:crypto.randomUUID(),threshold:75,condition:'BASIC',prediction:'p',explanation:'e',result:visionSimulation(75)});
    expect(simulationRule('vision',r).status).toBe('passed');
    r.observations[0].result.groups[0].destination='review';
    expect(visionEvidenceSchema.safeParse(r).success).toBe(false);
  });
  it('computes six routes and independent transfer conditions', () => {
    const orders=['ABC','ACB','BAC','BCA','CAB','CBA'].map(v=>v.split('') as Stop[]);
    expect(orders.map(o=>{const r=routeSimulation(o);return [r.total,r.arrivals.A,r.arrivals.B,r.arrivals.C,r.meets,routeSimulation(o,'TRANSFER').meets];})).toEqual([[12,4,9,10,true,false],[10,4,9,8,true,false],[12,6,1,10,false,true],[10,6,1,2,false,true],[12,6,11,2,false,false],[12,8,3,2,false,false]]);
    expect(orders.some(o=>routeSimulation(o,'EXTENSION').meets)).toBe(false);
    const r=routeSimulation(['B','A','C']);
    expect(r.timeline.find(n=>n.time===2)?.event).toBe('途经 C，不办理');
    expect(r.arrivals.C).toBe(10);
    expect(routeSimulation(['A','B','C']).timeline.find(n=>n.time===8)?.event).toBe('途经 D，不办理、不结束');
    for(const order of [[],['A','A','C'],['A','B','Z']])expect(()=>routeSimulation(order as Stop[])).toThrow();
  });
  it('keeps incomplete transfer pending and validates recheck identity and original times', () => {
    const observations=[['ACB','BASIC'],['ABC','BASIC'],['ACB','TRANSFER'],['BCA','TRANSFER']].map(([o,condition])=>({runId:crypto.randomUUID(),order:o.split('') as Stop[],condition:condition as 'BASIC'|'TRANSFER',prediction:'p',explanation:'e',result:routeSimulation(o.split('') as Stop[],condition as 'BASIC'|'TRANSFER')}));
    const r={version:'WAREHOUSE-ROUTE-1.0',model:'m',observations,finalRunId:observations[0].runId,transferRecheckId:observations[2].runId,transferFinalId:observations[3].runId,comparison:'c',transferReason:'t',limitations:'l',assistance:'',extension:null};
    expect(simulationRule('warehouse',r).status).toBe('passed');
    expect(simulationRule('warehouse',{...r,transferRecheckId:'',transferFinalId:''}).status).toBe('unknown');
    expect(warehouseEvidenceSchema.safeParse({...r,transferRecheckId:observations[3].runId}).success).toBe(false);
    r.observations[0].result.arrivals.A=3;
    expect(warehouseEvidenceSchema.safeParse(r).success).toBe(false);
  });
  it('ships the same rules to each executable HTML without exposing unprocessed templates', async () => {
    const sandbox={window:{} as {TrainingSimulation?:typeof import('@/lib/training/simulation-engine')}};
    vm.runInNewContext(await readFile('resources/training/simulation-engine.js','utf8'),sandbox);
    expect(sandbox.window.TrainingSimulation!.visionSimulation(48)).toEqual(visionSimulation(48));
    expect(sandbox.window.TrainingSimulation!.routeSimulation(['A','B','C'])).toEqual(routeSimulation(['A','B','C']));
    for(const id of ['retry','vision','warehouse'] as const){const html=await buildExtraCaseHtml(id);expect(html).not.toMatch(/COMMON_JS|COMMON_CSS|SIMULATION_ENGINE|<!-- Q0|<!-- MAP|<!-- TRANSIT/);for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);if(id==='vision'){expect(html).toContain('手工分数48');expect(html).not.toContain('>0.48<');}}
  });
});
