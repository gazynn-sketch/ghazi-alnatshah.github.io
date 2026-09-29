export const normalize = value => String(value ?? '').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').trim().toLowerCase();
export const fullName = p => [p.firstName,p.fatherName,p.grandName].filter(Boolean).join(' ');
export const arabicNumber = n => Number(n).toLocaleString('ar-JO');
export function matches(p, query) {
  const haystack = normalize([fullName(p),p.branch,p.city,p.profession,p.education].join(' '));
  return normalize(query).split(/\s+/).every(word => haystack.includes(word));
}
export function validatePerson(p, people, branches, id = '') {
  const errors = [];
  if (!p.firstName?.trim() || !p.fatherName?.trim()) errors.push('الاسم واسم الأب مطلوبان.');
  if (!branches.includes(p.branch)) errors.push('اختر فخذًا مسجلًا.');
  if (!['male','female','unknown'].includes(p.gender)) errors.push('اختر الجنس.');
  if (!['single','married','divorced','widowed','unknown'].includes(p.marital)) errors.push('الحالة الاجتماعية غير صحيحة.');
  if (!['alive','deceased'].includes(p.life)) errors.push('حالة الحياة غير صحيحة.');
  const year = new Date().getFullYear();
  for (const key of ['birthYear','deathYear']) if (p[key] !== '' && p[key] != null && (!Number.isInteger(Number(p[key])) || Number(p[key]) < 1500 || Number(p[key]) > year)) errors.push('السنة يجب أن تكون بين 1500 والسنة الحالية.');
  if (p.life === 'deceased' && p.birthYear && p.deathYear && Number(p.deathYear) < Number(p.birthYear)) errors.push('سنة الوفاة لا تسبق سنة الميلاد.');
  if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) errors.push('البريد الإلكتروني غير صحيح.');
  const seen = new Set([id]);
  let parentId = p.parentId;
  while (parentId) {
    if (seen.has(parentId)) { errors.push('علاقة الأب تنشئ حلقة في شجرة العائلة.'); break; }
    seen.add(parentId);
    const parent = people.find(x => x.id === parentId);
    if (!parent || parent.archived) { errors.push('الأب المختار غير متاح.'); break; }
    if (p.region && parent.region && p.region !== parent.region) {errors.push('لا يمكن ربط أفراد من عائلتين مختلفتين.');break;}
    if (parentId === p.parentId && parent.gender === 'female') errors.push('حقل الأب يحتاج فردًا مسجلًا بصفة ذكر.');
    if (parentId === p.parentId && parent.birthYear && p.birthYear && Number(parent.birthYear) >= Number(p.birthYear)) errors.push('سنة ميلاد الأب يجب أن تسبق سنة ميلاد الابن أو الابنة.');
    parentId = parent.parentId;
  }
  return [...new Set(errors)];
}
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"','""') + '"';
}
export function getAncestors(person, people) {
  const result = [], seen = new Set([person.id]); let current = person;
  while (current.parentId && !seen.has(current.parentId)) {
    seen.add(current.parentId); current = people.find(p => p.id === current.parentId);
    if (!current) break; result.push(current);
  }
  return result;
}

// Reject mixed namespaces and cyclic/cross-region parent references before any UI rendering.
export function validateImport(bundle) {
  if(bundle?.format !== 'natsha-family-v1' || !bundle.regions) throw Error('صيغة ملف العائلة غير معروفة.');
  for(const region of ['quds','jordan']) {
    const d=bundle.regions[region];
    if(!d || !Array.isArray(d.people) || !Array.isArray(d.branches) || d.people.length>10000) throw Error('بيانات العائلة غير مكتملة.');
    if(d.branches.some(b=>typeof b!=='string')) throw Error('قائمة الفخوذ غير صحيحة.');
    const ids=new Set();
    for(const p of d.people) {
      if(typeof p.id!=='string'||!new RegExp('^'+region+'-[0-9]+$').test(p.id)||p.region!==region||ids.has(p.id)) throw Error('سجل مكرر أو من عائلة أخرى.');
      ids.add(p.id);
      for(const k of ['firstName','fatherName','grandName','branch','gender','life','marital','parentId']) if(typeof p[k]!=='string') throw Error('حقول السجل غير صحيحة.');
      for(const v of Object.values(p)) if(v!==null && !['string','number','boolean'].includes(typeof v)) throw Error('قيمة غير صالحة في السجل.');
      if(!d.branches.includes(p.branch)) throw Error('فخذ غير مسجل.');
      if(!['male','female','unknown'].includes(p.gender)||!['alive','deceased','unknown'].includes(p.life)||!['single','married','divorced','widowed','unknown'].includes(p.marital)) throw Error('حالة غير صالحة في السجل.');
    }
    const byId=new Map(d.people.map(p=>[p.id,p]));
    for(const p of d.people) {
      const seen=new Set([p.id]); let parent=p.parentId;
      while(parent) {
        if(!ids.has(parent)||seen.has(parent)) throw Error('صلة قرابة غير صحيحة أو بين عائلتين.');
        seen.add(parent);parent=byId.get(parent).parentId;
      }
    }
    d.audit=[];d.users=[];
  }
  return bundle;
}
