from pathlib import Path
import re

p = Path('index.html')
s = p.read_text(encoding='utf-8')

if '.adhkarModes{' not in s:
    s = s.replace(
        '.adhkarTitle{',
        '.adhkarModes{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}.modeBtn{border:1px solid #ddc98e;background:#fff;color:var(--g);border-radius:15px;padding:14px 8px;font-size:17px;font-weight:900;cursor:pointer}.modeBtn.active{background:var(--g);color:#fff;border-color:var(--g)}.adhkarTitle{',
        1,
    )
    s = s.replace(
        '@media(max-width:620px){.nav{grid-template-columns:repeat(2,1fr)}',
        '@media(max-width:620px){.nav{grid-template-columns:repeat(2,1fr)}.adhkarModes{grid-template-columns:repeat(2,1fr)}',
        1,
    )

old_evening_button = '<button class="mainBtn go" data-page="adhkar" data-mode="evening"><span>🌙</span>أذكار المساء</button>'
if 'data-mode="sleep"' not in s:
    s = s.replace(
        old_evening_button,
        old_evening_button
        + '<button class="mainBtn go" data-page="adhkar" data-mode="sleep"><span>😴</span>أذكار النوم</button>'
        + '<button class="mainBtn go" data-page="adhkar" data-mode="afterPrayer"><span>🕌</span>أذكار بعد الصلاة</button>',
        1,
    )

old_section = '<section id="adhkar" class="page"><div class="card"><h2 class="adhkarTitle" id="adhkarTitle">أذكار الصباح</h2><div class="actions"><button class="share" id="morningBtn">🌅 أذكار الصباح</button><button class="share" id="eveningBtn">🌙 أذكار المساء</button></div><div id="adhkarList"></div></div></section>'
new_section = '<section id="adhkar" class="page"><div class="card"><h2 class="adhkarTitle" id="adhkarTitle">أذكار الصباح</h2><div class="adhkarModes"><button class="modeBtn active" data-mode="morning">🌅 الصباح</button><button class="modeBtn" data-mode="evening">🌙 المساء</button><button class="modeBtn" data-mode="sleep">😴 النوم</button><button class="modeBtn" data-mode="afterPrayer">🕌 بعد الصلاة</button><button class="modeBtn" data-mode="travel">🚗 السفر</button><button class="modeBtn" data-mode="duas">🤲 أدعية مختارة</button></div><div id="adhkarList"></div></div></section>'
s = s.replace(old_section, new_section, 1)

block = """const morning=[['آية الكرسي','مرة واحدة'],['قُلْ هُوَ اللَّهُ أَحَدٌ، قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ، قُلْ أَعُوذُ بِرَبِّ النَّاسِ','3 مرات'],['أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير','مرة واحدة'],['اللهم بك أصبحنا وبك أمسينا وبك نحيا وبك نموت وإليك النشور','مرة واحدة'],['رضيت بالله ربًا، وبالإسلام دينًا، وبمحمد ﷺ نبيًا','3 مرات'],['بسم الله الذي لا يضر مع اسمه شيء في الأرض ولا في السماء وهو السميع العليم','3 مرات'],['حسبي الله لا إله إلا هو عليه توكلت وهو رب العرش العظيم','7 مرات'],['سبحان الله وبحمده','100 مرة']];
const evening=[['آية الكرسي','مرة واحدة'],['قُلْ هُوَ اللَّهُ أَحَدٌ، قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ، قُلْ أَعُوذُ بِرَبِّ النَّاسِ','3 مرات'],['أمسينا وأمسى الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير','مرة واحدة'],['اللهم بك أمسينا وبك أصبحنا وبك نحيا وبك نموت وإليك المصير','مرة واحدة'],['رضيت بالله ربًا، وبالإسلام دينًا، وبمحمد ﷺ نبيًا','3 مرات'],['بسم الله الذي لا يضر مع اسمه شيء في الأرض ولا في السماء وهو السميع العليم','3 مرات'],['أعوذ بكلمات الله التامات من شر ما خلق','3 مرات'],['سبحان الله وبحمده','100 مرة']];
const sleep=[['آية الكرسي','مرة واحدة'],['قُلْ هُوَ اللَّهُ أَحَدٌ، وقُلْ أَعُوذُ بِرَبِّ الْفَلَقِ، وقُلْ أَعُوذُ بِرَبِّ النَّاسِ','3 مرات'],['باسمك اللهم أموت وأحيا','مرة واحدة'],['اللهم قِني عذابك يوم تبعث عبادك','3 مرات'],['سبحان الله','33 مرة'],['الحمد لله','33 مرة'],['الله أكبر','34 مرة']];
const afterPrayer=[['أستغفر الله','3 مرات'],['اللهم أنت السلام ومنك السلام، تباركت يا ذا الجلال والإكرام','مرة واحدة'],['آية الكرسي','مرة واحدة'],['سبحان الله','33 مرة'],['الحمد لله','33 مرة'],['الله أكبر','34 مرة'],['لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير','مرة واحدة']];
const travel=[['الله أكبر','3 مرات'],['سبحان الذي سخر لنا هذا وما كنا له مقرنين، وإنا إلى ربنا لمنقلبون','مرة واحدة'],['اللهم إنا نسألك في سفرنا هذا البر والتقوى، ومن العمل ما ترضى، اللهم هون علينا سفرنا هذا واطوِ عنا بعده','مرة واحدة'],['اللهم أنت الصاحب في السفر، والخليفة في الأهل','مرة واحدة'],['أستودع الله دينك وأمانتك وخواتيم عملك','عند توديع المسافر']];
const duas=[['ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار','مرة أو أكثر'],['اللهم إنك عفو تحب العفو فاعفُ عني','مرة أو أكثر'],['حسبي الله لا إله إلا هو عليه توكلت وهو رب العرش العظيم','7 مرات'],['لا حول ولا قوة إلا بالله','ما تيسر'],['رب اشرح لي صدري ويسر لي أمري','مرة أو أكثر'],['اللهم اغفر لي ولوالدي ولأحياء وأموات عائلة النتشة','مرة أو أكثر']];
const adhkarSets={morning:{title:'🌅 أذكار الصباح',items:morning},evening:{title:'🌙 أذكار المساء',items:evening},sleep:{title:'😴 أذكار النوم',items:sleep},afterPrayer:{title:'🕌 أذكار بعد الصلاة',items:afterPrayer},travel:{title:'🚗 أذكار السفر',items:travel},duas:{title:'🤲 أدعية مختارة',items:duas}};
function renderAdhkar(mode){const set=adhkarSets[mode]||adhkarSets.morning;document.getElementById('adhkarTitle').textContent=set.title;document.querySelectorAll('.modeBtn').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));let list=document.getElementById('adhkarList');list.innerHTML='';set.items.forEach((x,i)=>{let d=document.createElement('div');d.className='dhikr';d.innerHTML='<div class=\"text\">'+x[0]+'</div><div class=\"repeat\">'+x[1]+'</div><button>تمت القراءة</button>';d.querySelector('button').onclick=()=>{d.classList.toggle('done');d.querySelector('button').textContent=d.classList.contains('done')?'تم ✓':'تمت القراءة'};list.appendChild(d)})}
document.querySelectorAll('.modeBtn').forEach(b=>b.onclick=()=>renderAdhkar(b.dataset.mode));renderAdhkar('morning');"""

pattern = r"const morning=.*?renderAdhkar\('morning'\);"
s, n = re.subn(pattern, lambda _m: block, s, count=1, flags=re.S)
if n != 1:
    raise SystemExit('Could not replace adhkar JavaScript block')

s = s.replace(
    '📖 قرآن كريم • 📿 مسبحة إلكترونية • 🌅 أذكار الصباح • 🌙 أذكار المساء',
    '📖 قرآن كريم • 📿 مسبحة إلكترونية • 🌅🌙 أذكار شاملة',
    1,
)

p.write_text(s, encoding='utf-8')
