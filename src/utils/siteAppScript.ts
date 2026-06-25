// Static CSS + runtime JS for the single-file site export. Kept as plain string
// constants (no interpolation) so the embedded JS never needs escaping. The
// builder (siteHtmlBuilder.ts) injects `DATA` and `KATEX_DELIMS` before SITE_JS.
//
// The graph reuses the same engine the app uses (vasturiano's `force-graph`,
// which `react-force-graph-2d` wraps), loaded from CDN, configured to match the
// in-app GraphView (node size by degree, teal wikilink links, labels under nodes).

export const SITE_CSS = `
:root{--bg:#fafafa;--surface:#ffffff;--surface2:#f0f0f2;--text:#111;--text2:#555;--text3:#999;--accent:#5c4fd9;--border:rgba(0,0,0,.1);--code-bg:#f3f3f5}
@media(prefers-color-scheme:dark){:root{--bg:#0f0f11;--surface:#16161a;--surface2:#1d1d22;--text:#e6e6ea;--text2:#a0a0a8;--text3:#6a6a72;--accent:#8b7cf6;--border:rgba(255,255,255,.1);--code-bg:#161618}}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;background:var(--bg);color:var(--text);line-height:1.7;display:grid;grid-template-columns:264px 1fr;grid-template-rows:48px 1fr;grid-template-areas:"top top" "side main";height:100vh;overflow:hidden}
.topbar{grid-area:top;display:flex;align-items:center;gap:.6rem;padding:0 1rem;border-bottom:1px solid var(--border);background:var(--surface);z-index:50}
.brand{font-weight:700;font-size:.95rem}
.brand small{font-weight:400;color:var(--text3);margin-left:.4rem}
.icon-btn{display:none;align-items:center;justify-content:center;width:34px;height:34px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text2);cursor:pointer;font-size:1rem}
.icon-btn:hover{color:var(--accent);border-color:var(--accent)}
#sidebar{grid-area:side;border-right:1px solid var(--border);background:var(--surface);display:flex;flex-direction:column;overflow:hidden;z-index:40}
.search-wrap{padding:.6rem .6rem .4rem}
#search{width:100%;border:1px solid var(--border);background:var(--bg);color:var(--text);border-radius:8px;padding:.45rem .6rem;font-size:.85rem;outline:none}
#search:focus{border-color:var(--accent)}
#nav-list{flex:1;overflow-y:auto;padding:.3rem}
.nav-item{display:block;padding:.4rem .6rem;border-radius:6px;color:var(--text2);text-decoration:none;font-size:.86rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nav-item:hover{background:var(--surface2);color:var(--text)}
.nav-item.active{background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent);font-weight:500}
.nav-empty{padding:.6rem;color:var(--text3);font-size:.8rem}
#main{grid-area:main;display:flex;flex-direction:column;overflow:hidden}
.tabbar{display:flex;gap:.2rem;padding:.35rem .6rem 0;border-bottom:1px solid var(--border);background:var(--surface)}
.tab{appearance:none;border:none;background:none;padding:.5rem .9rem;font-size:.85rem;font-weight:500;color:var(--text3);cursor:pointer;border-bottom:2px solid transparent;display:inline-flex;align-items:center;gap:.4rem}
.tab:hover{color:var(--text)}
.tab.active{color:var(--accent);border-bottom-color:var(--accent)}
#pane-content{flex:1;overflow-y:auto}
#pane-graph{flex:1;position:relative;overflow:hidden;background:var(--bg)}
#pane-graph canvas{display:block}
#content{max-width:760px;margin:0 auto;padding:2.4rem 2rem 5rem}
.empty{color:var(--text3);text-align:center;padding-top:4rem}
#content h1{font-size:2rem;font-weight:700;line-height:1.2;margin-bottom:.5rem}
#content h2{font-size:1.4rem;font-weight:600;margin:2rem 0 .6rem;padding-bottom:.3rem;border-bottom:1px solid var(--border)}
#content h3{font-size:1.15rem;font-weight:600;margin:1.6rem 0 .4rem}
#content h4,#content h5,#content h6{font-size:1rem;font-weight:600;margin:1.4rem 0 .3rem}
#content p{margin-bottom:1rem}
#content a{color:var(--accent);text-decoration:none}#content a:hover{text-decoration:underline}
#content strong{font-weight:600}#content em{font-style:italic}#content s{opacity:.6}
#content code{background:var(--code-bg);border-radius:4px;padding:.1em .4em;font-size:.875em;font-family:'Fira Code','JetBrains Mono',monospace;color:var(--accent)}
#content pre{background:var(--code-bg);border-radius:8px;padding:1rem 1.25rem;overflow-x:auto;margin-bottom:1.25rem;border:1px solid var(--border)}
#content pre code{background:none;padding:0;color:var(--text);font-size:.85rem}
#content blockquote{border-left:3px solid var(--accent);padding:.4rem 0 .4rem 1rem;margin:1rem 0;color:var(--text2)}
#content ul,#content ol{margin-bottom:1rem;padding-left:1.75rem}#content li{margin-bottom:.3rem}
#content hr{border:none;border-top:1px solid var(--border);margin:2rem 0}
#content table{width:100%;border-collapse:collapse;margin-bottom:1.25rem;font-size:.9rem}
#content th{padding:.55rem .75rem;text-align:left;font-weight:600;border-bottom:2px solid var(--border);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text2)}
#content td{padding:.55rem .75rem;border-bottom:1px solid var(--border)}
#content img{max-width:100%;border-radius:6px;margin:1rem 0;display:block}
.task-item{display:flex;align-items:baseline;gap:.5rem;margin-bottom:.35rem}
.wikilink{color:var(--accent);font-weight:500;border-bottom:1px dotted color-mix(in srgb,var(--accent) 50%,transparent);cursor:pointer}
span.wikilink{opacity:.6;cursor:default;border-bottom-style:dashed}
.callout{border-radius:8px;padding:.9rem 1rem;margin:1rem 0;border-left:4px solid}
.callout p:last-child{margin-bottom:0}
.callout-note{background:rgba(96,165,250,.07);border-color:#60a5fa}.callout-tip{background:rgba(52,211,153,.07);border-color:#34d399}
.callout-warning{background:rgba(251,191,36,.07);border-color:#fbbf24}.callout-danger{background:rgba(248,113,113,.07);border-color:#f87171}
.callout-important{background:rgba(167,139,250,.07);border-color:#a78bfa}.callout-example,.callout-quote{background:rgba(156,163,175,.07);border-color:#9ca3af}
.callout-title{font-weight:600;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.4rem;opacity:.85}
.math-block{overflow-x:auto;margin:1.25rem 0;text-align:center}
.meta{margin-bottom:1.4rem;display:flex;gap:.4rem;flex-wrap:wrap}
.tag{background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent);padding:.1em .6em;border-radius:999px;font-size:.75rem}
@media(max-width:768px){
  body{grid-template-columns:1fr;grid-template-areas:"top" "main"}
  #sidebar{position:fixed;inset:48px auto 0 0;width:264px;transform:translateX(-100%);transition:transform .2s ease;box-shadow:0 0 40px rgba(0,0,0,.25)}
  body.nav-open #sidebar{transform:none}
  .icon-btn.menu{display:inline-flex}
}
`

// Embedded runtime. No backticks and no '${' anywhere inside.
export const SITE_JS = `
(function(){
  var notes = DATA.notes, byId = {};
  notes.forEach(function(n){ byId[n.id]=n; });
  var elList = document.getElementById('nav-list');
  var elContent = document.getElementById('content');
  var elSearch = document.getElementById('search');
  var paneContent = document.getElementById('pane-content');
  var paneGraph = document.getElementById('pane-graph');
  var tabs = [].slice.call(document.querySelectorAll('.tab'));
  var graph = null;

  function esc(s){ return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function curId(){ return decodeURIComponent(location.hash.slice(1)); }

  function renderList(){
    var f=(elSearch.value||'').toLowerCase(), cur=curId(), shown=0;
    elList.innerHTML='';
    notes.forEach(function(n){
      if(f && (n.title||'').toLowerCase().indexOf(f)<0) return;
      shown++;
      var a=document.createElement('a');
      a.href='#'+encodeURIComponent(n.id);
      a.className='nav-item'+(n.id===cur?' active':'');
      a.textContent=n.title||'Untitled';
      elList.appendChild(a);
    });
    if(!shown){ var d=document.createElement('div'); d.className='nav-empty'; d.textContent='No matches'; elList.appendChild(d); }
  }

  function renderNote(){
    var id=curId()||(notes[0]&&notes[0].id), n=byId[id];
    if(!n){ elContent.innerHTML='<div class="empty">No notes to show.</div>'; return; }
    var tags = n.tags.length ? '<div class="meta">'+n.tags.map(function(t){return '<span class="tag">#'+esc(t)+'</span>';}).join('')+'</div>' : '';
    elContent.innerHTML='<article><h1>'+esc(n.title||'Untitled')+'</h1>'+tags+n.html+'</article>';
    paneContent.scrollTop=0;
    if(window.renderMathInElement){ try{ renderMathInElement(elContent,{delimiters:KATEX_DELIMS,throwOnError:false}); }catch(e){} }
    renderList();
    document.body.classList.remove('nav-open');
  }

  function setTab(name){
    tabs.forEach(function(t){ t.classList.toggle('active', t.getAttribute('data-tab')===name); });
    paneContent.style.display = name==='content' ? '' : 'none';
    paneGraph.style.display = name==='graph' ? '' : 'none';
    if(name==='graph') initGraph();
  }

  function nodeColor(n){ return n.id===curId() ? '#ffffff' : n.color; }

  function initGraph(){
    if(graph){ graph.width(paneGraph.clientWidth).height(paneGraph.clientHeight); return; }
    if(typeof ForceGraph==='undefined'){ paneGraph.innerHTML='<div class="empty">Graph library failed to load (offline?).</div>'; return; }
    var gnodes=notes.map(function(n){ return {id:n.id,label:n.title||'Untitled',color:n.color,val:n.val}; });
    var glinks=[];
    notes.forEach(function(n){ (n.links||[]).forEach(function(t){ if(byId[t]&&t!==n.id) glinks.push({source:n.id,target:t}); }); });
    var cs=getComputedStyle(document.body);
    var bg=(cs.getPropertyValue('--bg')||'#ffffff').trim();
    var txt=(cs.getPropertyValue('--text2')||'#888').trim();
    graph=ForceGraph()(paneGraph)
      .graphData({nodes:gnodes,links:glinks})
      .backgroundColor(bg)
      .width(paneGraph.clientWidth).height(paneGraph.clientHeight)
      .nodeRelSize(5)
      .nodeVal('val')
      .nodeColor(nodeColor)
      .nodeLabel(function(n){ return n.label; })
      .nodeCanvasObjectMode(function(){ return 'after'; })
      .nodeCanvasObject(function(node,ctx,scale){
        if(scale<0.55 && node.id!==curId()) return;
        var label=node.label.length>22?node.label.slice(0,20)+'…':node.label;
        var fs=Math.max(6,8/scale), r=5*Math.sqrt(node.val||1);
        ctx.font=(node.id===curId()?'600 ':'400 ')+fs+'px sans-serif';
        ctx.fillStyle=node.id===curId()?'#ffffff':txt;
        ctx.textAlign='center'; ctx.textBaseline='top';
        ctx.fillText(label,node.x,node.y+r+2/scale);
      })
      .linkColor(function(){ return 'rgba(45,212,191,0.4)'; })
      .linkWidth(1.2)
      .linkDirectionalArrowLength(5)
      .linkDirectionalArrowRelPos(1)
      .onNodeClick(function(node){ location.hash='#'+encodeURIComponent(node.id); setTab('content'); });
  }

  window.addEventListener('hashchange', function(){ renderNote(); if(graph) graph.nodeColor(nodeColor); });
  elSearch.addEventListener('input', renderList);
  tabs.forEach(function(t){ t.addEventListener('click', function(){ setTab(t.getAttribute('data-tab')); }); });
  document.getElementById('btn-menu').addEventListener('click', function(){ document.body.classList.toggle('nav-open'); });
  window.addEventListener('resize', function(){ if(graph && paneGraph.style.display!=='none') graph.width(paneGraph.clientWidth).height(paneGraph.clientHeight); });

  renderNote();
  setTab('content');
})();
`
