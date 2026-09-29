"""Convert DOM exports; run on PRIVATE paths, never put exports in this public repository."""
import argparse,json,re,collections
from pathlib import Path
from urllib.parse import urlparse,parse_qs
from datetime import datetime,timezone
parser=argparse.ArgumentParser();parser.add_argument('input');parser.add_argument('output');args=parser.parse_args()
root=Path(args.input);dest=Path(args.output);dest.mkdir(parents=True,exist_ok=True)
def read(name):return json.loads((root/name).read_text())
def text(v):return str(v or '').strip()
def clean(v):return '' if text(v) in ['—','-'] else text(v)
def source_id(url,region):
 expected={'quds':'quds.infinityfreeapp.com','jordan':'jordannatsheh.free.nf'}[region]
 parsed=urlparse(url)
 assert parsed.hostname==expected and parsed.path=='/persons/show.php'
 n=parse_qs(parsed.query)['id'][0];assert n.isdigit();return n

def snapshot_lines(s):
 out=[]
 for line in s.splitlines():
  m=re.match(r'\s*- (?:generic|text|strong|paragraph): (.*)',line)
  if m:
   v=m[1]
   if v.startswith('"') and v.endswith('"'):
    try:v=json.loads(v)
    except ValueError:pass
   out.append(v)
 return out
bundle={'format':'natsha-family-v1','exportedAt':datetime.now(timezone.utc).isoformat(),'regions':{}}
report={}
for region in ['quds','jordan']:
 source=read(region+'-source.json');trees=read(region+'-tree.json');profiles=read(region+'-profiles.json')
 assert len(source['rows'])==len(trees)==len(profiles)
 tree={source_id(p['url'],region):p for p in trees};profile={source_id(p['url'],region):p for p in profiles}
 assert len(tree)==len(trees) and len(profile)==len(profiles)
 people=[]
 for row in source['rows']:
  sid=source_id(row['url'],region);t=tree[sid];p=profile[sid];f={x['key']:clean(x['value']) for x in p['fields']};lines=snapshot_lines(p['snapshot'])
  note='';updated='';created=''
  for i,line in enumerate(lines):
   if '📝' in line and 'ملاحظات' in line and i+1<len(lines):note=clean(lines[i+1])
   if line.startswith('آخر تحديث:'):updated=line.split(':',1)[1].strip()
   if line.startswith('أُضيف في:'):created=line.split(':',1)[1].strip()
  life='deceased' if 'is-deceased' in t['classes'] else 'alive'
  marital={'أعزب':'single','عزباء':'single','متزوج':'married','متزوجة':'married','مطلق':'divorced','مطلقة':'divorced','أرمل':'widowed','أرملة':'widowed'}.get(f.get('الحالة الاجتماعية'),'unknown')
  record=dict(id=region+'-'+sid,region=region,sourceId=sid,sourceUrl=row['url'],firstName=f['الاسم الأول'],fatherName=f['اسم الأب'],grandName=f['اسم الجد'],branch=f['الفخذ'],gender='unknown',birthYear=f['سنة الميلاد'],birthDate=f['تاريخ الميلاد'],deathYear='',life=life,marital=marital,sourceMarital=f['الحالة الاجتماعية'],parentId=region+'-'+source_id(t['parentUrl'],region) if t['parentUrl'] else '',city='',profession=f['الوظيفة / المهنة'],education=f['المستوى التعليمي / التخصص'],phone=f['الجوال'],email=f['الإيميل'],notes=note,version=1,archived=0,updatedAt=updated,createdAt=created)
  for ar,key in [('المبلغ المطلوب','duesRequired'),('المبلغ المدفوع','duesPaid'),('المتبقي','duesRemaining')]:
   if ar in lines:record[key]=lines[lines.index(ar)+1]
  people.append(record)
 ids={p['id'] for p in people};assert len(ids)==len(people)
 assert all(not p['parentId'] or p['parentId'] in ids for p in people)
 grouped=collections.defaultdict(list)
 for p in people:
  name=' '.join(p[k] for k in ['firstName','fatherName','grandName']);norm=re.sub('[أإآ]','ا',name);norm=re.sub('[\u064B-\u065F\u0670\u0640]','',norm);grouped[norm].append(p['id'])
 duplicates=[v for v in grouped.values() if len(v)>1]
 bundle['regions'][region]={'people':people,'branches':[text(b) for b in source['branches']],'audit':[],'users':[],'sourceRegion':region,'extractedAt':source['extractedAt']}
 report[region]={'records':len(people),'profiles':len(profiles),'branches':len(source['branches']),'relations':sum(bool(p['parentId']) for p in people),'life':dict(collections.Counter(p['life'] for p in people)),'marital':dict(collections.Counter(p['marital'] for p in people)),'similarNameGroups':duplicates,'missingGender':len(people)}
(dest/'family-data-private.json').write_text(json.dumps(bundle,ensure_ascii=False,indent=2));(dest/'migration-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
for p in dest.glob('*.json'):p.chmod(0o600)
print(json.dumps({k:{a:v for a,v in r.items() if a!='similarNameGroups'} for k,r in report.items()},ensure_ascii=False))
