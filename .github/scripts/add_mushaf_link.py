from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

quran_btn='<button class="mainBtn go" data-page="quran"><span>📖</span>استمع للقرآن الكريم</button>'
mushaf_btn='<button class="mainBtn" onclick="location.href=\'mushaf.html\'"><span>📚</span>قراءة المصحف الشريف</button>'
if "location.href='mushaf.html'" not in s:
    s=s.replace(quran_btn,quran_btn+mushaf_btn,1)

radio_link='<a class="radioLink" href="radio.html" target="_blank" rel="noopener">فتح إذاعة النتشة المحسّنة</a>'
mushaf_link='<a class="radioLink" href="mushaf.html">📚 فتح المصحف الشريف</a>'
if '📚 فتح المصحف الشريف' not in s:
    s=s.replace(radio_link,radio_link+mushaf_link,1)

s=s.replace('قرآن كريم • أذكار • مسبحة إلكترونية','قرآن كريم • مصحف • أذكار • مسبحة إلكترونية',1)
s=s.replace('📖 قرآن كريم • 📿 مسبحة إلكترونية • 🌅🌙 أذكار شاملة','📖 قرآن ومصحف • 📿 مسبحة عالمية • 🌅🌙 أذكار شاملة',1)
s=s.replace('قرآن كريم وأذكار ومسبحة إلكترونية — صدقة جارية عن أحياء وأموات عائلة النتشة','قرآن كريم ومصحف وأذكار ومسبحة إلكترونية — صدقة جارية عن أحياء وأموات عائلة النتشة',1)
s=s.replace('قرآن كريم • أذكار الصباح والمساء • مسبحة إلكترونية','قرآن كريم ومصحف • أذكار شاملة • مسبحة عالمية',1)
p.write_text(s,encoding='utf-8')
