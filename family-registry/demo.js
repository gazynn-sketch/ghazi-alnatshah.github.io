// All records below are fictional, generated only to demonstrate the interface.
// No original website records, telephone numbers or credentials are copied.
export function createDemo() {
  const branches = ['الفرع التجريبي الأول','الفرع التجريبي الثاني','الفرع التجريبي الثالث','الفرع التجريبي الرابع'];
  const firstNames = ['سليم','عادل','مريم','كريم','ليلى','ياسر','نور','سامر','هالة','زياد','دانا','أنس'];
  const professions = ['مهندس مدني','معلمة','طبيب','مصممة','محاسب','طالب جامعي'];
  const people = [];
  for (let b=0;b<4;b++) {
    const root = `demo-${b}-0`;
    for(let i=0;i<6;i++) {
      people.push({id:`demo-${b}-${i}`,firstName:firstNames[(b*3+i)%12],fatherName:i ? firstNames[b*3%12] : 'نموذج',grandName:'تجريبي',branch:branches[b],gender:i===2||i===4?'female':'male',birthYear: i===0?1940+b:1968+i*5+b,deathYear:i===0?2018:'',life:i===0?'deceased':'alive',marital:i<4?'married':'single',parentId:i?root:'',city:['عمّان','الخليل','القدس','الزرقاء'][(b+i)%4],profession:professions[(i+b)%6],education:i===0?'': 'بكالوريوس',phone:'',email:'',notes:'سجل تجريبي لتوضيح التصميم، لا يمثل شخصًا حقيقيًا.',version:1,archived:0,updatedAt:new Date(Date.now()-(i+b)*86400000).toISOString()});
    }
  }
  return {people, branches, audit:[], users:[]};
}
