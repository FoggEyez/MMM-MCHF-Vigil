const NodeHelper=require('node_helper');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {execFile}=require('node:child_process');
const {level}=require('./health-model.js');
const command=(file,args)=>new Promise(resolve=>execFile(file,args,{timeout:2000,maxBuffer:4096,windowsHide:true},(err,out)=>resolve(err?null:out.trim())));
module.exports=NodeHelper.create({
  start(){this.running=false;this.previous=null;this.stopped=false;},
  socketNotificationReceived(name,config){if(name==='WATCH_START'&&!this.running){this.config=config||{};this.running=true;this.stopped=false;this.sample();}},
  async sample(){
    let remote=null;
    try{const file=this.config.snapshotFile;if(!file||!path.isAbsolute(file))throw Error('No external feed configured');const info=await fs.stat(file);if(info.size<=131072){const data=JSON.parse(await fs.readFile(file,'utf8'));if(data.version===1&&Array.isArray(data.checks)&&data.checks.length<=100)remote=data;}}catch{}
    const checks=[],metrics={},add=(id,name,status,detail)=>checks.push({id,name,level:status,detail});
    const cpus=os.cpus(),total=cpus.reduce((s,c)=>s+Object.values(c.times).reduce((a,b)=>a+b,0),0),idle=cpus.reduce((s,c)=>s+c.times.idle,0);
    metrics.cpu=this.previous&&total>this.previous.total?100*(1-(idle-this.previous.idle)/(total-this.previous.total)):null;this.previous={total,idle};
    try{const memory=await fs.readFile('/proc/meminfo','utf8'),available=Number(memory.match(/^MemAvailable:\s+(\d+)/m)?.[1])*1024;metrics.memory=Number.isFinite(available)?100*(1-available/os.totalmem()):null;}catch{metrics.memory=null;}
    try{metrics.temperature=Number(await fs.readFile('/sys/class/thermal/thermal_zone0/temp','utf8'))/1000;}catch{metrics.temperature=null;}
    metrics.uptime=os.uptime();
    add('pi-cpu','Mirror CPU',level(metrics.cpu,80,95),metrics.cpu===null?'Measuring…':Math.round(metrics.cpu)+'% used');
    add('pi-memory','Mirror memory',level(metrics.memory,85,95),metrics.memory===null?'Unavailable':Math.round(metrics.memory)+'% used');
    add('pi-temp','Mirror temperature',level(metrics.temperature,70,80),metrics.temperature===null?'Sensor unavailable':metrics.temperature.toFixed(1)+'°C');
    try{const disk=await fs.statfs(os.homedir()),used=100*(1-disk.bfree/disk.blocks);add('pi-disk','Mirror SD storage',level(used,80,90),Math.round(used)+'% used');}catch{add('pi-disk','Mirror SD storage','yellow','Capacity unavailable');}
    const [display,throttle]=await Promise.all([this.config.displayService?command('systemctl',['--user','is-active',this.config.displayService]):Promise.resolve(null),command('vcgencmd',['get_throttled'])]);
    if(this.config.displayService)add('pi-display','Mirror display',display==='active'?'green':'red',display==='active'?'Kiosk running':'Kiosk status needs attention');
    const match=throttle?.match(/^throttled=0x([a-f0-9]+)$/i),bits=match?parseInt(match[1],16):null;
    add('pi-power','Mirror power / throttling',bits===null?'yellow':bits&0xf?'red':bits&0xf0000?'yellow':'green',bits===null?'Power check unavailable':bits&0xf?'Undervoltage / throttling now':bits&0xf0000?'Power / heat warning since boot':'Power and clocks normal');
    if(!this.stopped){this.sendSocketNotification('WATCH_DATA',{remote,local:{observedAt:Date.now(),checks,metrics}});this.timer=setTimeout(()=>this.sample(),Math.max(5,Math.min(60,Number(this.config.pollSeconds)||5))*1000);}
  },
  stop(){this.stopped=true;clearTimeout(this.timer);}
});
