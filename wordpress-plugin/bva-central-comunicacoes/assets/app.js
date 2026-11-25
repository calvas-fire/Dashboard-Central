const oneHour = 60 * 60 * 1000;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let data = { constraints: [], readiness: [], notices: [], updatedAt: new Date().toISOString() };
let catalog = { hospitals: [], services: [] };
let branding = BVACentralConfig.branding || {};
async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(BVACentralConfig.restRoot + path, {
    credentials: 'same-origin',
    ...options,
    headers: { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), 'X-WP-Nonce': BVACentralConfig.nonce, ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'Não foi possível comunicar com o WordPress.');
  return body;
}
async function refreshRecords() {
  try {
    const [records, lists] = await Promise.all([api('records'),api('catalog')]);
    data = records; catalog = lists; render();
  }
  catch (error) { if ($('#constraint-list')) $('#constraint-list').innerHTML = `<div class="empty-state">${esc(error.message)}</div>`; }
}
function persist() { data.updatedAt = new Date().toISOString(); render(); }
function esc(value = '') { return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function dateTime(value, options = {}) { return new Intl.DateTimeFormat('pt-PT', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', ...options }).format(new Date(value)); }
function dateShort(value) { return new Intl.DateTimeFormat('pt-PT', { day:'2-digit', month:'short' }).format(new Date(value)); }
function timeOnly(value) { return new Intl.DateTimeFormat('pt-PT', { hour:'2-digit', minute:'2-digit' }).format(new Date(value)); }
function startVisibility(row, now = Date.now()) { const start = new Date(row.start).getTime(), end = new Date(row.end).getTime(); return end > now && now >= start - oneHour; }
function current(row, now = Date.now()) { const start = new Date(row.start).getTime(), end = new Date(row.end).getTime(); return now >= start && now < end; }
function statusFor(row) { const now = Date.now(); if (current(row, now)) return ['Em vigor', 'active']; if (startVisibility(row, now)) return ['A iniciar em breve', 'scheduled']; return new Date(row.end).getTime() <= now ? ['Terminado', 'expired'] : ['Programado', 'scheduled']; }
function levelKey(value) {
  const raw = String(value || '').toLowerCase();
  if (['normal','i','ii','iii','iv'].includes(raw)) return raw;
  if (raw.includes('nível iv') || raw.includes('nível 4') || raw.includes('vermelho')) return 'iv';
  if (raw.includes('nível iii') || raw.includes('nível 3') || raw.includes('laranja')) return 'iii';
  if (raw.includes('nível ii') || raw.includes('nível 2') || raw.includes('amarelo')) return 'ii';
  if (raw.includes('nível i') || raw.includes('nível 1') || raw.includes('azul')) return 'i';
  return 'normal';
}
function levelLabel(value) { const key = levelKey(value); return key === 'normal' ? 'Normal' : `Especial — Nível ${key.toUpperCase()}`; }

function renderDashboard() {
  const now = Date.now();
  const activeReadiness = data.readiness.filter(row => current(row, now)).sort((a,b) => new Date(a.end)-new Date(b.end))[0];
  const nextReadiness = data.readiness.filter(row => !current(row, now) && startVisibility(row, now)).sort((a,b) => new Date(a.start)-new Date(b.start))[0];
  const readiness = $('#readiness-card');
  readiness.dataset.level = activeReadiness ? levelKey(activeReadiness.level) : 'normal';
  if (activeReadiness) {
    const isNormal = levelKey(activeReadiness.level) === 'normal';
    readiness.innerHTML = `<div class="readiness-symbol">${isNormal ? '✓' : '⌁'}</div><div class="readiness-copy"><p class="eyebrow">${isNormal ? 'Estado de prontidão' : 'Estado de prontidão especial'} · ${esc(activeReadiness.region)}</p><h2>${isNormal ? 'Estado de prontidão normal' : `Prontidão especial — Nível ${levelKey(activeReadiness.level).toUpperCase()}`}</h2><p>Em vigor até ${dateTime(activeReadiness.end)}${activeReadiness.detail ? ` · ${esc(activeReadiness.detail)}` : ''}</p></div><span class="readiness-state">EM VIGOR</span>`;
  } else if (nextReadiness) {
    const nextKey = levelKey(nextReadiness.level);
    readiness.innerHTML = `<div class="readiness-symbol">◷</div><div class="readiness-copy"><p class="eyebrow">Estado atual · ${esc(nextReadiness.region)}</p><h2>Estado de prontidão normal</h2><p>Próximo: <span class="level-chip level-${nextKey}">${esc(levelLabel(nextReadiness.level))}</span> a partir de ${dateTime(nextReadiness.start)}${nextReadiness.detail ? ` · ${esc(nextReadiness.detail)}` : ''}</p></div><span class="readiness-state">A SEGUIR</span>`;
  } else {
    readiness.innerHTML = `<div class="readiness-symbol">✓</div><div class="readiness-copy"><p class="eyebrow">Estado de prontidão · Sub-região de Lisboa</p><h2>Estado de prontidão normal</h2><p>Sem estado especial programado neste momento.</p></div><span class="readiness-state">NORMAL</span>`;
  }

  const visible = data.constraints.filter(row => startVisibility(row, now)).sort((a,b) => new Date(a.start)-new Date(b.start));
  $('#constraint-count').textContent = `${visible.length} ${visible.length === 1 ? 'registo visível' : 'registos visíveis'}`;
  const groups = new Map();
  visible.forEach(row => { const key = row.hospital || 'Hospital não identificado'; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row); });
  $('#constraint-list').innerHTML = visible.length ? [...groups.entries()].map(([hospital, rows]) => {
    const services = rows.map(row => {
      const activeNow = current(row, now);
      const start = new Date(row.start), end = new Date(row.end);
      const range = start.toDateString() === end.toDateString() ? `${dateShort(row.start)} · ${timeOnly(row.start)}` : dateTime(row.start);
      const endRange = start.toDateString() === end.toDateString() ? `${dateShort(row.end)} · ${timeOnly(row.end)}` : dateTime(row.end);
      return `<div class="service-entry"><div class="service-heading"><strong>${esc(row.service)}</strong><span class="status-tag ${activeNow ? 'active' : ''}">${activeNow ? 'Em vigor' : `Inicia às ${timeOnly(row.start)}`}</span></div><div class="service-times"><span><small>Início</small><b>${range}</b></span><span class="time-arrow">→</span><span><small>Fim</small><b>${endRange}</b></span></div>${row.detail ? `<p class="service-detail">${esc(row.detail)}</p>` : ''}</div>`;
    }).join('');
    return `<article class="constraint-card hospital-group"><div class="card-top"><div class="hospital">${esc(hospital)}</div><span class="count-chip">${rows.length} ${rows.length === 1 ? 'serviço' : 'serviços'}</span></div><div class="hospital-services">${services}</div></article>`;
  }).join('') : `<div class="empty-state">Sem constrangimentos hospitalares ativos ou a iniciar na próxima hora.</div>`;
  $('#notices-list').innerHTML = data.notices.length ? data.notices.map(n => `<div class="notice-item"><strong>${esc(n.title)}.</strong> ${esc(n.text)}</div>`).join('') : '<div class="notice-item">Sem avisos operacionais.</div>';
  $('#updated-at').textContent = `Atualizado ${new Intl.DateTimeFormat('pt-PT',{hour:'2-digit',minute:'2-digit'}).format(new Date(data.updatedAt))}`;
}

function renderAdmin() {
  if (!BVACentralConfig.canEdit) return;
  $('#admin-count').textContent = data.constraints.length;
  $('#admin-constraints').innerHTML = data.constraints.slice().sort((a,b) => new Date(a.start)-new Date(b.start)).map(row => {
    const [label, klass] = statusFor(row);
    return `<article class="admin-row"><div class="admin-row-main"><div class="admin-row-title">${esc(row.hospital)} — ${esc(row.service)}</div><div class="admin-row-meta">${dateTime(row.start)} → ${dateTime(row.end)}${row.detail ? ` · ${esc(row.detail)}` : ''}</div></div><span class="admin-row-status ${klass}">${label}</span><div class="row-actions"><button class="small-button" data-edit="constraint" data-id="${row.id}">Editar</button><button class="small-button delete" data-delete="constraint" data-id="${row.id}">Apagar</button></div></article>`;
  }).join('') || '<div class="empty-state">Ainda não há constrangimentos registados.</div>';
  $('#admin-readiness').innerHTML = data.readiness.slice().sort((a,b) => new Date(a.start)-new Date(b.start)).map(row => {
    const [label, klass] = statusFor(row);
    return `<article class="admin-row"><div class="admin-row-main"><div class="admin-row-title"><span class="level-swatch level-${levelKey(row.level)}"></span>${esc(levelLabel(row.level))} · ${esc(row.region)}</div><div class="admin-row-meta">${dateTime(row.start)} → ${dateTime(row.end)}${row.detail ? ` · ${esc(row.detail)}` : ''}</div></div><span class="admin-row-status ${klass}">${label}</span><div class="row-actions"><button class="small-button" data-edit="readiness" data-id="${row.id}">Editar</button><button class="small-button delete" data-delete="readiness" data-id="${row.id}">Apagar</button></div></article>`;
  }).join('') || '<div class="empty-state">Sem estados de prontidão programados.</div>';
  $('#admin-notices').innerHTML = data.notices.map(row => `<article class="admin-row"><div class="admin-row-main"><div class="admin-row-title">${esc(row.title)}</div><div class="admin-row-meta">${esc(row.text)}</div></div><div class="row-actions"><button class="small-button" data-edit="notice" data-id="${row.id}">Editar</button><button class="small-button delete" data-delete="notice" data-id="${row.id}">Apagar</button></div></article>`).join('') || '<div class="empty-state">Sem avisos operacionais.</div>';
  renderCatalog();
}
function render() { renderDashboard(); if (BVACentralConfig.canEdit) renderAdmin(); }

function applyBranding(settings) {
  branding = settings;
  const app = $('#app');
  app.style.setProperty('--brand-header-bg', settings.header_bg);
  app.style.setProperty('--brand-header-text', settings.header_text);
  app.style.setProperty('--brand-header-muted', settings.header_muted);
  app.style.setProperty('--brand-accent', settings.accent);
  $('#brand-title').textContent = settings.title;
  $('#brand-subtitle').textContent = settings.subtitle;
  const logoWrap = $('#brand-logo-wrap'), logo = $('#brand-logo');
  if (settings.logo_url) logo.src = settings.logo_url;
  else logo.removeAttribute('src');
  logo.alt = settings.title ? `Logótipo — ${settings.title}` : 'Logótipo';
  logoWrap.classList.toggle('hidden', !settings.logo_url);
  if (BVACentralConfig.canEdit && $('#branding-title')) {
    $('#branding-title').value = settings.title;
    $('#branding-subtitle').value = settings.subtitle;
    $('#branding-header-bg').value = settings.header_bg;
    $('#branding-header-text').value = settings.header_text;
    $('#branding-header-muted').value = settings.header_muted;
    $('#branding-accent').value = settings.accent;
    const preview = $('#branding-logo-preview'), empty = $('#branding-logo-empty');
    if (settings.logo_url) preview.src = settings.logo_url;
    else preview.removeAttribute('src');
    preview.classList.toggle('hidden', !settings.logo_url);
    empty.classList.toggle('hidden', !!settings.logo_url);
  }
}
async function loadBranding() {
  try { applyBranding(await api('branding')); }
  catch (error) { toast(error.message); }
}
async function saveBranding(overrides = {}) {
  const settings = {
    title: $('#branding-title').value.trim(),
    subtitle: $('#branding-subtitle').value.trim(),
    logo_url: branding.logo_url || '',
    header_bg: $('#branding-header-bg').value,
    header_text: $('#branding-header-text').value,
    header_muted: $('#branding-header-muted').value,
    accent: $('#branding-accent').value,
    ...overrides
  };
  try { applyBranding(await api('branding',{method:'PUT',body:JSON.stringify(settings)})); toast('Identidade visual guardada.'); }
  catch (error) { toast(error.message); }
}
async function uploadBrandLogo() {
  const file = $('#branding-logo-file').files[0];
  if (!file) { toast('Escolhe primeiro uma imagem.'); return; }
  if (file.size > 2 * 1024 * 1024) { toast('A imagem não pode exceder 2 MB.'); return; }
  const body = new FormData(); body.append('logo',file);
  try {
    const settings = await api('branding/logo',{method:'POST',body});
    branding.logo_url = settings.logo_url;
    $('#brand-logo').src = settings.logo_url;
    $('#brand-logo').alt = `Logótipo — ${branding.title || 'Central de Comunicações'}`;
    $('#brand-logo-wrap').classList.remove('hidden');
    $('#branding-logo-preview').src = settings.logo_url;
    $('#branding-logo-preview').classList.remove('hidden');
    $('#branding-logo-empty').classList.add('hidden');
    $('#branding-logo-file').value = ''; toast('Logótipo carregado.');
  } catch (error) { toast(error.message); }
}

function updateClock() {
  const now = new Date();
  $('#header-clock').textContent = new Intl.DateTimeFormat('pt-PT',{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(now);
  $('#dashboard-clock').textContent = new Intl.DateTimeFormat('pt-PT',{hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(now);
  $('#dashboard-date').textContent = new Intl.DateTimeFormat('pt-PT',{weekday:'long',day:'2-digit',month:'long'}).format(now);
}
function route() {
  const requestedAdmin = location.hash === '#admin';
  const admin = requestedAdmin && BVACentralConfig.canEdit;
  if (requestedAdmin && !BVACentralConfig.canEdit) history.replaceState(null, '', '#dashboard');
  $('#dashboard-view').classList.toggle('hidden', admin);
  const adminView = $('#admin-view');
  if (adminView) adminView.classList.toggle('hidden', !admin);
  $$('[data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === (admin ? 'admin':'dashboard')));
}
function setTab(name) {
  $$('.admin-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === name));
  ['constraints','readiness','notices','catalog','branding'].forEach(tab => $(`#${tab}-panel`).classList.toggle('hidden', tab !== name));
}
const dialog = $('#record-dialog'), form = $('#record-form');
let currentType = 'constraint', editId = null;
function inputValue(name, value = '') { const field = [...form.elements].find(item => item.name === name && !item.disabled); if (field) field.value = value; }
function toLocalInput(value) { const d = new Date(value); const local = new Date(d.getTime() - d.getTimezoneOffset()*60000); return local.toISOString().slice(0,16); }
function openRecord(type, row = null) {
  currentType = type; editId = row?.id || null; form.reset();
  $('#constraint-fields').classList.toggle('hidden', type !== 'constraint');
  $('#readiness-fields').classList.toggle('hidden', type !== 'readiness');
  $('#notice-fields').classList.toggle('hidden', type !== 'notice');
  [['constraint-fields','constraint'],['readiness-fields','readiness'],['notice-fields','notice']].forEach(([selector,section]) => {
    $$("input,textarea", $(`#${selector}`)).forEach(field => { field.disabled = section !== type; });
    $$('select', $(`#${selector}`)).forEach(field => { field.disabled = section !== type; });
  });
  if (type === 'constraint') { syncOther('hospital-select','hospital-other'); syncOther('service-select','service-other'); }
  $('#dialog-title').textContent = type === 'constraint' ? 'Constrangimento hospitalar' : type === 'readiness' ? 'Estado de prontidão' : 'Aviso operacional';
  $('#dialog-eyebrow').textContent = row ? 'Editar registo' : 'Novo registo';
  if (row) {
    if (type === 'constraint') {
      setChoice('hospital-select','hospital-other',row.hospital);
      setChoice('service-select','service-other',row.service);
      Object.entries(row).forEach(([key,value]) => { if (key === 'start' || key === 'end') inputValue(key,toLocalInput(value)); else if (!['id','hospital','service'].includes(key)) inputValue(key,value); });
    } else Object.entries(row).forEach(([key,value]) => { if (key === 'start' || key === 'end') inputValue(key,toLocalInput(value)); else if (key === 'level') inputValue(key,levelKey(value)); else if (key !== 'id') inputValue(key,value); });
  } else if (type !== 'notice') {
    const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const inAnHour = new Date(now.getTime() + 60 * 60000);
    const end = new Date(inAnHour.getTime() + 4 * 60 * 60000);
    inputValue('start',inAnHour.toISOString().slice(0,16)); inputValue('end',end.toISOString().slice(0,16));
  }
  dialog.showModal();
}
function setChoice(selectId, otherId, value) {
  const select = $(`#${selectId}`), other = $(`#${otherId}`);
  const found = [...select.options].some(option => option.value === value);
  select.value = found ? value : 'Outro';
  other.disabled = select.value !== 'Outro';
  other.classList.toggle('hidden', select.value !== 'Outro');
  other.required = select.value === 'Outro';
  other.value = found ? '' : value;
}
function syncOther(selectId, otherId) {
  const select = $(`#${selectId}`), other = $(`#${otherId}`), isOther = select.value === 'Outro';
  other.disabled = !isOther; other.required = isOther; other.classList.toggle('hidden', !isOther);
  if (!isOther) other.value = '';
}
function fillCatalogSelect(selectId, values, placeholder) {
  const select = $(`#${selectId}`), oldValue = select.value;
  select.innerHTML = `<option value="" disabled>${placeholder}</option>${values.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('')}<option value="Outro">Outro…</option>`;
  select.value = values.includes(oldValue) || oldValue === 'Outro' ? oldValue : '';
}
function renderCatalog() {
  if (!BVACentralConfig.canEdit) return;
  fillCatalogSelect('hospital-select',catalog.hospitals,'Selecionar hospital');
  fillCatalogSelect('service-select',catalog.services,'Selecionar serviço');
  $('#hospital-catalog').innerHTML = catalog.hospitals.map(value=>`<li><span>${esc(value)}</span><button class="small-button delete" data-catalog-delete="hospital" data-value="${esc(value)}">Remover</button></li>`).join('') || '<li class="catalog-empty">Sem hospitais na lista.</li>';
  $('#service-catalog').innerHTML = catalog.services.map(value=>`<li><span>${esc(value)}</span><button class="small-button delete" data-catalog-delete="service" data-value="${esc(value)}">Remover</button></li>`).join('') || '<li class="catalog-empty">Sem serviços na lista.</li>';
}
async function addCatalogItem(type) {
  const field = type === 'hospital' ? $('#new-hospital') : $('#new-service');
  const value = field.value.trim();
  if (!value) { toast('Escreve um nome antes de adicionar.'); return; }
  try { catalog = await api('catalog',{method:'POST',body:JSON.stringify({type,value})}); field.value=''; render(); toast('Lista atualizada.'); }
  catch (error) { toast(error.message); }
}
async function removeCatalogItem(type,value) {
  try { catalog = await api(`catalog/${type}`,{method:'DELETE',body:JSON.stringify({value})}); render(); toast('Item removido da lista.'); }
  catch (error) { toast(error.message); }
}
function toast(message) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = message; document.body.append(el); setTimeout(() => el.remove(),2600); }

const weatherText = code => ({0:'Céu limpo',1:'Pouco nublado',2:'Parcialmente nublado',3:'Encoberto',45:'Nevoeiro',48:'Nevoeiro',51:'Chuvisco fraco',53:'Chuvisco',55:'Chuvisco forte',56:'Chuvisco gelado',57:'Chuvisco gelado',61:'Chuva fraca',63:'Chuva',65:'Chuva forte',66:'Chuva gelada',67:'Chuva gelada',71:'Neve fraca',73:'Neve',75:'Neve forte',77:'Grãos de neve',80:'Aguaceiros fracos',81:'Aguaceiros',82:'Aguaceiros fortes',85:'Neve',86:'Neve forte',95:'Trovoada',96:'Trovoada e granizo',99:'Trovoada e granizo'})[code] || 'Condição variável';
const weatherIcon = code => code === 0 ? '☀️' : [1,2].includes(code) ? '🌤️' : code === 3 ? '☁️' : [45,48].includes(code) ? '🌫️' : [95,96,99].includes(code) ? '⛈️' : code >= 71 && code <= 86 ? '🌨️' : '🌧️';
async function fetchWeather() {
  const forecast = $('#weather-forecast');
  try {
    const params = new URLSearchParams({latitude:'38.7597',longitude:'-9.2398',current:'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',hourly:'temperature_2m,precipitation,weather_code,wind_speed_10m',forecast_hours:'5',timezone:'Europe/Lisbon',wind_speed_unit:'kmh'});
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) throw new Error('weather request failed');
    const result = await response.json();
    const current = result.current;
    const upcoming = result.hourly.time.map((time,index)=>({time,index})).filter(item=>new Date(item.time).getTime()>new Date(current.time).getTime()).slice(0,3);
    const entries = [{label:'Agora',time:current.time,temperature:current.temperature_2m,code:current.weather_code,precipitation:current.precipitation,wind:current.wind_speed_10m,current:true},...upcoming.map(item=>{
      const end = new Date(item.time), start = new Date(end.getTime()-60*60*1000);
      return {label:`${timeOnly(start)}–${timeOnly(end)}`,time:item.time,temperature:result.hourly.temperature_2m[item.index],code:result.hourly.weather_code[item.index],precipitation:result.hourly.precipitation[item.index],wind:result.hourly.wind_speed_10m[item.index]};
    })];
    forecast.innerHTML = entries.map(item=>`<div class="weather-hour"><span class="weather-hour-label">${item.label}</span><span class="weather-symbol">${weatherIcon(item.code)}</span><strong>${Math.round(item.temperature)}°</strong><span class="weather-condition">${weatherText(item.code)}</span><span class="weather-rain">${Number(item.precipitation || 0).toFixed(1)} mm${item.current ? ' última hora' : ''}</span><span class="weather-wind">${Number(item.wind).toFixed(0)} km/h vento</span></div>`).join('');
    $('#weather-updated').textContent = `Atualizada às ${timeOnly(new Date())} · Open-Meteo`;
  } catch {
    forecast.innerHTML = '<div class="weather-loading">Previsão temporariamente indisponível. Verifica a ligação à internet.</div>';
    $('#weather-updated').textContent = 'Fonte: Open-Meteo';
  }
}
if (BVACentralConfig.canEdit) {
  $('#add-constraint').addEventListener('click',()=>openRecord('constraint'));
  $('#add-readiness').addEventListener('click',()=>openRecord('readiness'));
  $('#add-notice').addEventListener('click',()=>openRecord('notice'));
  $('#hospital-select').addEventListener('change',()=>syncOther('hospital-select','hospital-other'));
  $('#service-select').addEventListener('change',()=>syncOther('service-select','service-other'));
  $('#close-dialog').addEventListener('click',()=>dialog.close());
  $('#cancel-dialog').addEventListener('click',()=>dialog.close());
  $$('.admin-tab').forEach(btn => btn.addEventListener('click',()=>setTab(btn.dataset.tab)));
  $('#add-hospital-item').addEventListener('click',()=>addCatalogItem('hospital'));
  $('#add-service-item').addEventListener('click',()=>addCatalogItem('service'));
  $('#save-branding').addEventListener('click',()=>saveBranding());
  $('#upload-brand-logo').addEventListener('click',uploadBrandLogo);
  $('#remove-brand-logo').addEventListener('click',()=>saveBranding({logo_url:''}));
  $('#new-hospital').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();addCatalogItem('hospital');}});
  $('#new-service').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();addCatalogItem('service');}});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const fd = new FormData(form), row = {};
  for (const [key,value] of fd.entries()) if (key) row[key] = value;
  if (currentType === 'constraint') {
    row.hospital = row.hospital === 'Outro' ? row.hospitalOther.trim() : row.hospital;
    row.service = row.service === 'Outro' ? row.serviceOther.trim() : row.service;
    delete row.hospitalOther; delete row.serviceOther;
    if (!row.hospital || !row.service) { toast('Indica o hospital e o serviço.'); return; }
  }
  if (currentType === 'constraint' || currentType === 'readiness') {
    if (new Date(row.end) <= new Date(row.start)) { toast('A hora de fim tem de ser posterior ao início.'); return; }
    row.start = new Date(row.start).toISOString(); row.end = new Date(row.end).toISOString();
  }
  try {
    const body = JSON.stringify({type:currentType,row});
    if (editId) await api(`records/${editId}`,{method:'PUT',body});
    else await api('records',{method:'POST',body});
    dialog.close(); editId = null; await refreshRecords(); toast('Registo guardado.');
  } catch (error) { toast(error.message); }
});

document.addEventListener('click', event => {
  const edit = event.target.closest('[data-edit]');
  const del = event.target.closest('[data-delete]');
  const catalogDelete = event.target.closest('[data-catalog-delete]');
  if (catalogDelete) { removeCatalogItem(catalogDelete.dataset.catalogDelete,catalogDelete.dataset.value); return; }
  if (edit) {
    const bucket = edit.dataset.edit === 'constraint' ? 'constraints' : edit.dataset.edit === 'readiness' ? 'readiness' : 'notices';
    const row = data[bucket].find(item => item.id === edit.dataset.id); if (row) openRecord(edit.dataset.edit,row);
  }
  if (del) {
    api(`records/${del.dataset.id}`,{method:'DELETE'}).then(()=>refreshRecords()).then(()=>toast('Registo apagado.')).catch(error=>toast(error.message));
  }
});
}
window.addEventListener('hashchange',route);
route(); render(); updateClock(); refreshRecords(); loadBranding(); fetchWeather();
setInterval(updateClock,1000); setInterval(refreshRecords,15000); setInterval(fetchWeather,20*60*1000);
