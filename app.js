const CDN = "https://cdn.jsdelivr.net/gh/workinwithai-create/PreEight@main/public/samples";
const STEPS = 16;
const PRE = 2;
const DROP = 8;
const TOTAL = PRE + DROP;
const recipes = [
  { id:"kick-lock", name:"Kick lock", blurb:"Four-on-the-floor from bar 3. No ghost kicks." },
  { id:"bass-floor", name:"Bass floor", blurb:"Root on one. No walk until bar 10." },
  { id:"crash-door", name:"Crash door", blurb:"Crash on bar 3 beat 1 only." },
  { id:"side-pump", name:"Side pump", blurb:"Hats duck 80ms after each kick." },
  { id:"open-hat", name:"Open hat", blurb:"Open hat on the last eighth of even bars." },
  { id:"snare-back", name:"Snare back", blurb:"Snare only on 3. Leave 2 empty." },
  { id:"octave-hit", name:"Octave hit", blurb:"Bass jumps +12 on bar 7 then slams back." },
  { id:"brass-stab", name:"Brass stab", blurb:"Trumpet on the and-of-4 in bars 6 and 10." },
  { id:"violin-rise", name:"Violin rise", blurb:"Violin holds 5 then yields on bar 10." },
  { id:"one-note", name:"One note", blurb:"Piano leaves a single high tone over the last kick." }
];
function bar(symbol, piano, guitar, bass){ return { symbol, piano, guitar, bass }; }
const grooves = [
  { id:"amber", name:"Amber Drop", bpm:122, key:"A minor",
    pre:[bar("E7",[40,44,47,52],[40,47,50],28),bar("E7",[40,44,47,52],[40,47,50],28)],
    drop:[bar("Am",[45,48,52,57],[45,52,57],33),bar("Am",[45,48,52,57],[45,52,57],33),bar("F",[41,45,48,53],[41,48,53],41),bar("F",[41,45,48,53],[41,48,53],41),bar("C",[48,52,55,60],[48,52,55],36),bar("C",[48,52,55,60],[48,52,55],36),bar("G",[43,47,50,55],[43,47,50],31),bar("Am",[45,48,52,57],[45,52,57],33)] },
  { id:"porch", name:"Porch Slam", bpm:118, key:"E minor",
    pre:[bar("B7",[35,39,42,47],[35,42,46],23),bar("B7",[35,39,42,47],[35,42,46],23)],
    drop:[bar("Em",[40,43,47,52],[40,47,52],28),bar("Em",[40,43,47,52],[40,47,52],28),bar("C",[36,40,43,48],[36,43,48],24),bar("C",[36,40,43,48],[36,43,48],24),bar("G",[43,47,50,55],[43,47,50],31),bar("G",[43,47,50,55],[43,47,50],31),bar("D",[38,42,45,50],[38,45,50],26),bar("Em",[40,43,47,52],[40,47,52],28)] },
  { id:"fold", name:"Fold Club", bpm:126, key:"D minor",
    pre:[bar("A7",[33,37,40,43],[33,40,43],33),bar("A7",[33,37,40,43],[33,40,43],33)],
    drop:[bar("Dm",[38,41,45,50],[38,45,50],26),bar("Dm",[38,41,45,50],[38,45,50],26),bar("Bb",[34,38,41,46],[34,41,46],34),bar("Bb",[34,38,41,46],[34,41,46],34),bar("F",[41,45,48,53],[41,48,53],29),bar("F",[41,45,48,53],[41,48,53],29),bar("C",[36,40,43,48],[36,43,48],24),bar("Dm",[38,41,45,50],[38,45,50],26)] }
];
const state = { groove: grooves[0], recipe: recipes[0], playing:false, bar:0, mode:null, midiName:"" };
let ctx, bus, outNode, micNode, buffers = {}, midiAccess = null;
async function ensureCtx() {
  if (ctx) return;
  ctx = new AudioContext();
  bus = ctx.createGain(); bus.gain.value = 0.35;
  outNode = ctx.createGain(); outNode.gain.value = 1;
  bus.connect(outNode); outNode.connect(ctx.destination);
}
async function load() {
  await ensureCtx();
  const files = [
    ["kick",`${CDN}/drums/kick.mp3`],["snare",`${CDN}/drums/snare.mp3`],["hat",`${CDN}/drums/hihat.mp3`],["crash",`${CDN}/drums/crash.mp3`],
    ["pC3",`${CDN}/piano/C3.mp3`],["pC4",`${CDN}/piano/C4.mp3`],["pA3",`${CDN}/piano/A3.mp3`],
    ["bE1",`${CDN}/bass/E1.mp3`],["bA1",`${CDN}/bass/A1.mp3`],["bC2",`${CDN}/bass/C2.mp3`],
    ["gE2",`${CDN}/guitar/E2.mp3`],["gA2",`${CDN}/guitar/A2.mp3`],["gE3",`${CDN}/guitar/E3.mp3`],
    ["tC4",`${CDN}/trumpet/C4.mp3`],["vA3",`${CDN}/violin/A3.mp3`]
  ];
  let n=0;
  for (const [k,url] of files) {
    try { const r = await fetch(url); buffers[k] = await ctx.decodeAudioData(await r.arrayBuffer()); } catch (e) { console.warn(k, e); }
    n++; document.getElementById("status").textContent = `Seating chairs ${n}/${files.length}`;
  }
  document.getElementById("status").textContent = "Chairs seated · live FluidR3 + kit";
}
function playBuf(name, when, rate=1, gain=0.4) {
  const b = buffers[name]; if (!b || !ctx) return;
  const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = gain; src.connect(g); g.connect(bus); src.start(when);
}
function rateFromMidi(midi, baseMidi){ return Math.pow(2, (midi-baseMidi)/12); }
function zone(i){ return i < PRE ? "pre" : "drop"; }
function chordAt(i){ return i < PRE ? state.groove.pre[i] : state.groove.drop[i-PRE]; }
function scheduleBar(barIndex, t0, stepDur){
  const ch = chordAt(barIndex); const z = zone(barIndex); const rec = state.recipe.id;
  const onDrop = z === "drop";
  for (let s=0;s<STEPS;s++){
    const when = t0 + s*stepDur;
    const duck = rec==="side-pump" && onDrop && s%4===0;
    if (s%2===0) playBuf("hat", when + (duck?0.02:0), 1, onDrop ? 0.08 : 0.04);
    if (onDrop && rec==="open-hat" && barIndex%2===1 && s===14) playBuf("hat", when, 0.7, 0.16);
    if (s===0) playBuf("kick", when, 1, onDrop ? 0.78 : 0.28);
    if (onDrop && rec==="kick-lock" && s===8) playBuf("kick", when, 1, 0.62);
    const snareOn = rec==="snare-back" ? s===8 && onDrop && barIndex%2===0 : s===8;
    if (snareOn) playBuf("snare", when, 1, onDrop ? 0.48 : 0.18);
    if (s===0) {
      playBuf("pC4", when, rateFromMidi(ch.piano[2]||60, 60), onDrop ? 0.22 : 0.12);
      playBuf("pA3", when, rateFromMidi(ch.piano[1]||57, 57), onDrop ? 0.16 : 0.08);
      let bassMidi = ch.bass;
      if (onDrop && rec==="octave-hit" && barIndex===8) bassMidi = ch.bass + 12;
      playBuf("bA1", when, rateFromMidi(bassMidi, 33), onDrop ? 0.5 : 0.22);
      playBuf("gA2", when, rateFromMidi(ch.guitar[0]||45, 45), onDrop ? 0.2 : 0.1);
    }
    if (onDrop && rec==="crash-door" && barIndex===2 && s===0) playBuf("crash", when, 1, 0.28);
    if (onDrop && rec==="brass-stab" && (barIndex===5 || barIndex===9) && s===14) playBuf("tC4", when, rateFromMidi(ch.piano[3]||69,60), 0.34);
    if (onDrop && rec==="violin-rise" && s===0) playBuf("vA3", when, rateFromMidi(ch.piano[2]||60,57), 0.16);
    if (onDrop && rec==="one-note" && barIndex===9 && s===0) playBuf("pC4", when, rateFromMidi((ch.piano[3]||69)+7, 60), 0.24);
  }
}
let timer=null;
function stop(){ state.playing=false; state.mode=null; if(timer) clearTimeout(timer); timer=null; paintBars(); }
async function play(mode){
  if (!ctx) await load();
  if (ctx.state==="suspended") await ctx.resume();
  stop(); state.playing=true; state.mode=mode;
  const startBar = mode==="eight" || mode==="loop" ? PRE : 0;
  const endBar = TOTAL;
  const stepDur = 60/state.groove.bpm/4;
  let barIndex = startBar;
  const tick = () => {
    if (!state.playing) return;
    if (barIndex >= endBar) { if (mode==="loop") barIndex = PRE; else { stop(); return; } }
    state.bar = barIndex; paintBars();
    scheduleBar(barIndex, ctx.currentTime+0.02, stepDur);
    barIndex += 1;
    timer = setTimeout(tick, STEPS*stepDur*1000);
  };
  tick();
}
function punch(){
  const g=state.groove, r=state.recipe;
  return `DropEight punch list\n${g.name} · ${g.bpm} BPM · ${g.key} · ${r.name}\nI/O · MIDI: ${state.midiName || "none"}\n\nThe problem: the break already stole the air, then chorus 2 leaks into the drop at the same height.\nThe move: ${r.blurb}\n\nPre (bars 1-2)\n${g.pre.map((b,i)=>`  ${i+1}. ${b.symbol}`).join("\n")}\n\nDrop (bars 3-10) — ${r.name}\n${g.drop.map((b,i)=>`  ${i+3}. ${b.symbol}`).join("\n")}\n\nLive chairs only. Distinct from BreakFour, StopFour, RideEight, LastHook.\nDrop the WAV on bars 3-10. Do not loop the break into the drop.`;
}
function paintGrooves(){
  const el=document.getElementById("grooves"); el.innerHTML="";
  grooves.forEach(g=>{ const b=document.createElement("button"); b.className="card"+(state.groove.id===g.id?" on":""); b.innerHTML=`<b>${g.name}</b><span>${g.bpm} BPM · ${g.key}</span>`; b.onclick=()=>{ state.groove=g; render(); }; el.appendChild(b); });
}
function paintRecipes(){
  const el=document.getElementById("recipes"); el.innerHTML="";
  recipes.forEach(r=>{ const b=document.createElement("button"); r; const b2=document.createElement("button"); b2.className="card"+(state.recipe.id===r.id?" on":""); b2.innerHTML=`<b>${r.name}</b><span>${r.blurb}</span>`; b2.onclick=()=>{ state.recipe=r; render(); }; el.appendChild(b2); });
}
function paintBars(){
  const el=document.getElementById("bars"); el.innerHTML="";
  for(let i=0;i<TOTAL;i++){
    const ch=chordAt(i); const z=zone(i);
    const d=document.createElement("div");
    d.className="bar "+z+(state.playing && state.bar===i?" active":"");
    d.innerHTML=`<div class="n">${i+1} · ${z==="pre"?"P":"D"}</div><div class="c">${ch.symbol}</div>`;
    el.appendChild(d);
  }
}
function render(){ paintGrooves(); paintRecipes(); paintBars(); document.getElementById("punch").textContent = punch(); }

async function listAudio() {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    document.getElementById("ioStatus").textContent = "Mic permission blocked — input list may be empty.";
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  const ins = devices.filter(d => d.kind === "audioinput");
  const outs = devices.filter(d => d.kind === "audiooutput");
  const inSel = document.getElementById("audioIn");
  const outSel = document.getElementById("audioOut");
  const curIn = inSel.value, curOut = outSel.value;
  inSel.innerHTML = `<option value="">Default mic / interface</option>` + ins.map(d => `<option value="${d.deviceId}">${d.label || "Input"}</option>`).join("");
  outSel.innerHTML = `<option value="">Default speakers / phones</option>` + outs.map(d => `<option value="${d.deviceId}">${d.label || "Output"}</option>`).join("");
  if (curIn) inSel.value = curIn;
  if (curOut) outSel.value = curOut;
}
async function hookInput() {
  await ensureCtx();
  if (micNode) { try { micNode.mediaStream.getTracks().forEach(t => t.stop()); micNode.disconnect(); } catch {} micNode = null; }
  const id = document.getElementById("audioIn").value;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: id ? { exact: id } : undefined, echoCancellation:false, noiseSuppression:false, autoGainControl:false } });
  micNode = ctx.createMediaStreamSource(stream);
  const mon = ctx.createGain(); mon.gain.value = 0.15;
  micNode.connect(mon); mon.connect(bus);
  document.getElementById("ioStatus").textContent = "Input armed (monitor −15 dB into the bus).";
}
async function hookOutput() {
  await ensureCtx();
  const id = document.getElementById("audioOut").value;
  if (typeof outNode.setSinkId === "function" && id) {
    try { await outNode.setSinkId(id); document.getElementById("ioStatus").textContent = "Output routed."; }
    catch (e) { document.getElementById("ioStatus").textContent = "Output pick failed; using default."; }
  } else if (ctx.setSinkId && id) {
    try { await ctx.setSinkId(id); document.getElementById("ioStatus").textContent = "Output routed via AudioContext."; }
    catch (e) { document.getElementById("ioStatus").textContent = "Browser blocked output pick."; }
  } else {
    document.getElementById("ioStatus").textContent = "Output stays on default (setSinkId not available).";
  }
}
function onMidi(ev) {
  const [st, d1, d2] = ev.data;
  const cmd = st & 0xf0;
  if (cmd === 0x90 && d2 > 0) playBuf("pC4", ctx ? ctx.currentTime : 0, rateFromMidi(d1, 60), 0.28);
  if (cmd === 0xb0 && d1 === 1 && bus) bus.gain.value = 0.08 + (d2/127)*0.5;
}
async function listMidi() {
  const sel = document.getElementById("midiIn");
  if (!navigator.requestMIDIAccess) { sel.innerHTML = `<option value="">Web MIDI not supported</option>`; return; }
  try {
    midiAccess = await navigator.requestMIDIAccess({ sysex:false });
  } catch (e) {
    sel.innerHTML = `<option value="">MIDI permission denied</option>`;
    return;
  }
  const cur = sel.value;
  let html = `<option value="">No MIDI</option>`;
  for (const [id, port] of midiAccess.inputs) html += `<option value="${id}">${port.name}</option>`;
  sel.innerHTML = html;
  if (cur) sel.value = cur;
}
function hookMidi() {
  if (!midiAccess) return;
  for (const port of midiAccess.inputs.values()) port.onmidimessage = null;
  const id = document.getElementById("midiIn").value;
  if (!id) { state.midiName = ""; render(); return; }
  const port = midiAccess.inputs.get(id);
  if (port) { port.onmidimessage = onMidi; state.midiName = port.name; render(); document.getElementById("ioStatus").textContent = `MIDI: ${port.name} · notes = piano · CC1 = bus`; }
}
async function refreshIo() {
  await ensureCtx();
  await listAudio();
  await listMidi();
}
document.getElementById("playA").onclick=()=>play("loop");
document.getElementById("playB").onclick=()=>play("cut");
document.getElementById("play8").onclick=()=>play("eight");
document.getElementById("stop").onclick=stop;
document.getElementById("copy").onclick=()=>navigator.clipboard.writeText(punch());
document.getElementById("refreshIo").onclick=refreshIo;
document.getElementById("audioIn").onchange=hookInput;
document.getElementById("audioOut").onchange=hookOutput;
document.getElementById("midiIn").onchange=hookMidi;
render();
load();
refreshIo();
