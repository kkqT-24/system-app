/* ==========================================================
   THE CREW (Claude build, Core v3.0) — home screen characters.
   gbot (Grok's energy core) on the left, Claude (the stone with
   the shard halo) on the right, Noctis (Muse) asleep in the middle,
   floating in OLED black over a sparse starfield, with one shared
   conversation between them.
   - gbot speaks the Daily Briefing feed; tap opens the briefing,
     the X by his name opens X.
   - Claude reads data/claude.json; tap repeats the latest, hold
     runs a scan of what's fresh.
   - Noctis reads data/noctis.json (written by Muse); a new message
     wakes him. Tap wakes him, hold 1.5s reboots the system.
   - Hold the conversation to open today's whole thread in place.
   ========================================================== */


(function(){
  var TAU=Math.PI*2,REDUCE=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var COL={calm:["#ff9f6b","#d9603b"],focus:["#efe6d8","#a8927a"],flag:["#ff6b7d","#b0263c"]};
  var STATES={
    idle:{col:"calm",lev:.22,tag:"Claude",cls:"",line:"All quiet. Next check at 4:30."},
    unread:{col:"calm",lev:.35,tag:"Claude · new",cls:"",line:"Morning Protocol is up. Five items."},
    focus:{col:"focus",lev:.3,tag:"Claude · focus",cls:"focus",line:"Big gap overnight. No shorts from the box today."},
    flag:{col:"flag",lev:.45,tag:"Claude · flag",cls:"flag",line:"Gateway wasn't up at 9:20. Log in before the open."},
    asleep:{col:"calm",lev:.04,tag:"Claude · resting",cls:"asleep",line:"Nothing needs you right now."},
    clear:{col:"calm",lev:.22,tag:"Claude",cls:"",line:"Protocol clear. +10 EXP."}
  };
  var SPEAK=["Drop's in. Both tickers complete. Logs page updated.","Queue for Monday: round-number spec, NOISE correlation, rewards design.","Login confirmed at 9:12. Laptop's up. You're set."];
  function rgba(h,a){var n=parseInt(h.slice(1),16);return "rgba("+(n>>16)+","+(n>>8&255)+","+(n&255)+","+a+")";}
  function haze(g,x,y,r,A,B,a){var h=g.createRadialGradient(x,y,2,x,y,r);h.addColorStop(0,rgba(A,a));h.addColorStop(1,rgba(B,0));g.fillStyle=h;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();}

  /* one shared character state; every instance renders it */
  var st={name:"idle",speaking:false,clearT:-9,lineIdx:0};
  var EXTRA={fissure:true,ignite:false,sparks:true,core:false,seam:false,sigil:false,trails:false};
  var EXTRA_LABEL={fissure:"Fissure flash",ignite:"Rock ignite",core:"Inner fire",seam:"Molten seam",sigil:"Sigil",sparks:"Rock embers",trails:"Ember trails"};

  function Eyes(){this.nb=0;this.bt=-1;this.lx=0;this.ly=0;this.tx=0;this.ty=0;this.nl=0;}
  Eyes.prototype.step=function(t,k,forward){
    if(!this.nb){this.nb=t+3+Math.random()*3;this.nl=t+3;}
    if(t>=this.nb&&this.bt<0){this.bt=t;this.nb=t+4+Math.random()*5;}
    var open=1;if(this.bt>=0){var p=(t-this.bt)/0.24;if(p>=1)this.bt=-1;else open=Math.max(.08,Math.abs(1-p*2));}
    if(forward){this.tx=0;this.ty=.3;this.nl=t+1;}
    else if(t>=this.nl){var away=this.tx||this.ty;if(away||Math.random()<.6){this.tx=0;this.ty=0;this.nl=t+4+Math.random()*4;}else{this.tx=[-2.4,2.2,-1.2,1.6][Math.random()*4|0];this.ty=[-.8,1,.6,-1.2][Math.random()*4|0];this.nl=t+1.4+Math.random()*1.4;}}
    var e=1-Math.pow(.93,k);this.lx+=(this.tx-this.lx)*e;this.ly+=(this.ty-this.ly)*e;return open;
  };

  function Char(classic){
    this.classic=!!classic;this.sp=[];this.fis=[];
    this.seam=[[-19,6],[-14,8],[-11,13],[-6,14],[-3,19]];
    this.eyes=new Eyes();this.level=.2;this.amt={focus:0,flag:0,sleep:0,unread:0};this.waves=[];this.lastWave=0;this.rot=0;this.drot=0;
    this.dust=[];for(var i=0;i<60;i++)this.dust.push({a:i/60*TAU+Math.random()*.08,r:.92+Math.random()*.16,s:.6+Math.random(),hot:Math.random()<.3});
    this.rocks=[];for(i=0;i<13;i++){var pts=[],n=4+(Math.random()*3|0),big=i%5===0?1.6:1;
      for(var j=0;j<n;j++){var a=j/n*TAU+Math.random()*.5;pts.push([Math.cos(a)*(2+Math.random()*2)*big,Math.sin(a)*(1.6+Math.random()*1.7)*big]);}
      this.rocks.push({o:i/13*TAU+Math.random()*.2,pts:pts,spin:Math.random()*6,sp:(Math.random()-.5)*.7,tum:Math.random()*6,tsp:.3+Math.random()*.6,r:38+Math.random()*5,ph:Math.random()*6});}
    this.pits=[];for(i=0;i<16;i++){var pa=Math.random()*TAU,pr=Math.sqrt(Math.random())*20;this.pits.push([Math.cos(pa)*pr,Math.sin(pa)*pr,.4+Math.random()*.9]);}
  }
  Char.prototype.ringPos=function(a,r,c,cy,tilt,sq){var x=Math.cos(a)*r,y=Math.sin(a)*r*sq;return [c+x*Math.cos(tilt)-y*Math.sin(tilt),cy+x*Math.sin(tilt)+y*Math.cos(tilt)];};
  Char.prototype.draw=function(g,t,k,c){
    var S=STATES[st.name],col=COL[S.col],A=col[0],B=col[1],self=this,am=this.amt;
    var target={focus:st.name==="focus"?1:0,flag:st.name==="flag"?1:0,sleep:st.name==="asleep"?1:0,unread:st.name==="unread"?1:0};
    var ease=1-Math.pow(.95,k);for(var key in am)am[key]+=(target[key]-am[key])*ease;
    var ct=t-st.clearT,clr=ct>=0&&ct<1.8?Math.sin(ct/1.8*Math.PI):0;
    var lev=st.speaking?.8:S.lev;lev=Math.max(lev,clr,CCH*.9);this.level+=(lev-this.level)*(1-Math.pow(.97,k));lev=this.level;
    var speed=(.08+lev*.12)*(1-am.sleep*.7)+clr*.5+CCH*CCH*3.2;this.rot+=speed*k/60;
    var tilt=-.3,sq=.26,cy=c+Math.sin(t*(.7-am.sleep*.35))*1.2*(1+am.unread*.8),R=23;
    var rr=1-am.focus*.1+clr*.16-CCH*.14;
    /* random events, like gbot's lightning: a crack flashes across the stone, or a rock catches fire */
    if(!this.classic){
      var rate=(.0035+lev*.014)*k*(1-am.sleep*.85)*(1+am.flag*1.5);
      if(EXTRA.fissure&&(Math.random()<rate||this.forceFis)){this.forceFis=false;var fa=[.25,.7,1.2,1.9,2.5,2.9,-.4,-2.7][Math.random()*8|0]+(Math.random()-.5)*.3,fx=Math.cos(fa)*21,fy=Math.sin(fa)*21,dir=fa+Math.PI+(Math.random()-.5)*.6,fp=[[fx,fy]],br=null;
        for(var fj=0;fj<6;fj++){dir+=(Math.random()-.5)*1.1;fx+=Math.cos(dir)*4;fy+=Math.sin(dir)*4;if(Math.abs(fy+1)<6&&Math.abs(fx)<13)break;fp.push([fx,fy]);
          if(!br&&fj===2&&Math.random()<.6){var bd=dir+(Math.random()<.5?-1:1)*.9;br=[[fx,fy],[fx+Math.cos(bd)*4,fy+Math.sin(bd)*4],[fx+Math.cos(bd)*7.5,fy+Math.sin(bd)*7.5+(Math.random()-.5)*2]];}}
        this.fis.push({p:fp,b:br,life:1});
        for(var fe=0;fe<3;fe++){var fq=fp[Math.random()*fp.length|0];this.sp.push({x:c+fq[0],y:cy+fq[1],vx:(Math.random()-.5)*.4,vy:-(.2+Math.random()*.4),life:1,ph:Math.random()*6,rel:false});}}
      this.nextIgn=this.nextIgn||t+2;
      if(EXTRA.ignite&&(Math.random()<rate*.6||t>this.nextIgn)){var selfR=this,fr=this.rocks.filter(function(r){return Math.sin(r.o+selfR.rot*.85+.6)>.15&&!(r.hot>.05);});
        if(fr.length){fr[Math.random()*fr.length|0].hot=1;this.nextIgn=t+(5+Math.random()*4)*(am.sleep>.5?4:1);}}
    }
    /* aura */
    haze(g,c,c,64,A,B,(.12+lev*.1)*(1-am.sleep*.6)+clr*.15);
    /* pulse waves: speaking, flag (slow), clear */
    var wantWave=(st.speaking&&t-this.lastWave>1.3)||(am.flag>.5&&t-this.lastWave>2.4);
    if(wantWave){this.waves.push({r:25,life:1,col:A});this.lastWave=t;}
    if(ct>=0&&ct<.05&&!this.clearWaved){this.waves.push({r:24,life:1.2,col:"#fff1e4"});this.clearWaved=true;}if(ct>2)this.clearWaved=false;
    g.globalCompositeOperation="lighter";
    for(var i=this.waves.length-1;i>=0;i--){var w=this.waves[i];w.r+=.45*k;w.life-=.014*k;if(w.life<=0){this.waves.splice(i,1);continue;}
      g.globalAlpha=Math.min(1,w.life)*.5;g.strokeStyle=w.col;g.lineWidth=1;g.beginPath();g.arc(c,c,w.r,0,TAU);g.stroke();}
    g.globalAlpha=1;
    function dust(front){g.globalCompositeOperation="lighter";
      self.dust.forEach(function(p){var a=p.a+self.rot,d=Math.sin(a);if((d>0)!==front)return;
        var P=self.ringPos(a,40*p.r*rr,c,c,tilt,sq);g.globalAlpha=Math.max(.08,.35+d*.5)*(1-am.sleep*.55);g.fillStyle=p.hot?"#fff1e4":A;g.fillRect(P[0]-p.s/2,P[1]-p.s/2,p.s,p.s);});
      g.globalAlpha=1;}
    function rocks(front){
      self.rocks.forEach(function(r){var a=r.o+self.rot*.85,d=Math.sin(a);if((d>0)!==front)return;
        var P=self.ringPos(a,r.r*rr,c,c,tilt,sq);
        if(EXTRA.trails){var TL=.75,T0p=self.ringPos(a-TL,r.r*rr,c,c,tilt,sq),lg=g.createLinearGradient(T0p[0],T0p[1],P[0],P[1]),ta=(front?.75:.35)*(1-am.sleep*.7)+lev*.2;
          lg.addColorStop(0,rgba(A,0));lg.addColorStop(.6,rgba(A,ta*.45));lg.addColorStop(1,rgba("#fff1e4",Math.min(1,ta)));g.globalCompositeOperation="lighter";g.globalAlpha=1;g.strokeStyle=lg;g.lineCap="round";
          g.shadowColor=A;g.shadowBlur=front?5:2;g.lineWidth=front?1.8:1.1;
          g.beginPath();for(var q=0;q<=14;q++){var Q=self.ringPos(a-TL+TL*q/14,r.r*rr,c,c,tilt,sq);if(q)g.lineTo(Q[0],Q[1]);else g.moveTo(Q[0],Q[1]);}g.stroke();g.shadowBlur=0;g.lineCap="butt";}
        if(EXTRA.sparks&&front&&Math.random()<(.013+lev*.03)*k*(1-am.sleep))self.sp.push({x:P[0],y:P[1],vx:(Math.random()-.5)*.3,vy:-(.15+Math.random()*.35),life:1,ph:Math.random()*6});
        if(am.flag>.05){P[0]+=Math.sin(t*31+r.ph)*.7*am.flag;P[1]+=Math.cos(t*27+r.ph)*.7*am.flag;}
        var ro=r.spin+t*r.sp*(1-am.sleep*.7),cs=Math.cos(ro),sn=Math.sin(ro),tm=Math.cos(r.tum+t*r.tsp*(1-am.sleep*.7))*.55+.45,sc=front?1:.82;
        var pts=r.pts.map(function(p){var x=p[0]*tm,y=p[1];return [P[0]+(x*cs-y*sn)*sc,P[1]+(x*sn+y*cs)*sc];});
        g.globalCompositeOperation="source-over";g.globalAlpha=front?1:.55;
        g.beginPath();pts.forEach(function(p,i){if(i)g.lineTo(p[0],p[1]);else g.moveTo(p[0],p[1]);});g.closePath();
        g.fillStyle="#1d1824";g.fill();
        if(r.hot>0){var hv=Math.min(1,r.hot*1.4);g.globalCompositeOperation="lighter";
          var hg=g.createRadialGradient(P[0],P[1],0,P[0],P[1],11);hg.addColorStop(0,rgba(A,hv*.75));hg.addColorStop(1,rgba(B,0));g.fillStyle=hg;g.fillRect(P[0]-11,P[1]-11,22,22);
          g.beginPath();pts.forEach(function(p,i){if(i)g.lineTo(p[0],p[1]);else g.moveTo(p[0],p[1]);});g.closePath();
          g.shadowColor=A;g.shadowBlur=10*hv;g.fillStyle=rgba(A,hv);g.fill();g.fillStyle=rgba("#fff1e4",hv*hv*.85);g.fill();g.shadowBlur=0;
          if(r.hot>.3&&Math.random()<.35*k)self.sp.push({x:P[0]+(Math.random()-.5)*3,y:P[1],vx:(Math.random()-.5)*.35,vy:-(.25+Math.random()*.4),life:1,ph:Math.random()*6});
          r.hot-=.0065*k;}
        /* lit edges: the ones facing the warm light (low right) */
        g.globalCompositeOperation="lighter";g.lineWidth=.8;
        for(var j=0;j<pts.length;j++){var p0=pts[j],p1=pts[(j+1)%pts.length],nx=p1[1]-p0[1],ny=-(p1[0]-p0[0]),len=Math.hypot(nx,ny)||1,lit=(nx*.7+ny*.7)/len;
          if(lit>0){g.strokeStyle=rgba(A,Math.min(1,(.25+lit*.6)*(front?1:.6)*(1-am.sleep*.5)+clr*.4));g.beginPath();g.moveTo(p0[0],p0[1]);g.lineTo(p1[0],p1[1]);g.stroke();}}
        g.globalAlpha=1;});
    }
    if(!this.classic){dust(false);rocks(false);}else{dust(false);}
    /* the stone */
    g.globalCompositeOperation="source-over";
    var sg=g.createRadialGradient(c-8,cy-9,1,c,cy,R);sg.addColorStop(0,"#3b3244");sg.addColorStop(.55,"#17131f");sg.addColorStop(1,"#08070e");
    g.fillStyle=sg;g.beginPath();g.arc(c,cy,R,0,TAU);g.fill();
    g.save();g.beginPath();g.arc(c,cy,R,0,TAU);g.clip();
    if(!this.classic)this.pits.forEach(function(p){g.fillStyle="rgba(0,0,0,.28)";g.beginPath();g.arc(c+p[0],cy+p[1],p[2],0,TAU);g.fill();g.fillStyle="rgba(255,240,225,.05)";g.beginPath();g.arc(c+p[0]-.4,cy+p[1]-.4,p[2]*.6,0,TAU);g.fill();});
    g.globalCompositeOperation="lighter";
    var X=!this.classic;
    if(X&&EXTRA.core){var cg=g.createRadialGradient(c,cy+R*.75,1,c,cy+R*.5,R*1.05);cg.addColorStop(0,rgba(A,(.32+.12*Math.sin(t*1.1)+lev*.2)*(1-am.sleep*.6)));cg.addColorStop(1,rgba(B,0));g.fillStyle=cg;g.fillRect(c-R,cy-R,R*2,R*2);}
    if(X&&EXTRA.seam){var sgl=(.5+.25*Math.sin(t*1.2)+lev*.35)*(1-am.sleep*.6);g.beginPath();this.seam.forEach(function(p,i){if(i)g.lineTo(c+p[0],cy+p[1]);else g.moveTo(c+p[0],cy+p[1]);});
      g.strokeStyle=rgba(A,Math.min(1,sgl));g.lineWidth=2.2;g.shadowColor=A;g.shadowBlur=6;g.stroke();g.shadowBlur=0;g.strokeStyle=rgba("#fff1e4",Math.min(1,sgl*.8));g.lineWidth=.7;g.stroke();}
    for(var fi=this.fis.length-1;fi>=0;fi--){var F=this.fis[fi],fl=F.life;F.life-=.028*k;if(F.life<=0){this.fis.splice(fi,1);continue;}
      var flick=fl>.75?(Math.random()<.5?1:.55):1;
      [F.p,F.b].forEach(function(line){if(!line)return;g.beginPath();line.forEach(function(p,i){if(i)g.lineTo(c+p[0],cy+p[1]);else g.moveTo(c+p[0],cy+p[1]);});
        g.strokeStyle=rgba(A,Math.min(1,fl*1.1)*flick);g.lineWidth=1+fl*2;g.shadowColor=A;g.shadowBlur=9*fl;g.stroke();g.shadowBlur=0;
        g.strokeStyle=rgba("#fff1e4",fl*fl*flick);g.lineWidth=.7;g.stroke();});}
    var rim=g.createRadialGradient(c+15,cy+15,1,c+15,cy+15,25);rim.addColorStop(0,rgba(A,(.38+lev*.15)*(1-am.sleep*.5)));rim.addColorStop(1,rgba(A,0));
    g.fillStyle=rim;g.fillRect(c-R,cy-R,R*2,R*2);g.restore();
    g.globalCompositeOperation="source-over";g.strokeStyle=rgba(A,.28*(1-am.sleep*.5));g.lineWidth=.8;g.beginPath();g.arc(c,cy,R,-.3,1.9);g.stroke();
    /* eyes */
    var open=this.eyes.step(t,k,am.unread>.5||st.speaking);
    var ex=c+this.eyes.lx,ey=cy-1+this.eyes.ly,ew=3.4*(1-am.focus*.08),eh=1.7*open*(1-am.focus*.42)*(1+am.flag*.25)*(1+am.unread*.15);
    eh=eh*(1-am.sleep)+.35*am.sleep;
    if(st.speaking)eh*=1+.08*Math.sin(t*9);
    g.globalCompositeOperation="lighter";g.shadowColor=A;g.shadowBlur=(8+lev*6)*(1-am.sleep*.7);g.fillStyle="#fff1e4";g.globalAlpha=(.75+lev*.25)*(1-am.sleep*.55);
    [ex-6.4,ex+6.4].forEach(function(x){g.beginPath();g.ellipse(x,ey+am.sleep*1,ew,Math.max(.3,eh),0,0,TAU);g.fill();});
    g.shadowBlur=0;g.globalAlpha=1;
    if(!this.classic&&EXTRA.sigil){var gx=c+this.eyes.lx*.4,gy=cy-12+this.eyes.ly*.3,ga=(.45+lev*.5)*(1-am.sleep*.6);
      g.globalCompositeOperation="lighter";g.strokeStyle=rgba(A,ga);g.lineWidth=1;g.lineCap="round";g.shadowColor=A;g.shadowBlur=4+lev*4;
      g.beginPath();g.moveTo(gx,gy-3.4);g.lineTo(gx,gy+2.6);g.moveTo(gx-3,gy-2.6);g.lineTo(gx,gy);g.lineTo(gx+3,gy-2.6);g.stroke();
      g.shadowBlur=0;g.lineCap="butt";}
    if(!this.classic){rocks(true);}dust(true);
    if(this.sp.length){g.globalCompositeOperation="lighter";for(var si=this.sp.length-1;si>=0;si--){var sp=this.sp[si];sp.x+=(sp.vx+Math.sin(t*2+sp.ph)*.12)*k;sp.y+=sp.vy*k;sp.life-=.014*k;
      if(sp.life<=0){this.sp.splice(si,1);continue;}g.globalAlpha=sp.life;g.fillStyle=sp.life>.6?"#fff1e4":A;g.fillRect(sp.x-.8,sp.y-.8,1.6,1.6);}g.globalAlpha=1;}
    /* unread: a bright mote circling close */
    if(am.unread>.02){var ma=t*1.6,M=this.ringPos(ma,30,c,c,tilt,.3);if(Math.sin(ma)>0||true){g.globalCompositeOperation="lighter";g.globalAlpha=am.unread*(Math.sin(ma)>0?1:.4);
      g.shadowColor=A;g.shadowBlur=8;g.fillStyle="#fff1e4";g.beginPath();g.arc(M[0],M[1],1.8,0,TAU);g.fill();g.shadowBlur=0;g.globalAlpha=1;}}
    /* asleep: slow drifting z-motes */
    if(am.sleep>.3){var zt=(t*.25)%1;g.globalCompositeOperation="lighter";g.globalAlpha=am.sleep*(1-zt)*.5;g.fillStyle=A;g.fillRect(c+18+zt*8,cy-20-zt*14,1.6,1.6);g.globalAlpha=1;}
  };


  /* gbot's energy core, ported from the app's intel.js (chill mood) */
  function Core(){
    this.shells=[];this.sparks=[];this.arcs=[];this.level=0;this.REST=[2.6,-1.6];
    this.eye={nextBlink:0,blinkT:-1,lx:2.6,ly:-1.6,tx:2.6,ty:-1.6,nextLook:0};
    for(var k=0;k<3;k++){var pts=[];for(var i=0;i<46;i++)pts.push({a:i/46*TAU+Math.random()*.1,r:.9+Math.random()*.2,s:.6+Math.random()*1.1,hot:Math.random()<.35});
      this.shells.push({tilt:[.25,1.15,2.1][k],squash:[.38,.5,.3][k],speed:[.26,-.19,.36][k],R:[30,34,26][k],pts:pts});}
  }
  Core.prototype.bolt=function(x0,y0,ang,len){var pts=[[x0,y0]],x=x0,y=y0,segs=5+(Math.random()*4|0);for(var i=0;i<segs;i++){ang+=(Math.random()-.5)*.9;x+=Math.cos(ang)*len/segs;y+=Math.sin(ang)*len/segs;pts.push([x,y]);}return pts;};
  Core.prototype.draw=function(g,t,k,c,speaking){
    var A="#67e8f9",B="#8f5ef8",self=this,eye=this.eye,REST=this.REST;
    this.level+=(Math.max(speaking?.75:.3,.3+GCH*.7)-this.level)*(1-Math.pow(.975,k));var level=this.level;
    g.globalCompositeOperation="lighter";
    var pulse=.5+.5*Math.sin(t*(1.1+level*1.2));
    var hz=g.createRadialGradient(c,c,4,c,c,62);hz.addColorStop(0,rgba(A,.22+level*.12));hz.addColorStop(.45,rgba(B,.1+level*.08));hz.addColorStop(1,rgba(B,0));
    g.fillStyle=hz;g.beginPath();g.arc(c,c,62,0,TAU);g.fill();
    this.shells.forEach(function(sh,kk){var rot=t*sh.speed*(1+level*.8),ct=Math.cos(sh.tilt),st2=Math.sin(sh.tilt);
      sh.pts.forEach(function(p){var a=p.a+rot,x=Math.cos(a)*sh.R*p.r,y=Math.sin(a)*sh.R*p.r*sh.squash,X=c+x*ct-y*st2,Y=c+x*st2+y*ct,depth=Math.sin(a);
        g.globalAlpha=Math.max(.08,.35+depth*.45)*(.7+level*.3);g.fillStyle=p.hot?(kk===1?B:"#ffffff"):A;g.fillRect(X-p.s/2,Y-p.s/2,p.s,p.s);});});
    if(Math.random()<(.0025+level*.012+(t<(this.boostUntil||0)?.07:0)+GCH*GCH*.35)*k){var ang=Math.random()*TAU,r0=12+Math.random()*6;this.arcs.push({pts:this.bolt(c+Math.cos(ang)*r0,c+Math.sin(ang)*r0,ang,18+Math.random()*(16+level*10)),life:1,w:.7+Math.random()*.9,hue:Math.random()<.5?A:B});}
    for(var i=this.arcs.length-1;i>=0;i--){var ar=this.arcs[i];ar.life-=.045*k;if(ar.life<=0){this.arcs.splice(i,1);continue;}
      g.globalAlpha=ar.life;g.strokeStyle=ar.hue;g.lineWidth=ar.w*2.6;g.shadowColor=ar.hue;g.shadowBlur=8;
      g.beginPath();ar.pts.forEach(function(p,j){if(j)g.lineTo(p[0],p[1]);else g.moveTo(p[0],p[1]);});g.stroke();
      g.strokeStyle="#fff";g.lineWidth=ar.w*.7;g.shadowBlur=0;g.stroke();}
    if(Math.random()<(.12+level*.12)*k){var sa=Math.random()*TAU;this.sparks.push({x:c+Math.cos(sa)*14,y:c+Math.sin(sa)*14,vx:Math.cos(sa)*(.25+Math.random()*.6),vy:Math.sin(sa)*(.25+Math.random()*.6),life:1,hue:Math.random()<.6?A:"#ffffff"});}
    for(var q=this.sparks.length-1;q>=0;q--){var sp=this.sparks[q],dmp=Math.pow(.985,k);sp.x+=sp.vx*k;sp.y+=sp.vy*k;sp.vx*=dmp;sp.vy*=dmp;sp.life-=.012*k;
      if(sp.life<=0){this.sparks.splice(q,1);continue;}g.globalAlpha=sp.life;g.fillStyle=sp.hue;g.fillRect(sp.x-.8,sp.y-.8,1.6,1.6);}
    var cr=11+pulse*2+level*3,cg=g.createRadialGradient(c,c,0,c,c,cr*1.9);
    cg.addColorStop(0,"rgba(255,255,255,1)");cg.addColorStop(.28,rgba(A,.95));cg.addColorStop(.6,rgba(B,.45));cg.addColorStop(1,rgba(B,0));
    g.globalAlpha=1;g.shadowBlur=0;g.fillStyle=cg;g.beginPath();g.arc(c,c,cr*1.9,0,TAU);g.fill();
    g.globalAlpha=.35+pulse*.3;g.strokeStyle=rgba(A,.9);g.lineWidth=.8;g.beginPath();g.arc(c,c,19+level*2,t*.6,t*.6+Math.PI*1.4);g.stroke();
    g.strokeStyle=rgba(B,.8);g.beginPath();g.arc(c,c,22,-t*.4,-t*.4+Math.PI*.9);g.stroke();
    g.globalAlpha=1;g.globalCompositeOperation="source-over";
    if(!eye.nextBlink){eye.nextBlink=t+2+Math.random()*3;eye.nextLook=t+1.5;}
    if(t>=eye.nextBlink&&eye.blinkT<0){eye.blinkT=t;eye.nextBlink=t+2.5+Math.random()*3.5+(Math.random()<.2?-2.2:0);}
    var open=1;if(eye.blinkT>=0){var bp=(t-eye.blinkT)/.16;if(bp>=1)eye.blinkT=-1;else open=Math.max(.08,Math.abs(1-bp*2));}
    if(t>=eye.nextLook){var rr=Math.random(),away=!(eye.tx===REST[0]&&eye.ty===REST[1]);
      if(away||rr<.55){eye.tx=REST[0];eye.ty=REST[1];eye.nextLook=t+2.5+Math.random()*3.5;}
      else{eye.tx=[-3,-2.6,1,-.5][Math.random()*4|0];eye.ty=[-1,1.2,1.4,-2][Math.random()*4|0];eye.nextLook=t+.9+Math.random()*1.2;}}
    var ee=1-Math.pow(.88,k);eye.lx+=(eye.tx-eye.lx)*ee;eye.ly+=(eye.ty-eye.ly)*ee;
    var ew=2.1+level*.25,eh=(5.4+level*.8)*open,ex=c+eye.lx,ey=c-1+eye.ly;if(speaking)eh*=1+.08*Math.sin(t*9);
    g.fillStyle="#14103a";g.globalAlpha=.92;
    [ex-4.4,ex+4.4].forEach(function(x){var r=ew,hh=Math.max(r,eh);g.beginPath();g.arc(x,ey-hh+r,r,Math.PI,0);g.lineTo(x+r,ey+hh-r);g.arc(x,ey+hh-r,r,0,Math.PI);g.closePath();g.fill();});
    g.globalAlpha=1;
  };

    /* ---------- Noctis (Muse): floats dormant in the middle, wakes rarely ---------- */
  function Muse(){this.wake=0;this.target=0;this.eyes=new Eyes();this.motes=[];for(var i=0;i<7;i++)this.motes.push({a:Math.random()*TAU,r:24+Math.random()*8,s:.3+Math.random()*.3,ph:Math.random()*6});}
  Muse.prototype.draw=function(g,t,k,c){
    /* Noctis: Muse's own art (sleeping and awake renders), crossfaded as he wakes */
    this.wake+=(this.target-this.wake)*(1-Math.pow(.95,k));var w=this.wake,L="#c3b8fe",P="#8f5ef8";
    var br=.5+.5*Math.sin(t*.7);
    var W=58,H=W*281/240,lift=w*2,gy=c+H*.18-lift;
    /* soft, calm glow: a slow breathing halo behind the orb, a touch warmer when awake */
    g.globalCompositeOperation="lighter";
    haze(g,c,gy,40,L,P,.05+br*.035+w*.1);
    var sg=g.createRadialGradient(c,gy,2,c,gy,22);sg.addColorStop(0,rgba("#e6dcff",.1+br*.05+w*.12));sg.addColorStop(1,rgba(L,0));
    g.fillStyle=sg;g.beginPath();g.arc(c,gy,22,0,TAU);g.fill();
    this.motes.forEach(function(m){var a=m.a+t*m.s*.7;g.globalAlpha=w*.7*(.5+.5*Math.sin(t*1.6+m.ph));g.fillStyle="#f3eeff";g.fillRect(c+Math.cos(a)*(m.r+4)-.6,gy+Math.sin(a)*(m.r+4)*.5-.6,1.2,1.2);});

    g.globalAlpha=1;g.globalCompositeOperation="source-over";
    if(!NOC.ready)return;
    var sy=1+(1-w)*.012*Math.sin(t*1.1),x=c-W/2,y=c-H/2-lift,sc=W/240;
    g.save();g.translate(c,y+H);g.scale(1,sy);g.translate(-c,-(y+H));
    /* the tail tip is its own layer: it sways from its base, lazy while asleep, livelier awake */
    var amp=3.5+w*4.5,sp=1+w*1.6,TW=40,TH=91,TX=4,TY=148,PV=77.7;
    function body(img,al){g.globalAlpha=al;g.drawImage(img,x,y,W,H);}
    function tail(img,al){g.globalAlpha=al;
      for(var r=0;r<TH;r+=2){var f=Math.max(0,Math.min(1,(PV-r)/PV)),d=amp*f*f*Math.sin(t*sp-f*1.8);
        g.drawImage(img,0,r,TW,Math.min(2,TH-r),x+(TX+d)*sc,y+(TY+r)*sc,TW*sc,Math.min(2,TH-r)*sc+.35);}}
    if(w<.999){tail(NOC.tipS,1);body(NOC.sleep,1);}
    if(w>.001){tail(NOC.tipA,w);body(NOC.awake,w);}
    /* inside the orb: slow swirl, a drifting glow and tiny rising bubbles, masked to the glass so the cat stays clean */
    if(NOC.mask.complete&&NOC.mask.naturalWidth){
      var o=OC.getContext("2d");o.setTransform(1,0,0,1,0,0);o.globalCompositeOperation="source-over";o.globalAlpha=1;o.clearRect(0,0,OC.width,OC.height);
      o.setTransform(OC.width/240,0,0,OC.height/281,0,0);o.globalCompositeOperation="lighter";
      var bx=118,by=205,sw=(1+w*.3+NCH*7);
      for(var si=0;si<3;si++){o.save();o.translate(bx,by);o.scale(1,.58);o.rotate(t*(.22+si*.09)*sw+si*2.1);
        o.strokeStyle=si===1?"rgba(218,120,245,"+(.16+w*.22)+")":"rgba(201,168,255,"+(.18+w*.24)+")";o.lineWidth=9-si*2;o.lineCap="round";
        o.shadowColor=si===1?"#da78f5":"#c9a8ff";o.shadowBlur=10;o.beginPath();o.arc(0,0,28+si*17,0,Math.PI*(1-si*.18));o.stroke();o.restore();}
      o.shadowBlur=0;
      var gx2=bx+Math.cos(t*.5)*26,gy2=by+Math.sin(t*.7)*16,rg=o.createRadialGradient(gx2,gy2,2,gx2,gy2,42);
      rg.addColorStop(0,"rgba(230,215,255,"+(.14+w*.18+NCH*.4)+")");rg.addColorStop(1,"rgba(143,94,248,0)");o.fillStyle=rg;o.fillRect(0,0,240,281);
      for(var bi2=0;bi2<NOC.bub.length;bi2++){var bb=NOC.bub[bi2],ph=(t*bb.v*(1+w*.2)+bb.o)%1,yy=by+62-ph*125,xx=bx+bb.x+Math.sin(t*1.3+bb.o*9)*3;
        o.globalAlpha=Math.sin(ph*Math.PI)*.8;o.strokeStyle="rgba(255,255,255,.55)";o.lineWidth=1.2;o.beginPath();o.arc(xx,yy,bb.r,0,TAU);o.stroke();}
      o.globalAlpha=1;o.globalCompositeOperation="destination-in";o.drawImage(NOC.mask,0,0,240,281);
      g.globalCompositeOperation="lighter";g.globalAlpha=.6+.4*w;g.drawImage(OC,x,y,W,H);g.globalCompositeOperation="source-over";
    }
    g.globalAlpha=1;g.restore();
    /* particles ride on top so they read against him, not hidden behind the orb */
    g.globalCompositeOperation="lighter";
    /* waking: a burst of violet sparkles, then a steady drift of them while he's up */
    this.parts=this.parts||[];
    if(this.target>.5&&!this.burst){this.burst=true;for(var bi=0;bi<38;bi++){var ba=Math.random()*TAU,bs=.4+Math.random()*.9;this.parts.push({x:c+Math.cos(ba)*16,y:gy+Math.sin(ba)*6,vx:Math.cos(ba)*bs,vy:Math.sin(ba)*bs*.7-.25,life:1,s:.8+Math.random()*1.2,hot:Math.random()<.4});}}
    if(this.target<.5)this.burst=false;
    if(this.sigh>0){if(this.sigh===1){for(var si3=0;si3<10;si3++){var sa3=-Math.PI/2+(Math.random()-.5)*1.6;this.parts.push({x:c+Math.cos(sa3)*12,y:gy-8+Math.sin(sa3)*6,vx:Math.cos(sa3)*.25,vy:-(.18+Math.random()*.2),life:1,s:1+Math.random()*.6,soft:true});}}this.sigh=Math.max(0,this.sigh-.02*k);}
    if(Math.random()<(.09+.75*w+NCH*1.4)*k){var pa=Math.random()*TAU,pr=17+Math.random()*12,soft=w<.5;
      this.parts.push({x:c+Math.cos(pa)*pr,y:gy+Math.sin(pa)*pr*.6,vx:(Math.random()-.5)*(soft?.08:.15),vy:-(soft?.08+Math.random()*.12:.15+Math.random()*.35),life:1,s:soft?1+Math.random()*.8:.7+Math.random()*1.1,hot:!soft&&Math.random()<.3,soft:soft});}
    for(var pi=this.parts.length-1;pi>=0;pi--){var pp=this.parts[pi],dm=Math.pow(.97,k);pp.x+=pp.vx*k;pp.y+=pp.vy*k;pp.vx*=dm;pp.vy=pp.vy*dm-.004*k;pp.life-=(pp.soft?.007:.011)*k;
      if(pp.life<=0){this.parts.splice(pi,1);continue;}
      g.globalAlpha=pp.life*(pp.soft?.65:1)*(.6+.4*Math.sin(t*(pp.soft?2.5:6)+pi));g.fillStyle=pp.hot?"#ffffff":(pi%3?"#c9a8ff":"#da78f5");g.fillRect(pp.x-pp.s/2,pp.y-pp.s/2,pp.s,pp.s);}
    g.globalAlpha=1;g.globalCompositeOperation="source-over";
  };
  var NCH=0,CCH=0;
  var NOC={awake:new Image(),sleep:new Image(),tipA:new Image(),tipS:new Image(),ready:false},nocN=0;
  NOC.mask=new Image();NOC.mask.src="assets/noctis/noctis-orb-mask.png";
  NOC.bub=[];for(var nb=0;nb<9;nb++)NOC.bub.push({x:(Math.random()-.5)*110,v:.06+Math.random()*.08,o:Math.random(),r:1.5+Math.random()*3.5});
  var OC=document.createElement("canvas");OC.width=160;OC.height=187;
  NOC.awake.onload=NOC.sleep.onload=NOC.tipA.onload=NOC.tipS.onload=function(){if(++nocN===4)NOC.ready=true;};
  NOC.awake.src="assets/noctis/noctis-body-awake.png";NOC.sleep.src="assets/noctis/noctis-body-sleeping.png";NOC.tipA.src="assets/noctis/noctis-tail-awake.png";NOC.tipS.src="assets/noctis/noctis-tail-sleeping.png";
    /* ---------- the crew on the home screen ---------- */
  var mainEl=document.getElementById("main"),crew=document.getElementById("crew");
  if(!crew||!mainEl)return;
  var BASE=150,REDUCE2=REDUCE;
  var core=new Core(),stone=new Char(),gSpeak=false;
  function q(sel){return crew.querySelector(sel);}
  var avG=q('[data-bot="g"] canvas'),avC=q('[data-bot="c"] canvas'),avM=q('[data-bot="m"] canvas');
  function setup(cv){var dpr=Math.min(2,window.devicePixelRatio||1);cv.width=BASE*dpr;cv.height=BASE*dpr;return {g:cv.getContext("2d"),dpr:dpr};}
  var GC=setup(avG),CC=setup(avC),MC=setup(avM),muse=new Muse(),museT=null;
  var nocName=document.getElementById("crewNocName"),duo=document.getElementById("crewDuo"),thr=document.getElementById("crewThread");
  var T0m=performance.now(),lastm=0;
  function nowT(){return (performance.now()-T0m)/1000;}
  function onHome(){return !mainEl.classList.contains("is-hidden")&&!document.body.classList.contains("tab-open")&&!document.hidden;}

  /* ---------- small storage helpers (per device) ---------- */
  var KEY="systemApp.crew";
  function load(){try{return JSON.parse(localStorage.getItem(KEY))||{};}catch(e){return {};}}
  function save(o){try{localStorage.setItem(KEY,JSON.stringify(o));}catch(e){}}
  var mem=load();
  function dayKey(d){d=d||new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
  if(mem.day!==dayKey())mem={day:dayKey(),hist:[],seenC:mem.seenC||"",seenM:mem.seenM||""};
  mem.hist=mem.hist||[];

  /* ---------- speech ---------- */
  var GLY="ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+<>/";
  function decode(node,text,onStart,onEnd){
    if(REDUCE2){node.textContent=text;onStart();setTimeout(onEnd,1600);return;}
    onStart();var t0=performance.now(),D=Math.min(1200,300+text.length*10);
    (function step(tt){var p=Math.min(1,(tt-t0)/D),n=Math.floor(text.length*p),s=text.slice(0,n);
      for(var i=n;i<Math.min(text.length,n+6);i++)s+=text[i]===" "?" ":GLY[Math.random()*GLY.length|0];
      node.textContent=s;stick();if(p<1)requestAnimationFrame(step);else{node.textContent=text;stick();setTimeout(onEnd,1400);}})(t0);
    /* safety: if the screen sleeps mid-line, nobody stays stuck "talking" */
    setTimeout(function(){node.textContent=text;onEnd();},D+4000);
  }
  /* the chat scrolls: it follows the newest line unless you've scrolled up to read */
  var follow=true;
  function stick(){if(follow)thr.scrollTop=thr.scrollHeight;}
  /* the chat keeps the last few lines, each older one a bit fainter; the top one fades out at the edge */
  function post(who,text,instant){
    while(thr.children.length>40)thr.removeChild(thr.firstChild);
    var b=document.createElement("div");b.className="crew-tb "+who;thr.appendChild(b);
    var kids=thr.children;for(var i=0;i<kids.length;i++){var age=kids.length-1-i;kids[i].classList.toggle("old",age>0);kids[i].style.opacity=age===0?1:.62;}
    if(instant)b.textContent=text;stick();return b;
  }
  var NAMES={g:"Grok",c:"Claude",m:"Noctis"};
  function stamp(d){d=d||new Date();var h=d.getHours()%12||12,m=d.getMinutes();return h+":"+(m<10?"0":"")+m;}
  function logLine(who,text,tag,when){
    var last=mem.hist[mem.hist.length-1];if(last&&last.who===who&&last.text===text)return;
    mem.hist.push({who:who,text:text,tag:tag||"",time:stamp(when)});if(mem.hist.length>80)mem.hist.shift();save(mem);if(txOpen)renderHist();
  }
  function say(who,text,tag,when){
    var tb=post(who,"");logLine(who,text,tag,when);
    if(who==="g"){if(Math.random()<.4)setTimeout(function(){fl.c.nod=1;},600+Math.random()*900);decode(tb,text,function(){gSpeak=true;},function(){gSpeak=false;});}
    else if(who==="c"){if(Math.random()<.45)core.boostUntil=nowT()+.6+Math.random()*.6;decode(tb,text,function(){st.speaking=true;},function(){st.speaking=false;});}
    else decode(tb,text,function(){},function(){});
  }

  /* ---------- data: gbot's feed from the Daily Briefing, my file, Noctis's file ---------- */
  var RAW="https://raw.githubusercontent.com/kkqT-24/system-app/main/claude/data/";
  function getJSON(u){return fetch(u,{cache:"no-store"}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();});}
  function repoJSON(n){return getJSON(RAW+n+"?t="+Date.now()).catch(function(){return getJSON("data/"+n);});}
  var cMsgs=[],mMsgs=[];
  function clean(d){return (d&&Array.isArray(d.messages)?d.messages:[]).filter(function(m){return m&&m.id&&m.text;}).slice(-20);}
  function isToday(m){var d=new Date(m.time||0);return !isNaN(d)&&dayKey(d)===dayKey();}
  function pull(){
    repoJSON("claude.json").then(function(d){cMsgs=clean(d);checkNew();}).catch(function(){});
    repoJSON("noctis.json").then(function(d){mMsgs=clean(d);checkNew();}).catch(function(){});
  }
  var gFeed=[],gi=0;
  function refreshFeed(){try{var f=window.__briefing&&window.__briefing.feed?window.__briefing.feed():[];if(f&&f.length)gFeed=f;}catch(e){}}
  function sayG(){refreshFeed();if(!gFeed.length)return;
    /* skip anything already showing in the chat (today's restored lines included) */
    var shown={};Array.prototype.forEach.call(thr.children,function(k){shown[k.textContent]=1;});
    for(var tries=0;tries<gFeed.length&&shown[gFeed[gi%gFeed.length].text];tries++)gi++;
    var it=gFeed[gi++%gFeed.length];say("g",it.text,it.kind==="say"?"":it.tag);}
  function latestC(){return cMsgs.length?cMsgs[cMsgs.length-1]:null;}
  function latestM(){return mMsgs.length?mMsgs[mMsgs.length-1]:null;}
  /* new posts take the floor when you're on home: mine as a message, Noctis's by waking him */
  function checkNew(){
    if(!onHome()||!mainEl.classList.contains("crew-done"))return;
    var c=latestC(),m=latestM();
    if(c&&c.id!==mem.seenC&&isToday(c)){mem.seenC=c.id;save(mem);say("c",c.text,"",new Date(c.time));return;}
    if(m&&m.id!==mem.seenM){mem.seenM=m.id;save(mem);wakeMuse(m.text,new Date(m.time));}
  }

  /* ---------- gbot: tap opens the Daily Briefing; the X by his name opens X ---------- */
  /* gbot: tap opens the Daily Briefing; hold and he charges up, throws sparks, then opens the Grok app */
  var gbtn=q('[data-bot="g"]'),gHold={on:false,t0:0,fired:false,tm:[]},GHOLD=1000,GCH=0;
  function openBriefing(){if(window.__briefing){window.__briefing.open();window.__briefing.load(false);}}
  function openGrokApp(){var b=null;try{b=window.__briefing&&window.__briefing.brief?window.__briefing.brief():null;}catch(e){}
    var u=(b&&b.gbot&&b.gbot.link)||"https://grok.com",w=null;try{w=window.open(u,"_blank");}catch(err){}if(!w){window.location.href=u;return;}try{w.opener=null;}catch(err){}}
  gbtn.addEventListener("pointerdown",function(e){gHold.on=true;gHold.fired=false;gHold.t0=performance.now();try{gbtn.setPointerCapture(e.pointerId);}catch(err){}
    gHold.tm.push(setTimeout(function(){if(!gHold.on)return;gHold.fired=true;gHold.on=false;try{if(navigator.vibrate)navigator.vibrate([10,30,10]);}catch(err){}
      core.boostUntil=nowT()+.7;fl.g.hop=1;setTimeout(openGrokApp,260);},GHOLD));});
  function gRelease(){if(!gHold.on)return;gHold.on=false;gHold.tm.forEach(clearTimeout);gHold.tm=[];if(!gHold.fired&&performance.now()-gHold.t0<300)openBriefing();}
  gbtn.addEventListener("pointerup",gRelease);gbtn.addEventListener("pointercancel",gRelease);gbtn.addEventListener("contextmenu",function(e){e.preventDefault();});
  gbtn.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();openBriefing();}});
  q(".crew-x").addEventListener("click",function(e){e.stopPropagation();var t=Date.now();window.location.href="twitter://timeline";
    setTimeout(function(){if(Date.now()-t<1500)window.location.href="https://x.com";},900);});

  /* ---------- me: tap repeats my latest; hold runs a system scan ---------- */
  var cbtn=q('[data-bot="c"]'),cHold={on:false,t0:0,fired:false,tm:[]},CHOLD=1300;
  function ago(iso){var d=new Date(iso);if(isNaN(d))return "unknown";return (dayKey(d)===dayKey()?"":"on "+(d.getMonth()+1)+"/"+d.getDate()+" at ")+stamp(d);}
  function scanLine(){
    var b=null;try{b=window.__briefing&&window.__briefing.brief?window.__briefing.brief():null;}catch(e){}
    var parts=[];
    parts.push(b&&b.written?"briefing "+ago(b.written):"briefing not loaded");
    var c=latestC();parts.push(c?"my last post "+ago(c.time):"no posts from me yet");
    var m=latestM();parts.push(m?"Noctis last spoke "+ago(m.time):"Noctis quiet");
    return "Scan done: "+parts.join(", ")+".";
  }
  cbtn.addEventListener("pointerdown",function(e){cHold.on=true;cHold.fired=false;cHold.t0=performance.now();try{cbtn.setPointerCapture(e.pointerId);}catch(err){}
    cHold.tm.push(setTimeout(function(){if(!cHold.on)return;cHold.fired=true;cHold.on=false;try{if(navigator.vibrate)navigator.vibrate([12,30,12]);}catch(err){}
      st.clearT=nowT();say("c",scanLine());},CHOLD));});
  function sayMine(){var c=latestC();say("c",c?c.text:"Nothing new from me. I'll post when there's something worth your time.");}
  /* a tap opens the Claude app (claude.ai is a universal link, so it lands in the app when it's installed) */
  function openClaude(){var u="https://claude.ai/new",w=null;try{w=window.open(u,"_blank");}catch(err){}if(!w){window.location.href=u;return;}try{w.opener=null;}catch(err){}}
  function cRelease(){if(!cHold.on)return;cHold.on=false;cHold.tm.forEach(clearTimeout);cHold.tm=[];if(!cHold.fired&&performance.now()-cHold.t0<300)openClaude();}
  cbtn.addEventListener("pointerup",cRelease);cbtn.addEventListener("pointercancel",cRelease);cbtn.addEventListener("contextmenu",function(e){e.preventDefault();});
  cbtn.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();openClaude();}});

  /* ---------- Noctis: tap wakes him; hold reboots the system ---------- */
  function wakeMuse(text,when){if(museT)clearTimeout(museT);muse.target=1;nocName.classList.add("on");
    if(text)setTimeout(function(){say("m",text,"",when);},700);
    museT=setTimeout(function(){muse.target=0;nocName.classList.remove("on");},text?9000:2600);}
  var nbtn=q('[data-bot="m"]'),HOLD=1500,hold={on:false,t0:0,fired:false,tm:[]};
  function napSoon(){if(museT)clearTimeout(museT);museT=setTimeout(function(){muse.target=0;nocName.classList.remove("on");},1200);}
  nbtn.addEventListener("pointerdown",function(e){
    hold.on=true;hold.fired=false;hold.t0=performance.now();try{nbtn.setPointerCapture(e.pointerId);}catch(err){}
    hold.tm.push(setTimeout(function(){if(!hold.on)return;if(museT)clearTimeout(museT);muse.target=1;nocName.classList.add("on");
      if(window.__mxSwirl)window.__mxSwirl.start(avM,HOLD-380);},380));
    hold.tm.push(setTimeout(function(){if(!hold.on)return;hold.fired=true;hold.on=false;try{if(navigator.vibrate)navigator.vibrate([20,40,60]);}catch(err){}
      if(window.__mxSwirl)window.__mxSwirl.stop(true);
      setTimeout(function(){muse.target=0;nocName.classList.remove("on");NCH=0;if(window.__ksReboot)window.__ksReboot();},180);},HOLD));
  });
  function release(){if(!hold.on)return;hold.on=false;hold.tm.forEach(clearTimeout);hold.tm=[];
    if(hold.fired)return;
    if(performance.now()-hold.t0<380){var m=latestM();wakeMuse(m&&isToday(m)?m.text:null,m?new Date(m.time):null);}
    else{if(window.__mxSwirl)window.__mxSwirl.stop(false);napSoon();}}
  nbtn.addEventListener("pointerup",release);nbtn.addEventListener("pointercancel",release);
  nbtn.addEventListener("contextmenu",function(e){e.preventDefault();});
  nbtn.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();wakeMuse(null);}});

  /* ---------- hold the conversation: it opens in place into today's whole thread ---------- */
  var txEl=document.getElementById("crewTx"),txList=document.getElementById("crewTxList"),txBar=document.getElementById("crewTxBar"),thrHold=null,txOpen=false,barT=null;
  function renderHist(){txList.textContent="";
    if(!mem.hist.length){var em=document.createElement("p");em.className="crew-tx-empty";em.textContent="Nothing said yet today.";txList.appendChild(em);}
    mem.hist.forEach(function(h){var r=document.createElement("div");r.className="crew-txrow "+h.who;
      var b2=document.createElement("div");b2.className="crew-tb "+h.who;b2.textContent=h.text;var tm=document.createElement("time");tm.textContent=NAMES[h.who]+(h.tag?" · "+h.tag:"")+" · "+h.time;
      if(h.who==="m"){r.appendChild(tm);r.appendChild(b2);}else{r.appendChild(b2);r.appendChild(tm);}txList.appendChild(r);});
    txList.scrollTop=txList.scrollHeight;}
  function geom(){var P=mainEl.getBoundingClientRect(),T=thr.getBoundingClientRect(),D=duo.getBoundingClientRect(),L=document.querySelector(".showcase-grid").getBoundingClientRect();
    return {P:P,T:T,top:Math.max(44,D.top-P.top-6),bottom:L.top-P.top+4};}
  function bar(on){var ch=txList.clientHeight,sh=txList.scrollHeight;if(sh<=ch+2){txBar.style.display="none";return;}txBar.style.display="block";
    var h=Math.max(24,ch*ch/sh),top=txList.offsetTop+(ch-h)*(txList.scrollTop/(sh-ch));txBar.style.height=h+"px";txBar.style.top=top+"px";
    if(on){txBar.classList.add("on");clearTimeout(barT);barT=setTimeout(function(){txBar.classList.remove("on");},900);}}
  txList.addEventListener("scroll",function(){bar(true);});
  function insets(G,R){return [G.T.top-R.top,R.right-G.T.right,R.bottom-G.T.bottom,G.T.left-R.left].map(function(v){return Math.max(0,v).toFixed(1)+"px";}).join(" ");}
  function openHist(){if(txOpen)return;txOpen=true;renderHist();var G=geom();txEl.style.top=G.top+"px";txEl.style.height=(G.bottom-G.top)+"px";txEl.classList.add("open");duo.classList.add("dimmed");
    txList.scrollTop=txList.scrollHeight;bar(false);var R=txEl.getBoundingClientRect();
    try{txEl.animate([{clipPath:"inset("+insets(G,R)+" round 14px)"},{clipPath:"inset(0px 0px 0px 0px round 18px)"}],{duration:760,easing:"cubic-bezier(.65,0,.35,1)"});
      txList.animate([{opacity:0,transform:"translateY(6px)"},{opacity:1,transform:"none"}],{duration:520,delay:260,easing:"ease-out",fill:"backwards"});}catch(e){}}
  function closeHist(){if(!txOpen)return;var G=geom(),R=txEl.getBoundingClientRect();duo.classList.remove("dimmed");
    var done=function(){txEl.classList.remove("open");txOpen=false;};
    try{txList.animate([{opacity:1},{opacity:0}],{duration:200,fill:"forwards"}).onfinish=function(){txList.getAnimations().forEach(function(a){a.cancel();});};
      var an=txEl.animate([{clipPath:"inset(0px 0px 0px 0px round 18px)"},{clipPath:"inset("+insets(G,R)+" round 14px)"}],{duration:480,easing:"cubic-bezier(.65,0,.35,1)"});an.onfinish=done;}catch(e){done();}}
  var tp=null;
  thr.addEventListener("scroll",function(){follow=thr.scrollTop+thr.clientHeight>=thr.scrollHeight-24;clearTimeout(thrHold);},{passive:true});
  thr.addEventListener("pointerdown",function(e){tp=[e.clientX,e.clientY];clearTimeout(thrHold);thrHold=setTimeout(function(){try{if(navigator.vibrate)navigator.vibrate(10);}catch(err){}openHist();},500);});
  thr.addEventListener("pointermove",function(e){if(tp&&Math.hypot(e.clientX-tp[0],e.clientY-tp[1])>8)clearTimeout(thrHold);},{passive:true});
  ["pointerup","pointerleave","pointercancel"].forEach(function(ev){thr.addEventListener(ev,function(){clearTimeout(thrHold);});});
  thr.addEventListener("contextmenu",function(e){e.preventDefault();});
  thr.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();openHist();}});
  txEl.addEventListener("click",closeHist);
  document.addEventListener("keydown",function(e){if(e.key==="Escape")closeHist();});

  /* ---------- startup: date and greeting show, then the date slides into the top bar ---------- */
  var introT=null;
  function setDates(){var d=new Date(),M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];var sm=document.getElementById("crewDate");if(sm)sm.textContent=M[d.getMonth()]+" "+d.getDate();}
  function startup(){mainEl.classList.remove("crew-done");clearTimeout(introT);setDates();introT=setTimeout(function(){mainEl.classList.add("crew-done");setOled();
      /* so it never opens empty: today's last few lines come back instantly, then gbot opens with a quick run
         of briefing items (faster at first), then anything new from me or Noctis gets the floor */
      if(!thr.children.length)mem.hist.slice(-12).forEach(function(h){post(h.who,h.text,true);});
      refreshFeed();var opening=Math.min(3,gFeed.length);gi=0;
      for(var oi=0;oi<opening;oi++)(function(n){setTimeout(function(){if(onHome()&&!txOpen)sayG();},700+n*3600);})(oi);
      setTimeout(checkNew,700+opening*3600);nextG=Date.now()+700+opening*3600+9000;},1100);}
  /* runs once each time home arrives (first entry, and again after a reboot); class changes of our own don't retrigger it */
  var arrived=false;
  function arriveState(){return mainEl.classList.contains("arrive")&&!mainEl.classList.contains("is-hidden");}
  new MutationObserver(function(){var a=arriveState();if(a&&!arrived)startup();arrived=a;}).observe(mainEl,{attributes:true,attributeFilter:["class"]});
  if(arriveState()){arrived=true;startup();}
  window.addEventListener("pageshow",setDates);

  /* the black stops just above the modules; the stars and OLED top follow it */
  function setOled(){var lab=document.querySelector(".showcase-grid");if(!lab)return;var P=mainEl.getBoundingClientRect(),L=lab.getBoundingClientRect();
    mainEl.style.setProperty("--oled",Math.max(0,L.top-P.top-56)+"px");document.documentElement.style.setProperty("--oled-vp",Math.max(0,L.top-56)+"px");}
  window.addEventListener("resize",setOled);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(setOled);

  /* gbot takes the floor every so often with the next briefing item; new posts are checked every few minutes */
  var nextG=0;
  setInterval(function(){if(Date.now()<nextG)return;if(onHome()&&mainEl.classList.contains("crew-done")&&!txOpen&&!st.speaking&&muse.wake<.5){sayG();nextG=Date.now()+14000;}},1000);
  pull();setInterval(function(){if(!document.hidden)pull();},300000);
  document.addEventListener("visibilitychange",function(){if(!document.hidden){pull();setDates();}});

  /* ---------- movement: roaming, leaning in, and the odd moment between them ---------- */
  var fl={g:{lean:0,vx:0,vy:0,hop:0},c:{lean:0,vx:0,vy:0,nod:0}};
  function wander(t,ax,ay,f,p){return [ax*(Math.sin(t*f*1.0+p)*.6+Math.sin(t*f*1.73+p*2.1)*.4),ay*(Math.sin(t*f*1.31+p*.7)*.6+Math.sin(t*f*.57+p*1.9)*.4)];}
  var whoG=q(".crew-bot.g .crew-who"),whoC=q(".crew-bot.c .crew-who"),wrapM=q(".crew-noc");
  var act=null,nextAct=16,goG=false,goC=false,nocWas=false;
  var ACTS=["visitC","poke","checkN","glance","sigh"];
  function pickAct(t){var a=ACTS[Math.random()*ACTS.length|0];act={type:a,t0:t,until:t+(a==="glance"?1.8:a==="sigh"?2:4.8),fired:false};nextAct=t+18+Math.random()*22;}
  function float(t,k){
    if(gHold.on){GCH=Math.max(0,Math.min(1,(performance.now()-gHold.t0-80)/(GHOLD-80)));}else GCH*=Math.pow(.9,k);
    if(cHold.on){CCH=Math.max(0,Math.min(1,(performance.now()-cHold.t0-80)/(CHOLD-80)));}else CCH*=Math.pow(.9,k);
    if(hold.on){var hc=performance.now()-hold.t0;NCH=Math.max(0,Math.min(1,(hc-380)/(HOLD-380)));}else NCH*=Math.pow(.9,k);
    var e=1-Math.pow(.9,k),slow=1-Math.pow(.97,k);
    var wg=wander(t,18,30,.3,0),wc=wander(t,14,24,.19,2.4);
    fl.g.lean+=((gSpeak?1:0)-fl.g.lean)*e;fl.c.lean+=((st.speaking?1:0)-fl.c.lean)*e;
    var nocUp=muse.wake>.5,busy=gSpeak||st.speaking||nocUp||txOpen;
    if(nocUp&&!nocWas){goG=Math.random()<.65;goC=Math.random()<.55;if(Math.random()<.25)fl.g.hop=.7;}nocWas=nocUp;
    if(!act&&!busy&&t>nextAct)pickAct(t);
    if(act&&t>act.until)act=null;
    var A=act?act.type:null,tgx=0,tgy=0,tcx=0,tcy=0,lookGC=false;
    if(nocUp){if(goG){tgx=34;tgy=-18;}if(goC){tcx=-34;tcy=-18;}}
    else if(A==="visitC"){tgx=44;tgy=-6;tcx=-6;lookGC=true;if(!act.fired&&t-act.t0>1.8){act.fired=true;if(Math.random()<.5)stone.forceFis=true;else core.boostUntil=t+.5;}}
    else if(A==="poke"){tgx=30;tgy=-26;core.eye.tx=3;core.eye.ty=-1.6;core.eye.nextLook=t+1;
      if(!act.fired&&t-act.t0>1.9){act.fired=true;core.boostUntil=t+.5;if(Math.random()<.55){muse.target=.3;setTimeout(function(){if(muse.target<.5)muse.target=0;},1600);}}}
    else if(A==="checkN"){tcx=-30;tcy=-22;stone.eyes.tx=-2.4;stone.eyes.ty=-1.2;stone.eyes.nl=t+1;}
    else if(A==="glance"){lookGC=true;}
    else if(A==="sigh"&&!act.fired){act.fired=true;muse.sigh=1;}
    fl.g.vx+=(tgx-fl.g.vx)*slow;fl.g.vy+=(tgy-fl.g.vy)*slow;fl.c.vx+=(tcx-fl.c.vx)*slow;fl.c.vy+=(tcy-fl.c.vy)*slow;
    fl.g.hop*=Math.pow(.93,k);fl.c.nod*=Math.pow(.94,k);
    var gx=wg[0]+fl.g.lean*6+fl.g.vx,gy=wg[1]-fl.g.lean*5+fl.g.vy-Math.sin((1-fl.g.hop)*Math.PI)*fl.g.hop*14;
    var cx=wc[0]-fl.c.lean*6+fl.c.vx,cy2=wc[1]-fl.c.lean*4+fl.c.vy+Math.sin((1-fl.c.nod)*Math.PI*2)*fl.c.nod*4;
    whoG.style.transform="translate("+gx.toFixed(1)+"px,"+gy.toFixed(1)+"px)";
    whoC.style.transform="translate("+cx.toFixed(1)+"px,"+cy2.toFixed(1)+"px)";
    if(gSpeak){stone.eyes.tx=-2.4;stone.eyes.ty=0;stone.eyes.nl=t+1.2;}
    if(st.speaking){core.eye.tx=3;core.eye.ty=-.6;core.eye.nextLook=t+1.2;}
    if(lookGC&&!gSpeak&&!st.speaking){core.eye.tx=3;core.eye.ty=0;core.eye.nextLook=t+1;stone.eyes.tx=-2.4;stone.eyes.ty=0;stone.eyes.nl=t+1;}
    if(nocUp){if(goG){core.eye.tx=3;core.eye.ty=-1.6;core.eye.nextLook=t+1.2;}if(goC){stone.eyes.tx=-2.4;stone.eyes.ty=-1;stone.eyes.nl=t+1.2;}}
    var wm=wander(t,14,10,.17,4.1);wrapM.style.transform="translate("+wm[0].toFixed(1)+"px,"+(wm[1]-muse.wake*5).toFixed(1)+"px)";
    stars(t,k);
  }
  /* starfield in the black: a few dim drifting points and the odd shooting star */
  var SC=document.getElementById("crewStars"),SX=SC.getContext("2d"),STARS=[],shoot=null,nextShoot=5+Math.random()*6,sw0=0,sh0=0;
  for(var si2=0;si2<54;si2++)STARS.push({x:Math.random(),y:Math.random(),r:Math.random()<.12?1.3:.5+Math.random()*.6,ph:Math.random()*6,sp:.4+Math.random()*1.4,vx:(Math.random()*.6+.2)*.0016,c:Math.random()<.25?"#c3b8fe":"#ffffff"});
  function stars(t,k){
    var d=Math.min(2,window.devicePixelRatio||1),w=SC.clientWidth,h=SC.clientHeight;if(!w||!h)return;
    if(w!==sw0||h!==sh0){SC.width=w*d;SC.height=h*d;sw0=w;sh0=h;}
    SX.setTransform(d,0,0,d,0,0);SX.clearRect(0,0,w,h);
    STARS.forEach(function(s2){s2.x+=s2.vx*k*.06;if(s2.x>1.02)s2.x=-.02;
      var fy=Math.min(1,Math.max(0,(1-s2.y)/.28));SX.globalAlpha=(.18+.42*(.5+.5*Math.sin(t*s2.sp+s2.ph)))*(s2.r>1?1.2:1)*fy;SX.fillStyle=s2.c;SX.beginPath();SX.arc(s2.x*w,s2.y*h,s2.r,0,TAU);SX.fill();});
    if(!shoot&&t>nextShoot){var dir=Math.random()<.5?1:-1,ang=(.18+Math.random()*.35),spd=3+Math.random()*3;
      shoot={x:dir>0?Math.random()*w*.5:w*.5+Math.random()*w*.5,y:Math.random()*h*.4,vx:Math.cos(ang)*spd*dir,vy:Math.sin(ang)*spd,len:22+Math.random()*30,life:1,fade:.018+Math.random()*.012};
      nextShoot=t+12+Math.random()*22;}
    if(shoot){shoot.x+=shoot.vx*k;shoot.y+=shoot.vy*k;shoot.life-=shoot.fade*k;
      if(shoot.life<=0)shoot=null;else{var m=Math.hypot(shoot.vx,shoot.vy),tx=shoot.x-shoot.vx/m*shoot.len,ty=shoot.y-shoot.vy/m*shoot.len,lg=SX.createLinearGradient(tx,ty,shoot.x,shoot.y);
        lg.addColorStop(0,"rgba(255,255,255,0)");lg.addColorStop(1,"rgba(255,255,255,"+(.65*shoot.life)+")");
        SX.globalAlpha=1;SX.strokeStyle=lg;SX.lineWidth=1.1;SX.beginPath();SX.moveTo(tx,ty);SX.lineTo(shoot.x,shoot.y);SX.stroke();}}
    SX.globalAlpha=1;
  }
  function draw(t,k){
    if(!REDUCE2)float(t,k);
    GC.g.setTransform(GC.dpr,0,0,GC.dpr,0,0);GC.g.clearRect(0,0,BASE,BASE);GC.g.globalAlpha=1;core.draw(GC.g,t,k,BASE/2,gSpeak);GC.g.globalCompositeOperation="source-over";
    MC.g.setTransform(MC.dpr,0,0,MC.dpr,0,0);MC.g.clearRect(0,0,BASE,BASE);MC.g.globalAlpha=1;muse.draw(MC.g,t,k,BASE/2);MC.g.globalCompositeOperation="source-over";MC.g.globalAlpha=1;
    CC.g.setTransform(CC.dpr,0,0,CC.dpr,0,0);CC.g.clearRect(0,0,BASE,BASE);CC.g.globalAlpha=1;CC.g.shadowBlur=0;stone.draw(CC.g,t,k,BASE/2);CC.g.globalCompositeOperation="source-over";CC.g.globalAlpha=1;
  }
  /* only draws while home is on screen; a section panel, a hidden tab or the boot screen pauses it */
  function frameM(ts){if(ts-lastm<30){requestAnimationFrame(frameM);return;}var k=lastm?Math.min(4,(ts-lastm)/16.667):1;lastm=ts;
    if(onHome())draw((ts-T0m)/1000,k);requestAnimationFrame(frameM);}
  if(REDUCE2){var tryDraw=function(){if(NOC.ready)draw(2,1);else setTimeout(tryDraw,300);};tryDraw();}else requestAnimationFrame(frameM);

  /* hooks for later: a finished protocol, or a line posted from elsewhere in the app */
  window.__crew={
    clear:function(text){st.clearT=nowT();say("c",text||"Protocol clear. Good start.");core.boostUntil=nowT()+1.2;fl.g.hop=1;
      if(muse.target<.5&&Math.random()<.6){muse.target=.35;setTimeout(function(){if(muse.target<.5)muse.target=0;},2200);}},
    say:function(who,text){if(NAMES[who]&&text)say(who,String(text));},
    refresh:pull
  };
})();
