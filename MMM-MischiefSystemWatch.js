/* global Module, SystemWatchHealth */
Module.register('MMM-MischiefSystemWatch', {
  requiresVersion: '2.38.0',
  defaults: {density:'compact',layout:'auto',placement:'auto',panelWidth:380,horizontalMargin:12,verticalMargin:6,offsetX:0,offsetY:0,textSize:'normal',backgroundOpacity:96,showMirror:true,showExternal:true,showLegend:true,staleSeconds:120,snapshotFile:'',displayService:'',pollSeconds:5},
  getStyles() { return [this.file('MMM-MischiefSystemWatch.css')]; },
  getScripts() { return [this.file('health-model.js')]; },
  start() { this.readings = null; this.sendSocketNotification('WATCH_START', this.config); this.timer = setInterval(() => this.updateDom(0), 5000); },
  suspend() { clearInterval(this.timer); },
  resume() { clearInterval(this.timer); this.timer = setInterval(() => this.updateDom(0), 5000); this.sendSocketNotification('WATCH_START', this.config); },
  socketNotificationReceived(name, data) { if (name === 'WATCH_DATA') { this.readings = data; this.updateDom(0); } },
  element(tag, cls, text) { const el = document.createElement(tag); el.className = cls; if (text !== undefined) el.textContent = text; return el; },
  getDom() {
    const H = SystemWatchHealth, now = Date.now(), local = H.assess(this.readings?.local, now, Math.max(20000, this.config.pollSeconds * 3000));
    const groups = [];
    if (this.config.showMirror !== false) groups.push(['MIRROR', local]);
    if (this.config.showExternal !== false && this.config.snapshotFile) groups.push(['EXTERNAL SYSTEMS', H.assess(this.readings?.remote, now, Math.max(30, this.config.staleSeconds) * 1000)]);
    const checks = groups.flatMap(([,value]) => value.checks), status = H.worst(checks), view = H.viewOptions(this.config, this.data?.position || 'bottom_bar');
    const shell = this.element('section', `sw-panel sw-density-${view.density} sw-layout-${view.layout} sw-placement-${view.placement} sw-text-${view.textSize}`);
    shell.setAttribute('aria-label', 'Mischief System Watch');
    for (const [key,value] of Object.entries({'--sw-width':view.panelWidth+'px','--sw-margin-x':view.horizontalMargin+'px','--sw-margin-y':view.verticalMargin+'px','--sw-offset-x':view.offsetX+'px','--sw-offset-y':view.offsetY+'px','--sw-alpha':view.backgroundOpacity/100})) shell.style.setProperty(key,value);
    const header = this.element('div','sw-header');
    header.append(this.element('strong','sw-brand','MISCHIEF SYSTEM WATCH'), this.element('span', status, !checks.length ? 'No checks enabled' : status === 'green' ? 'Systems healthy' : status === 'red' ? 'Attention needed' : 'Readings need review'));
    shell.append(header);
    const body = this.element('div','sw-body'); body.style.setProperty('--sw-columns', `repeat(${Math.max(1,groups.length)},minmax(0,1fr))`);
    for (const [title, group] of groups) {
      const section = this.element('div','sw-section'); section.append(this.element('h3','sw-section-title',title));
      for (const check of group.checks) {
        const row = this.element('div','sw-row'), copy = this.element('div','sw-row-copy');
        copy.append(this.element('span','sw-row-name',check.name), this.element('small','',check.detail));
        row.append(this.element('span','sw-light '+check.level),copy); section.append(row);
      }
      body.append(section);
    }
    shell.append(body);
    if (this.config.showLegend !== false) shell.append(this.element('div','sw-footer','Green: healthy · Yellow: unknown or warning · Red: attention'));
    return shell;
  }
});
