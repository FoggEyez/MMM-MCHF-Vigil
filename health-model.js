/* Shared status rules; no credentials, I/O or external dependencies. */
(function (root) {
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  const level = (value, warn, critical) => !finite(value) ? 'yellow' : value >= critical ? 'red' : value >= warn ? 'yellow' : 'green';
  const worst = checks => checks.some(c => c.level === 'red') ? 'red' : checks.some(c => c.level === 'yellow') || !checks.length ? 'yellow' : 'green';
  const displayDetail = detail => typeof detail === 'string' ? detail.replace(/(-?\d+(?:\.\d+)?)°C\b/g, (_, value) => Math.round(Number(value) * 9 / 5 + 32) + '°F') : detail;
  function assess(snapshot, now = Date.now(), staleMs = 120000) {
    const fresh = finite(snapshot?.observedAt) && now - snapshot.observedAt <= staleMs && snapshot.observedAt <= now + 30000;
    const checks = fresh && Array.isArray(snapshot.checks) ? snapshot.checks.map(c => ({...c, detail: c.detail, level: ['green','yellow','red'].includes(c.level) ? c.level : 'yellow'})) : [];
    if (!fresh) checks.push({id:'feed',name:'Server monitoring feed',level:'yellow',detail:snapshot?.observedAt ? 'External snapshot is stale' : 'Waiting for a valid snapshot'});
    if (fresh && !checks.length) checks.push({id:'empty',name:'Server checks',level:'yellow',detail:'No readings available'});
    return {fresh,checks,level:worst(checks),metrics:fresh ? snapshot.metrics || {} : {}};
  }
  function storageHeadroom(disk){
    if(!finite(disk?.total)||!finite(disk?.used)||disk.total<=0||disk.used<0||disk.used>disk.total)return null;
    const ratio=disk.used/disk.total;
    if(ratio>=.9)return {level:'red',bytes:0,threshold:90};
    const threshold=ratio>=.8?90:80;
    return {level:ratio>=.8?'yellow':'green',bytes:Math.max(0,disk.total*threshold/100-disk.used),threshold};
  }
  function viewOptions(config={},position='bottom_bar'){
    const choice=(value,allowed,fallback)=>allowed.includes(value)?value:fallback;
    const number=(value,min,max,fallback)=>finite(value)?Math.min(max,Math.max(min,value)):fallback;
    let placement=choice(config.placement,['auto','region','top','bottom','top-left','top-right','bottom-left','bottom-right','center-left','center-right'],'auto');
    if(placement==='auto')placement=position==='bottom_bar'?'bottom':position==='top_bar'?'top':'region';
    const layout=choice(config.layout,['auto','bar','panel'],'auto');
    return {density:choice(config.density,['comfortable','compact','ultra'],'compact'),placement,layout:layout==='auto'?(['top','bottom'].includes(placement)||(placement==='region'&&['top_bar','bottom_bar'].includes(position))?'bar':'panel'):layout,panelWidth:number(config.panelWidth,280,1200,380),horizontalMargin:number(config.horizontalMargin,0,100,12),verticalMargin:number(config.verticalMargin,0,100,6),offsetX:number(config.offsetX,-500,500,0),offsetY:number(config.offsetY,-500,500,0),backgroundOpacity:number(config.backgroundOpacity,0,100,96),textSize:choice(config.textSize,['normal','large'],'normal')};
  }
  const api = {finite,level,worst,assess,storageHeadroom,viewOptions};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SystemWatchHealth = api;
})(typeof window === 'undefined' ? globalThis : window);
