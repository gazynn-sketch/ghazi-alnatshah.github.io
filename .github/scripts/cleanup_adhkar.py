from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')
s = s.replace("document.getElementById('morningBtn').onclick=()=>renderAdhkar('morning');", '')
s = s.replace("document.getElementById('eveningBtn').onclick=()=>renderAdhkar('evening');", '')
s = s.replace("renderAdhkar('morning');renderAdhkar('morning');", "renderAdhkar('morning');")
p.write_text(s, encoding='utf-8')
