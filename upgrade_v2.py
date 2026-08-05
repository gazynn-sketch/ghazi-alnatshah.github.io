from pathlib import Path
import re
p=Path('index.html')
s=p.read_text(encoding='utf-8')
if 'og:title' not in s:
    s=s.replace('<title>صدقة جارية لعائلة النتشة</title>','''<title>صدقة جارية لعائلة النتشة</title>
<meta name="description" content="قرآن كريم وأذكار ومسبحة إلكترونية — صدقة جارية عن أحياء وأموات عائلة النتشة">
<meta property="og:title" content="صدقة جارية لعائلة النتشة">
<meta property="og:description" content="قرآن كريم • أذكار الصباح والمساء • مسبحة إلكترونية">
<meta property="og:type" content="website">
<meta property="og:url" content="https://gazynn-sketch.github.io/ghazi-alnatshah.github.io/">
<meta property="og:image" content="https://gazynn-sketch.github.io/ghazi-alnatshah.github.io/natsha-project-poster.svg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="natsha-family-logo.svg">
<link rel="apple-touch-icon" href="natsha-family-logo.svg">
<link rel="manifest" href="manifest.json">''',1)
s=re.sub(r'\.seal\{[^}]*\}', '.seal{width:116px;height:116px;border-radius:50%;margin:auto;display:block;object-fit:cover;background:#fff;border:4px solid var(--gold);box-shadow:0 14px 35px rgba(13,75,57,.25)}', s, count=1)
s=s.replace('<header><div class="seal">۞</div>','<header><img class="seal" src="natsha-family-logo.svg" alt="شعار عائلة النتشة">',1)
if 'id="shareProject"' not in s:
    s=s.replace('</div></div><div class="card dua"><b>اللهم اجعل ثواب هذا العمل</b>','''</div><div class="actions" style="margin-top:16px"><button class="share" id="shareProject">📤 شارك المشروع</button><button class="share" id="installApp" style="display:none">📲 ثبّت التطبيق</button></div><a class="radioLink" href="natsha-project-poster.svg" target="_blank" download>🖼️ تحميل صورة المشروع</a></div><div class="card dua"><b>اللهم اجعل ثواب هذا العمل</b>''',1)
s=s.replace('<div id="globalTotal" style="font-size:58px;font-weight:900;color:#f4db92;margin:8px 0">2,483,915</div>','<div id="globalTotal" style="font-size:58px;font-weight:900;color:#f4db92;margin:8px 0">0</div>')
s=s.replace('عداد جماعي يظهر للجميع ويزيد مع تسبيحات أفراد العائلة.','عداد محلي حاليًا، وسيصبح جماعيًا بعد ربط قاعدة البيانات.')
s=s.replace('let globalTotal=+(localStorage.nsGlobalPreview||2483915);','let globalTotal=+(localStorage.nsGlobalPreview||0);if(!GLOBAL_API&&globalTotal>1000000){globalTotal=0;localStorage.nsGlobalPreview=0;}',1)
s=s.replace('نسخة تجريبية محلية — يلزم ربط قاعدة بيانات مشتركة','عداد محلي تجريبي — العداد العالمي الحقيقي قيد التفعيل')
if 'beforeinstallprompt' not in s:
    s=s.replace('</body>','''<script>
const shareProject=document.getElementById('shareProject');if(shareProject)shareProject.onclick=async()=>{const d={title:'صدقة جارية لعائلة النتشة',text:'🌿 صدقة جارية لعائلة النتشة\\n📖 قرآن كريم • 📿 مسبحة إلكترونية • 🌅 أذكار الصباح • 🌙 أذكار المساء',url:location.href};if(navigator.share)await navigator.share(d).catch(()=>{});else await navigator.clipboard.writeText(location.href)};
let deferredInstall=null;const installBtn=document.getElementById('installApp');window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;if(installBtn)installBtn.style.display='block'});if(installBtn)installBtn.onclick=async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;installBtn.style.display='none'};if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
</script></body>''',1)
p.write_text(s,encoding='utf-8')
