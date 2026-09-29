import {API_BASE} from './config.js';
import {createDemo} from './demo.js';
import {fullName,arabicNumber as num,matches,validatePerson,csvCell,getAncestors,validateImport} from './core.mjs';

const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons = {
 home:'M3 10 12 3l9 7M5 9v12h14V9M9 21v-7h6v7',
 people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 tree:'M9 3h6v5H9zM2 16h6v5H2zM16 16h6v5h-6zM12 8v4M5 16v-4h14v4',
 branch:'M6 3v12a5 5 0 0 0 5 5h7M6 9h7a5 5 0 0 0 5-5M3 3h6M15 20h6M15 4h6',
 chart:'M4 20h17M7 16V9M12 16V4M17 16v-5',
 shield:'M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7l-9-4M8 12l3 3 5-6',
 plus:'M12 5v14M5 12h14', search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
 arrow:'M14 6l-6 6 6 6M8 12h13',download:'M12 3v12M7 10l5 5 5-5M4 16v5h16v-5',
 grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
 list:'M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1',
 edit:'m16 3 5 5-12 12H4v-5zM13 6l5 5',close:'M6 6l12 12M18 6 6 18',
 leaf:'M20 3C7 2 1 9 6 17s16 3 14-14M5 21 16 10',clock:'M12 7v5l3 3M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
 menu:'M4 6h16M4 12h16M4 18h16',logout:'M9 4H4v16h5M13 8l4 4-4 4M8 12h13',
 archive:'M3 3h18v5H3zM5 8v13h14V8M9 12h6',check:'M5 12l4 4L20 5',print:'M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6z'
};
const icon = name => '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="'+(icons[name]||icons.people)+'"/></svg>';
const btn = (label,action,style='',extra='') => '<button class="btn '+style+'" data-action="'+action+'" '+extra+'>'+label+'</button>';
const maritalLabels = {single:'أعزب / عزباء',married:'متزوج / متزوجة',divorced:'مطلق / مطلقة',widowed:'أرمل / أرملة',unknown:'غير محدد'};
const navItems = [['dashboard','home','نظرة عامة'],['directory','people','أفراد العائلة'],['tree','tree','شجرة العائلة'],['branches','branch','الفخوذ والفروع'],['reports','chart','الإحصاءات'],['admin','shield','إدارة السجل']];
const state = {demo:!API_BASE, data:createDemo(),user:{name:'زائر المعاينة',role:'admin'},token:'',view:'dashboard',q:'',branch:'',life:'',display:'table',page:1,zoom:1,collapsed:new Set(),selected:'',busy:false};
const regions={quds:'القدس',jordan:'الأردن'};
state.region='quds';state.datasets={quds:state.data,jordan:createDemo()};state.local=false;
let toastTimer;
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500)}
const active = () => state.data.people.filter(p=>!p.archived);
const canEdit = () => !state.local && ['admin','editor'].includes(state.user?.role);
const canAdmin = () => !state.local && state.user?.role === 'admin';
function filtered(){return active().filter(p=>(!state.branch||p.branch===state.branch)&&(!state.life||p.life===state.life)&&matches(p,state.q))}
function options(items,value,empty){return (empty!=null?'<option value="">'+esc(empty)+'</option>':'')+items.map(item=>{const [v,label]=Array.isArray(item)?item:[item,item];return '<option value="'+esc(v)+'" '+(v===value?'selected':'')+'>'+esc(label)+'</option>'}).join('')}
function dateLabel(value){return new Date(value).toLocaleDateString('ar-JO',{day:'numeric',month:'short',year:'numeric'})}
async function api(path,body,method){
 const response=await fetch(API_BASE.replace(/\/$/,'')+'/api/'+path+'?region='+encodeURIComponent(state.region),{method:method||(body?'POST':'GET'),headers:{...(body?{'Content-Type':'application/json'}:{}),...(state.token?{Authorization:'Bearer '+state.token}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',referrerPolicy:'no-referrer'});
 let data;try{data=await response.json()}catch{throw Error('تعذر قراءة استجابة الخادم.')}
 if(!response.ok){if(response.status===401&&path!=='login'){state.token='';state.data={people:[],branches:[],audit:[],users:[]};closeDialog();loginScreen()}throw Error(data.error||'تعذر إتمام العملية.')}
 return data;
}
async function load(){const data=await api('data');state.data=data;state.user=data.user;state.datasets[state.region]=data}
function summary(){const ps=active();return [[ps.length,'أفراد العائلة','people','سجل واحد يجمع الأجيال'],[state.data.branches.length,'الفخوذ والفروع','branch','روابط تجمعنا'],[ps.filter(p=>p.life==='alive').length,'الأحياء','leaf','بارك الله في أعمارهم'],[ps.filter(p=>p.life==='deceased').length,'في الذاكرة','clock','رحمهم الله وغفر لهم']]}
function stats(){return '<section class="stats" aria-label="إحصاءات العائلة">'+summary().map((s,i)=>'<article class="stat '+(!i?'featured':'')+'"><div class="stat-top">'+s[1]+'<span class="stat-icon">'+icon(s[2])+'</span></div><strong>'+num(s[0])+'</strong><small>'+s[3]+'</small></article>').join('')+'</section>'}
function title(){return navItems.find(n=>n[0]===state.view)?.[2]||'سجل العائلة'}
function shell(){
 const count=active().length;
 $('#app').innerHTML='<div class="layout"><aside class="sidebar" id="sidebar"><button class="mobile-close" data-action="menu" aria-label="إغلاق القائمة">×</button><div class="brand"><div class="brand-mark">'+icon('tree')+'</div><div><strong>عائلة النتشه</strong><small>جذورٌ تجمعنا</small></div></div><label class="nav-label" for="region-select">اختر العائلة</label><select id="region-select" class="region-select" aria-label="اختر العائلة">'+options(Object.entries(regions).filter(([r])=>state.demo||state.user?.regions?.includes(r)),state.region)+' </select><p class="nav-label">سجل العائلة · '+regions[state.region]+'</p><nav class="side-nav" aria-label="القائمة الرئيسية">'+navItems.filter(n=>n[0]!=='admin'||canAdmin()).map(n=>'<button data-view="'+n[0]+'" class="'+(state.view===n[0]?'active':'')+'" '+(state.view===n[0]?'aria-current="page"':'')+'>'+icon(n[1])+n[2]+(n[0]==='directory'?'<span class="nav-count">'+num(count)+'</span>':'')+'</button>').join('')+'</nav><div class="sidebar-bottom"><div class="family-note"><strong>من جيل إلى جيل</strong>نحفظ أسماءنا، ونوثّق صلتنا، لتبقى حكاية العائلة حاضرة.</div><a href="index.html">'+icon('arrow')+'العودة إلى صدقة جارية</a></div></aside><div class="workspace"><header class="topbar"><button class="icon-btn mobile-menu" data-action="menu" aria-label="فتح القائمة">'+icon('menu')+'</button><div class="breadcrumb"><span class="desktop">عائلة النتشه</span><span class="desktop">/</span><strong>'+regions[state.region]+' · '+title()+'</strong></div><div class="account"><div class="avatar">'+(state.demo?'ن':esc(state.user.name[0]))+'</div><div class="account-text"><p>'+esc(state.local?'عارض النسخة الخاصة':state.user.name)+'</p><small>'+(state.local?'ملف خاص · قراءة فقط':state.demo?'نسخة للمعاينة':{admin:'مدير السجل',editor:'مشرف',viewer:'للقراءة فقط'}[state.user.role])+'</small></div>'+(!state.demo?'<button class="icon-btn" data-action="logout" aria-label="تسجيل الخروج">'+icon('logout')+'</button>':'')+'</div></header><main id="main" class="content">'+(state.local?'<div class="demo-strip"><span><strong>سجل '+regions[state.region]+'</strong> · بيانات منقولة من الموقع الأصلي. تُقرأ في هذه الصفحة فقط؛ لا تُرفع إلى خادم.</span><button data-action="clear-private">إغلاق الملف الخاص</button></div>':state.demo?'<div class="demo-strip"><span><strong>نسخة تجريبية</strong> · جميع الأسماء والعلاقات للعرض فقط. التعديلات مؤقتة وتُمسح عند تحديث الصفحة.</span><button data-action="demo-info">عن هذه النسخة</button></div>':'')+'<div class="import-strip"><label class="btn" for="private-file">فتح نسخة العائلة الخاصة<input id="private-file" type="file" accept=".json,application/json" hidden></label><span>ملف JSON · القدس والأردن منفصلتان</span></div><div id="view"></div><footer class="copyright">عائلة النتشه · سجل العائلة ضمن مشروع صدقة جارية</footer></main></div></div>';
 renderView();
}
function heading(eyebrow,headline,description,actions=''){return '<div class="page-head"><div><div class="eyebrow">'+eyebrow+'</div><h1>'+headline+'</h1><p>'+description+'</p></div><div class="head-actions">'+actions+'</div></div>'}
function addButton(){return canEdit()?btn(icon('plus')+'إضافة فرد','add','primary'):''}
function branchBars(limit=Infinity){const ps=active();const max=Math.max(1,...state.data.branches.map(b=>ps.filter(p=>p.branch===b).length));return [...state.data.branches].sort((a,b)=>ps.filter(p=>p.branch===b).length-ps.filter(p=>p.branch===a).length).slice(0,limit).map(b=>{const n=ps.filter(p=>p.branch===b).length;return '<div class="branch-row"><div class="branch-label"><strong>'+esc(b)+'</strong><span>'+num(n)+' أفراد</span></div><div class="meter"><i style="width:'+n/max*100+'%"></i></div></div>'}).join('')}
function dashboard(){
 const ps=active(),root=ps.find(p=>!p.parentId),children=root?ps.filter(p=>p.parentId===root.id).slice(0,3):[];
 const mini=root?'<div class="mini-parent">'+esc(fullName(root))+'<small>'+esc(root.branch)+'</small></div>'+(children.length?'<div class="mini-line"></div><div class="mini-children">'+children.map(p=>'<button class="mini-child" data-person="'+p.id+'">'+esc(p.firstName)+'<small>'+esc(p.profession||'فرد من العائلة')+'</small></button>').join('')+'</div>':''):'<div class="empty"><h3>تبدأ الحكاية باسم</h3><p>أضف أول فرد لبناء شجرة العائلة.</p></div>';
 return heading('أهلًا بكم في سجل العائلة','أسماء نحفظها، وروابط نصلها','نظرة على أفراد العائلة وفخوذها وامتداد أجيالها.',btn(icon('download')+'تصدير السجل','export')+addButton())+stats()+'<div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><h2>حكايتنا في شجرة</h2><p>كل اسم امتداد لجذورنا</p></div>'+btn('استكشف الشجرة '+icon('arrow'),'tree','ghost')+'</div><div class="tree-preview">'+mini+'</div><div class="panel-foot"><span>علاقات عائلية مترابطة</span><span>'+num(ps.filter(p=>p.parentId).length)+' علاقة موثقة</span></div></section><section class="panel"><div class="panel-head"><div><h2>فخوذ العائلة</h2><p>توزيع الأفراد المسجلين</p></div><span class="badge gray">'+num(state.data.branches.length)+' فخوذ</span></div><div class="branch-list">'+branchBars(4)+(state.data.branches.length?'':'<p class="muted">لا توجد فخوذ بعد.</p>')+'</div></section></div><section class="panel"><div class="panel-head"><div><h2>أحدث تحديثات السجل</h2><p>آخر الملفات المضافة أو المحدّثة</p></div>'+btn('جميع الأفراد '+icon('arrow'),'directory','ghost')+'</div>'+personTable([...ps].sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))).slice(0,5))+'</section>';
}
function personTable(people){if(!people.length)return empty('لا توجد نتائج','جرّب اسمًا آخر أو أزل الفلاتر.');return '<div class="table-wrap"><table><thead><tr><th>الاسم</th><th>الفخذ</th><th>المدينة</th><th>حالة الحياة</th><th>الملف</th></tr></thead><tbody>'+people.map(p=>'<tr><td><div class="person-cell"><div class="avatar">'+esc(p.firstName[0])+'</div><div><button class="text-btn" data-person="'+p.id+'">'+esc(fullName(p))+'</button><small>'+esc(p.profession||'المهنة غير مسجلة')+'</small></div></div></td><td>'+esc(p.branch)+'</td><td>'+esc(p.city||'—')+'</td><td><span class="badge '+(p.life==='deceased'?'gray':'')+'">'+(p.life==='deceased'?'متوفى':'على قيد الحياة')+'</span></td><td><button class="icon-btn" data-person="'+p.id+'" aria-label="عرض ملف '+esc(fullName(p))+'">'+icon('arrow')+'</button></td></tr>').join('')+'</tbody></table></div>'}
function empty(h,p){return '<div class="empty">'+icon('search')+'<h3>'+h+'</h3><p>'+p+'</p></div>'}
function filterBar(){return '<div class="filters"><div class="search-box">'+icon('search')+'<input id="query" type="search" value="'+esc(state.q)+'" placeholder="ابحث بالاسم، المدينة أو المهنة…" aria-label="البحث في أفراد العائلة"></div><select id="branch-filter" aria-label="تصفية حسب الفخذ">'+options(state.data.branches,state.branch,'جميع الفخوذ')+'</select><select id="life-filter" aria-label="تصفية حسب حالة الحياة">'+options([['alive','الأحياء'],['deceased','المتوفون']],state.life,'جميع الحالات')+'</select>'+ (state.view==='directory'?'<div class="view-toggle"><button data-display="table" class="'+(state.display==='table'?'active':'')+'" aria-label="عرض جدول" aria-pressed="'+(state.display==='table')+'">'+icon('list')+'</button><button data-display="cards" class="'+(state.display==='cards'?'active':'')+'" aria-label="عرض بطاقات" aria-pressed="'+(state.display==='cards')+'">'+icon('grid')+'</button></div>':'')+'</div>'}
function cards(people){return '<div class="cards">'+people.map(p=>'<article class="person-card"><div class="avatar">'+esc(p.firstName[0])+'</div><h3><button class="text-btn" data-person="'+p.id+'">'+esc(fullName(p))+'</button></h3><p>'+esc(p.branch)+' · '+esc(p.city||'المدينة غير مسجلة')+'</p><div class="card-meta"><span class="badge '+(p.life==='deceased'?'gray':'')+'">'+(p.life==='deceased'?'رحمه الله':'على قيد الحياة')+'</span><button class="text-btn" data-person="'+p.id+'">عرض الملف</button></div></article>').join('')+'</div>'}
function directoryResults(){const all=filtered(),pages=Math.max(1,Math.ceil(all.length/10));state.page=Math.min(state.page,pages);const rows=all.slice((state.page-1)*10,state.page*10);return (rows.length?(state.display==='table'?personTable(rows):cards(rows)):empty('لم نجد أفرادًا مطابقين','غيّر كلمات البحث أو أزل الفلاتر.'))+'<div class="pagination"><span>'+num(all.length)+' فردًا مطابقًا</span><div class="page-controls">'+btn('السابق','prev','',state.page===1?'disabled':'')+'<span>'+num(state.page)+' / '+num(pages)+'</span>'+btn('التالي','next','',state.page===pages?'disabled':'')+'</div></div>'}
function directory(){return heading('دليل العائلة','أفراد العائلة','تعرّف إلى أفراد عائلتك، وابحث في ملفاتهم.',btn(icon('download')+'تصدير النتائج','export')+addButton())+'<section class="panel">'+filterBar()+'<div id="results" aria-live="polite">'+directoryResults()+'</div></section>'}
function treeContent(){
 const all=active(), filteredPeople=filtered(), ids=new Set();
 filteredPeople.forEach(p=>{ids.add(p.id);getAncestors(p,all).forEach(a=>ids.add(a.id))});
 const people=all.filter(p=>ids.has(p.id)),roots=people.filter(p=>!p.parentId||!ids.has(p.parentId));
 let nodeCount=0;
 function node(p,visited=new Set(),depth=0){
   if(visited.has(p.id)||depth>100||nodeCount++>10000)return '';
   const seen=new Set(visited);seen.add(p.id);const children=people.filter(x=>x.parentId===p.id);const folded=state.collapsed.has(p.id)&&!state.q;
   return '<div class="tree-node"><div class="node-card '+(p.life==='deceased'?'deceased ':'')+(p.id===state.selected?'selected':'')+'"><div class="avatar">'+esc(p.firstName[0])+'</div><button class="text-btn" data-person="'+p.id+'">'+esc(fullName(p))+'</button><small>'+esc(p.birthYear||'سنة الميلاد غير مسجلة')+(p.life==='deceased'?' · رحمه الله':'')+'</small>'+(children.length?'<button class="node-toggle" data-fold="'+p.id+'" aria-expanded="'+!folded+'" aria-label="'+(folded?'توسيع':'طي')+' أبناء '+esc(p.firstName)+'">'+(folded?'+':'−')+'</button>':'')+'</div>'+(!folded&&children.length?'<div class="tree-children">'+children.map(c=>node(c,seen,depth+1)).join('')+'</div>':'')+'</div>';
 }
 return roots.length?'<div class="family-tree" style="--zoom:'+state.zoom+'">'+roots.map(p=>node(p)).join('')+'</div>':empty('لا توجد شجرة مطابقة','أضف أفرادًا واربط كل فرد بأبيه، أو غيّر الفلاتر.');
}
function tree(){return heading('امتداد الأجيال','شجرة العائلة','اضغط على الاسم لعرض الملف، وعلى + أو − لفتح الفروع وطيّها.',addButton())+'<section class="panel">'+filterBar()+'<div class="tree-toolbar">'+btn('فتح الفروع','expand')+btn('طي الفروع','collapse')+'<span class="spacer"></span>'+btn('−','zoom-out','', 'aria-label="تصغير الشجرة"')+'<span id="zoom-label" class="small">'+num(Math.round(state.zoom*100))+'٪</span>'+btn('+','zoom-in','','aria-label="تكبير الشجرة"')+btn('إعادة الضبط','zoom-reset')+'</div><div class="tree-scroll" id="tree-results" tabindex="0" aria-label="شجرة العائلة، يمكن التمرير أفقيًا">'+treeContent()+'</div><div class="legend"><span><i></i>على قيد الحياة</span><span><i class="gold"></i>متوفى</span><span>تظهر الأصول للحفاظ على تسلسل النسب عند البحث.</span></div></section>'}
function branches(){return heading('جذور واحدة، وفروع ممتدة','الفخوذ والفروع','لكل فرع مكان في حكاية العائلة.',canEdit()?btn(icon('plus')+'إضافة فخذ','add-branch','primary'):'')+'<div class="branches-grid">'+state.data.branches.map(b=>{const ps=active().filter(p=>p.branch===b);return '<article class="panel branch-card"><div class="stat-icon">'+icon('branch')+'</div><h3>'+esc(b)+'</h3><p class="muted small">أفراد مسجلون في هذا الفرع</p><div class="branch-count">'+num(ps.length)+' <small>فردًا</small></div>'+btn('استعرض الأفراد '+icon('arrow'),'branch-members','', 'data-branch="'+esc(b)+'"')+'</article>'}).join('')+'</div>'}
function reportBars(key,labels){const ps=active(),counts={};ps.forEach(p=>{const label=labels?labels[p[key]]:(p[key]||'غير مسجل');counts[label]=(counts[label]||0)+1});return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([label,n])=>'<div class="branch-row"><div class="branch-label"><strong>'+esc(label)+'</strong><span>'+num(n)+' · '+num(Math.round(n/Math.max(1,ps.length)*100))+'٪</span></div><div class="meter"><i style="width:'+n/Math.max(1,ps.length)*100+'%"></i></div></div>').join('')||'<p class="muted">لا توجد بيانات بعد.</p>'}
function reports(){return heading('صورة أوضح للعائلة','الإحصاءات','تُحسب الأرقام من السجلات النشطة، دون الأفراد المؤرشفين.',btn(icon('print')+'طباعة التقرير','print')+btn(icon('download')+'تصدير الأفراد','export'))+stats()+'<div class="report-grid">'+[['توزيع الفخوذ',branchBars()],['التوزيع الجغرافي',reportBars('city')],['الحالة الاجتماعية',reportBars('marital',maritalLabels)],['الذكور والإناث',reportBars('gender',{male:'ذكور',female:'إناث',unknown:'غير مسجل'})]].map(([h,body])=>'<section class="panel"><div class="panel-head"><h2>'+h+'</h2></div><div class="report-bars">'+body+'</div></section>').join('')+'</div>'}
function admin(){
 const archived=state.data.people.filter(p=>p.archived);
 return heading('إدارة موثوقة للسجل','إدارة السجل','سجل للتغييرات، واستعادة الملفات المؤرشفة، وصلاحيات للمستخدمين.',!state.demo?btn(icon('plus')+'إضافة مستخدم','add-user','primary'):'')+(state.demo?'<div class="notice warning">في المعاينة تعمل إضافة الأفراد وتعديلهم وأرشفتهم مؤقتًا. الحسابات والحفظ المشترك يحتاجان تفعيل الخدمة الخاصة؛ لا تُدخل بيانات حقيقية هنا.</div>':'')+'<section class="panel" style="margin-bottom:22px"><div class="panel-head"><h2>الملفات المؤرشفة</h2><span class="badge gray">'+num(archived.length)+'</span></div>'+(archived.length?'<div class="audit-list">'+archived.map(p=>'<div class="audit-item"><div>'+esc(fullName(p))+'<small>'+esc(p.branch)+'</small></div>'+btn('استعادة','restore','', 'data-id="'+p.id+'"')+'</div>').join('')+'</div>':empty('لا توجد ملفات مؤرشفة','عند أرشفة فرد يمكنك استعادته من هنا.'))+'</section><section class="panel" style="margin-bottom:22px"><div class="panel-head"><h2>سجل التغييرات</h2><span class="muted small">أحدث ١٠٠ عملية</span></div>'+(state.data.audit.length?'<div class="audit-list">'+state.data.audit.map(a=>'<div class="audit-item"><div>'+esc(a.action)+'<small>'+esc(a.actor)+'</small></div><small>'+esc(dateLabel(a.createdAt))+'</small></div>').join('')+'</div>':empty('لا توجد تغييرات بعد','تظهر هنا عمليات الإضافة والتعديل والأرشفة.'))+'</section>'+(!state.demo?'<section class="panel"><div class="panel-head"><h2>المستخدمون</h2></div><div class="audit-list">'+state.data.users.map(u=>'<div class="audit-item"><div>'+esc(u.name)+'<small>'+esc(u.username)+' · '+({admin:'مدير',editor:'مشرف',viewer:'قراءة فقط'}[u.role])+'</small></div><span class="badge '+(!u.enabled?'gray':'')+'">'+(u.enabled?'نشط':'معطّل')+'</span>'+(u.id!==state.user.id?btn(u.enabled?'تعطيل':'تفعيل','toggle-user','', 'data-id="'+u.id+'" data-enabled="'+(u.enabled?0:1)+'"'):'')+'</div>').join('')+'</div></section>':'');
}
function renderView(){const views={dashboard,directory,tree,branches,reports,admin};$('#view').innerHTML=(views[state.view]||dashboard)()}
function navigate(view){state.view=view;state.q='';state.branch='';state.life='';state.page=1;shell();window.scrollTo(0,0)}
function modal(title,body,footer=''){const d=$('#dialog');d.innerHTML='<div class="dialog-head"><h2 id="dialog-title">'+title+'</h2><button class="icon-btn" data-action="close" aria-label="إغلاق">'+icon('close')+'</button></div><div class="dialog-body">'+body+'</div>'+(footer?'<div class="dialog-footer">'+footer+'</div>':'');if(!d.open)d.showModal()}
function closeDialog(){$('#dialog').close();$('#dialog').innerHTML=''}
function profile(id){
 const p=state.data.people.find(x=>x.id===id);if(!p)return;
 const parent=active().find(x=>x.id===p.parentId),children=active().filter(x=>x.parentId===id);
 const pairs=[['العائلة',regions[state.region]],['رقم السجل الأصلي',p.sourceId],['تاريخ الميلاد',p.birthDate],...(state.local&&p.duesRequired!==undefined?[['معدود الديوان — المطلوب',p.duesRequired],['المدفوع',p.duesPaid],['المتبقي',p.duesRemaining]]:[]),['الفخذ',p.branch],['المدينة',p.city],['سنة الميلاد',p.birthYear],['الحالة الاجتماعية',maritalLabels[p.marital]],['المهنة',p.profession],['التعليم',p.education],...((canEdit()||state.local)?[['الهاتف',p.phone],['البريد الإلكتروني',p.email]]:[]),...(p.life==='deceased'?[['سنة الوفاة',p.deathYear]]:[])];
 modal('ملف فرد من العائلة','<div class="profile-hero"><div class="avatar">'+esc(p.firstName[0])+'</div><div><h2>'+esc(fullName(p))+'</h2><p>'+esc(p.branch)+'</p><span class="badge '+(p.life==='deceased'?'gray':'')+'">'+(p.life==='deceased'?'رحمه الله':'على قيد الحياة')+'</span></div></div><dl class="details">'+pairs.map(([a,b])=>'<div><dt>'+a+'</dt><dd>'+esc(b||'غير مسجل')+'</dd></div>').join('')+'</dl><h3>صلة العائلة</h3>'+(parent?'<div class="relative"><span>الأب</span><button class="text-btn" data-person="'+parent.id+'">'+esc(fullName(parent))+'</button></div>':'<p class="muted small">لم يُربط ملف الأب بعد.</p>')+children.map(c=>'<div class="relative"><small>'+(c.gender==='female'?'ابنة':'ابن')+'</small><button class="text-btn" data-person="'+c.id+'">'+esc(fullName(c))+'</button></div>').join('')+((canEdit()||state.local)&&p.notes?'<div class="profile-note">'+esc(p.notes)+'</div>':''),btn('عرض في الشجرة','locate','', 'data-id="'+id+'"')+(canEdit()?btn(icon('edit')+'تعديل الملف','edit','primary','data-id="'+id+'"'):''));
}
function field(name,label,value='',type='text',extra=''){return '<div class="field"><label for="f-'+name+'">'+label+'</label><input id="f-'+name+'" name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></div>'}
function selectField(name,label,items,value='',empty){return '<div class="field"><label for="f-'+name+'">'+label+'</label><select id="f-'+name+'" name="'+name+'">'+options(items,value,empty)+'</select></div>'}
function personForm(id){
 const p=state.data.people.find(x=>x.id===id)||{gender:'male',life:'alive',marital:'unknown'};
 const fathers=active().filter(x=>x.id!==id&&x.gender!=='female').map(x=>[x.id,fullName(x)]);
 modal(id?'تعديل ملف فرد':'إضافة فرد إلى العائلة','<form id="person-form" data-id="'+esc(id||'')+'"><div id="form-error" class="error" role="alert"></div>'+(state.demo?'<div class="notice warning">استخدم بيانات تجريبية فقط. الحفظ هنا مؤقت لهذه الصفحة.</div>':'')+'<div class="form-grid"><div class="field-section">الاسم والانتساب</div>'+field('firstName','الاسم الأول *',p.firstName,'text','required maxlength="60"')+field('fatherName','اسم الأب *',p.fatherName,'text','required maxlength="60"')+field('grandName','اسم الجد',p.grandName,'text','maxlength="60"')+selectField('branch','الفخذ *',state.data.branches,p.branch,'اختر الفخذ')+selectField('gender','الجنس',[['unknown','غير مسجل'],['male','ذكر'],['female','أنثى']],p.gender)+selectField('parentId','ربط ملف الأب',fathers,p.parentId,'غير مرتبط')+'<div class="field-section">المعلومات الشخصية</div>'+field('birthYear','سنة الميلاد',p.birthYear,'number','min="1500" max="'+new Date().getFullYear()+'"')+selectField('marital','الحالة الاجتماعية',Object.entries(maritalLabels),p.marital)+selectField('life','حالة الحياة',[['alive','على قيد الحياة'],['deceased','متوفى']],p.life)+field('deathYear','سنة الوفاة (للمتوفى)',p.deathYear,'number','min="1500" max="'+new Date().getFullYear()+'"')+field('city','المدينة',p.city,'text','maxlength="80"')+field('profession','المهنة',p.profession,'text','maxlength="100"')+field('education','التعليم / التخصص',p.education,'text','maxlength="100"')+'<div class="field-section">معلومات خاصة بالمشرفين</div>'+field('phone','رقم الهاتف',p.phone,'tel','maxlength="30" dir="ltr"')+field('email','البريد الإلكتروني',p.email,'email','maxlength="150" dir="ltr"')+'<div class="field span2"><label for="f-notes">ملاحظات</label><textarea id="f-notes" name="notes" rows="3" maxlength="2000">'+esc(p.notes||'')+'</textarea></div></div></form>',(id?btn(icon('archive')+'أرشفة','archive','danger','data-id="'+id+'"'):'')+btn('إلغاء','close')+'<button class="btn primary" type="submit" form="person-form">'+icon('check')+'حفظ الملف</button>');
}
function audit(action){state.data.audit.unshift({action,actor:'مشرف المعاينة',createdAt:new Date().toISOString()});state.data.audit=state.data.audit.slice(0,100)}
async function savePerson(form){
 const id=form.dataset.id,old=state.data.people.find(p=>p.id===id);const data=Object.fromEntries(new FormData(form));
 if(data.life==='alive')data.deathYear='';
 const errors=validatePerson(data,state.data.people,state.data.branches,id);
 if(errors.length)throw Error(errors.join(' '));
 if(state.demo){const person={...old,...data,id:id||crypto.randomUUID(),version:(old?.version||0)+1,archived:0,updatedAt:new Date().toISOString()};if(old)Object.assign(old,person);else state.data.people.unshift(person);audit(id?'تعديل ملف فرد':'إضافة فرد جديد')}
 else{await api('members'+(id?'/'+id:''),{...data,version:old?.version},id?'PUT':'POST');await load()}
 closeDialog();shell();toast(state.demo?'تم الحفظ مؤقتًا في المعاينة.':'تم حفظ الملف.');
}
async function archivePerson(id,restore=false){
 const p=state.data.people.find(x=>x.id===id);if(!p)return;
 if(state.demo){if(!restore&&active().some(x=>x.parentId===id))throw Error('اربط الأبناء بأب آخر أو أزل ارتباطهم قبل أرشفة الأب.');p.archived=restore?0:1;p.version++;audit(restore?'استعادة ملف فرد':'أرشفة ملف فرد')}
 else{await api('members/'+id+'/archive',{archived:restore?0:1,version:p.version});await load()}
 closeDialog();shell();toast(restore?'تمت استعادة الملف.':'تمت الأرشفة؛ يمكنك الاستعادة من إدارة السجل.');
}
function exportCSV(){
 const people=state.view==='directory'?filtered():active();
 const headings=['العائلة','رقم السجل الأصلي','رقم الأب المرتبط','الاسم','اسم الأب','اسم الجد','الفخذ','الجنس','سنة الميلاد','حالة الحياة','الحالة الاجتماعية','المدينة','المهنة','التعليم'];
 const rows=people.map(p=>[regions[state.region],p.sourceId||p.id,p.parentId,p.firstName,p.fatherName,p.grandName,p.branch,({male:'ذكر',female:'أنثى',unknown:'غير مسجل'}[p.gender]),p.birthYear,p.life==='alive'?'حي':'متوفى',maritalLabels[p.marital],p.city,p.profession,p.education]);
 const blob=new Blob(['\uFEFF'+[headings,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=(state.demo?'DEMO-':'')+'natsha-family-'+state.region+'-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('تم تصدير '+num(people.length)+' سجلًا دون معلومات الاتصال الخاصة.');
}
function loginScreen(){
 $('#app').innerHTML='<main class="login-shell"><section class="login-card"><div class="brand-mark">'+icon('tree')+'</div><h1>سجل عائلة النتشه</h1><p>مرحبًا بكم. سجّل الدخول للاطلاع على أفراد العائلة وشجرتها.</p><form id="login-form"><div class="error" id="form-error" role="alert"></div>'+field('username','اسم المستخدم','','text','required autocomplete="username" maxlength="60"')+field('password','كلمة المرور','','password','required autocomplete="current-password" maxlength="200"')+'<button class="btn primary" type="submit">دخول إلى السجل '+icon('arrow')+'</button></form><a class="btn ghost" href="index.html">العودة إلى صدقة جارية</a></section></main>';
}
async function action(el){
 const a=el.dataset.action;
 if(a==='clear-private'){state.local=false;state.demo=true;state.datasets={quds:createDemo(),jordan:createDemo()};state.data=state.datasets[state.region];closeDialog();navigate('dashboard');return}
 if(a==='close')return closeDialog();
 if(a==='menu'){const sidebar=$('#sidebar');sidebar.classList.toggle('open');return}
 if(a==='add')return personForm();
 if(a==='edit')return personForm(el.dataset.id);
 if(a==='tree'||a==='directory')return navigate(a);
 if(a==='export')return exportCSV();
 if(a==='print')return window.print();
 if(a==='prev'||a==='next'){state.page+=a==='next'?1:-1;$('#results').innerHTML=directoryResults();return}
 if(a==='locate'){const id=el.dataset.id;closeDialog();navigate('tree');state.selected=id;getAncestors(state.data.people.find(p=>p.id===id),active()).forEach(p=>state.collapsed.delete(p.id));state.branch=state.data.people.find(p=>p.id===id).branch;renderView();$('.node-card.selected')?.scrollIntoView({block:'center',inline:'center',behavior:'smooth'});return}
 if(a==='expand'||a==='collapse'){state.collapsed=a==='collapse'?new Set(active().map(p=>p.id)):new Set();$('#tree-results').innerHTML=treeContent();return}
 if(a.startsWith('zoom-')){state.zoom=a==='zoom-reset'?1:Math.min(1.5,Math.max(.6,state.zoom+(a==='zoom-in'?.1:-.1)));$('#tree-results').innerHTML=treeContent();$('#zoom-label').textContent=num(Math.round(state.zoom*100))+'٪';return}
 if(a==='branch-members'){navigate('directory');state.branch=el.dataset.branch;renderView();return}
 if(a==='demo-info')return modal('نسخة المعاينة','<p style="line-height:2">هذه نسخة تفاعلية من سجل عائلة النتشه، بأسماء وعلاقات وهمية. يمكنك تجربة البحث والشجرة والإضافة والتعديل والأرشفة والتصدير. التعديلات تبقى في ذاكرة الصفحة فقط، ولا تُرفع إلى أي قاعدة بيانات.</p><div class="notice" style="margin-top:18px">لتشغيل السجل الفعلي، يلزم ربط الخدمة الخاصة وإنشاء حسابات المشرفين. لا تستخدم كلمات مرور الموقع القديم في هذه المعاينة.</div>',btn('فهمت','close','primary'));
 if(a==='add-branch')return modal('إضافة فخذ','<form id="branch-form"><div id="form-error" class="error" role="alert"></div>'+field('name','اسم الفخذ','','text','required maxlength="80"')+'</form>',btn('إلغاء','close')+'<button class="btn primary" type="submit" form="branch-form">إضافة الفخذ</button>');
 if(a==='archive')return modal('أرشفة هذا الملف؟','<p style="line-height:2">سيختفي الفرد من السجل النشط والشجرة، ويمكن لمدير السجل استعادته لاحقًا. لا يمكن أرشفة أب مرتبط بأبناء نشطين.</p><div id="form-error" class="error" role="alert"></div>',btn('إلغاء','close')+btn('تأكيد الأرشفة','confirm-archive','danger','data-id="'+el.dataset.id+'"'));
 if(a==='confirm-archive')return archivePerson(el.dataset.id);
 if(a==='restore')return archivePerson(el.dataset.id,true);
 if(a==='logout'){await api('logout',{});state.token='';state.data={people:[],branches:[],users:[],audit:[]};state.datasets={};state.user=null;loginScreen();return}
 if(a==='add-user')return modal('إضافة مستخدم — '+regions[state.region],'<p class="notice">صلاحية الحساب الجديد تخص عائلة '+regions[state.region]+' فقط.</p><form id="user-form"><div class="error" id="form-error" role="alert"></div><div class="form-grid">'+field('name','الاسم','','text','required maxlength="80"')+field('username','اسم المستخدم','','text','required maxlength="60" autocomplete="off"')+selectField('role','الصلاحية',[['viewer','قراءة فقط'],['editor','مشرف إضافة وتعديل'],['admin','مدير كامل']], 'viewer')+field('password','كلمة المرور (12 حرفًا على الأقل)','','password','required minlength="12" maxlength="200" autocomplete="new-password"')+'</div></form>',btn('إلغاء','close')+'<button class="btn primary" type="submit" form="user-form">إنشاء المستخدم</button>');
 if(a==='toggle-user'){await api('users/'+el.dataset.id,{enabled:Number(el.dataset.enabled)},'PUT');await load();shell();toast('تم تحديث حالة الحساب.');return}
}
document.addEventListener('click',async event=>{
 const el=event.target.closest('button');if(!el||state.busy)return;
 try{
  if(el.dataset.view)return navigate(el.dataset.view);
  if(el.dataset.person)return profile(el.dataset.person);
  if(el.dataset.display){state.display=el.dataset.display;renderView();return}
  if(el.dataset.fold){state.collapsed.has(el.dataset.fold)?state.collapsed.delete(el.dataset.fold):state.collapsed.add(el.dataset.fold);$('#tree-results').innerHTML=treeContent();return}
  if(el.dataset.action){state.busy=true;await action(el)}
 }catch(e){if($('#dialog').open&&$('#form-error'))$('#form-error').textContent=e.message;else toast(e.message)}
 finally{state.busy=false}
});
document.addEventListener('input',event=>{
 if(event.target.id!=='query')return;state.q=event.target.value;state.page=1;
 if(state.view==='directory')$('#results').innerHTML=directoryResults();
 else if(state.view==='tree')$('#tree-results').innerHTML=treeContent();
});
document.addEventListener('change',async event=>{
 if(event.target.id==='region-select'){const previousRegion=state.region;state.datasets[state.region]=state.data;state.region=event.target.value;if(!state.demo){try{await load()}catch(e){state.region=previousRegion;if(state.token)shell();toast(e.message);return}}else state.data=state.datasets[state.region];state.collapsed=new Set(state.local?state.data.people.map(p=>p.id):[]);state.selected='';closeDialog();navigate('dashboard');return}
 if(event.target.id==='private-file'){try{const file=event.target.files[0];if(!file)return;if(file.size>20*1024*1024)throw Error('حجم الملف أكبر من الحد المسموح.');const bundle=validateImport(JSON.parse(await file.text()));state.datasets=bundle.regions;state.local=true;state.demo=true;state.data=state.datasets[state.region];state.collapsed=new Set(state.data.people.map(p=>p.id));closeDialog();navigate('dashboard');toast('تم فتح النسخة الخاصة دون رفعها إلى خادم.')}catch(e){toast(e.message)}return}

 if(event.target.id==='branch-filter')state.branch=event.target.value;
 else if(event.target.id==='life-filter')state.life=event.target.value;else return;
 state.page=1;if(state.view==='directory')$('#results').innerHTML=directoryResults();else $('#tree-results').innerHTML=treeContent();
});
document.addEventListener('submit',async event=>{
 event.preventDefault();if(state.busy)return;state.busy=true;
 const form=event.target,submit=document.querySelector('button[form="'+form.id+'"]')||form.querySelector('[type="submit"]');
 if(submit)submit.disabled=true;const error=$('#form-error');if(error)error.textContent='';
 try{
  if(form.id==='person-form')await savePerson(form);
  else if(form.id==='branch-form'){const name=new FormData(form).get('name').trim();if(!name)throw Error('أدخل اسم الفخذ.');if(state.data.branches.includes(name))throw Error('هذا الفخذ مسجل بالفعل.');if(state.demo){state.data.branches.push(name);audit('إضافة فخذ')}else{await api('branches',{name});await load()}closeDialog();shell();toast('تمت إضافة الفخذ.')}
  else if(form.id==='login-form'){const data=await api('login',Object.fromEntries(new FormData(form)));state.token=data.token;state.user=data.user;state.region=data.user.regions.includes(state.region)?state.region:data.user.regions[0];form.reset();await load();shell()}
  else if(form.id==='user-form'){await api('users',Object.fromEntries(new FormData(form)));form.reset();await load();closeDialog();shell();toast('تم إنشاء المستخدم.')}
 }catch(e){if(error&&error.isConnected)error.textContent=e.message;else toast(e.message)}
 finally{state.busy=false;if(submit)submit.disabled=false}
});
if(window.PRIVATE_FAMILY_BUNDLE){const bundle=validateImport(window.PRIVATE_FAMILY_BUNDLE);state.datasets=bundle.regions;state.local=true;state.demo=true;state.data=state.datasets[state.region];state.collapsed=new Set(state.data.people.map(p=>p.id));delete window.PRIVATE_FAMILY_BUNDLE;}
if(state.demo)shell();else{state.data={people:[],branches:[],users:[],audit:[]};state.user=null;loginScreen()}
