import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, ignite, route, step, toggleExit, score } from '../src/simulation.js';

test('weighted A* chooses an available safety exit', () => {
  const sim=createSimulation(7,1);
  const path=route('302',sim.states,new Set());
  assert.deepEqual(path,['302','center','west','exitW']);
});

test('exit closure triggers rerouting to the other exit', () => {
  const sim=createSimulation(7,1);
  toggleExit(sim,'exitW');
  const path=route('302',sim.states,new Set(sim.blocked));
  assert.deepEqual(path,['302','center','east','exitE']);
});

test('fire simulation records events and advances smoke deterministically', () => {
  const sim=createSimulation(42,4);
  sim.running=true; ignite(sim,'302');
  for(let i=0;i<50;i++) step(sim,.2);
  assert.ok(sim.states['302'].fire>0);
  assert.ok(sim.states['center'].smoke>0);
  assert.equal(sim.events[0].type,'fire');
  assert.ok(sim.history.length>0);
});

test('no safe exit returns null rather than a line through walls',()=>{
  const sim=createSimulation();
  assert.equal(route('302',sim.states,new Set(['exitW','exitE'])),null);
  sim.states.west.smoke=.9;sim.states.east.fire=.9;
  assert.equal(route('302',sim.states),null);
});

test('risk cost chooses the safer route even from a nearer western room',()=>{
  const sim=createSimulation();
  sim.states.exitW.risk=.79;
  assert.equal(route('301',sim.states).at(-1),'exitE');
});

test('paused simulation preserves clock and exposure',()=>{
  const sim=createSimulation();ignite(sim);step(sim,1);
  assert.equal(sim.time,0);assert.equal(sim.agents[0].exposure,0);
});

test('trapped agents recover when an exit reopens',()=>{
  const sim=createSimulation(42,3);sim.running=true;ignite(sim);
  toggleExit(sim,'exitW');toggleExit(sim,'exitE');step(sim);
  assert.ok(sim.agents.every(a=>a.trapped));
  toggleExit(sim,'exitW');step(sim);
  assert.ok(sim.agents.every(a=>!a.trapped));
  assert.ok(sim.events.some(e=>e.type==='replan'));
});

test('all trapped agents receive zero overall score',()=>{
  const sim=createSimulation();sim.running=true;ignite(sim);
  toggleExit(sim,'exitW');toggleExit(sim,'exitE');step(sim);
  assert.equal(score(sim).total,0);
});

test('timeout starts at ignition rather than scene creation',()=>{
  const sim=createSimulation();sim.running=true;sim.time=290;ignite(sim);
  toggleExit(sim,'exitW');toggleExit(sim,'exitE');step(sim,20);
  assert.equal(sim.finished,false);
  step(sim,281);assert.equal(sim.finished,true);
});

test('seeded full drills are reproducible, finish and score within bounds',()=>{
  const run=()=>{const sim=createSimulation();sim.running=true;ignite(sim);
    for(let i=0;i<1600&&!sim.finished;i++)step(sim);
    return sim;};
  const a=run(),b=run();
  assert.deepEqual(a,b);assert.ok(a.finished);assert.equal(a.agents.filter(p=>p.escaped).length,36);
  assert.equal(a.events.at(-1).type,'finish');
  const result=score(a);assert.ok(result.total>=0&&result.total<=100);
});
