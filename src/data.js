export const CATALOG = [
  { slug:'zhkh',         emoji:'🚰', title:'ЖКХ и коммуналка',         subtitle:'вода, тепло, свет, мусор, плата',
    position:'Начальник Управления ЖКХ и экологии' },
  { slug:'dorogi',       emoji:'🛣️', title:'Дороги и благоустройство',  subtitle:'дороги, транспорт, дворы, освещение',
    position:'Заместитель главы по строительству, дорожной инфраструктуре, благоустройству, транспорту и связи' },
  { slug:'imushchestvo', emoji:'🏗️', title:'Земля, имущество, архитектура', subtitle:'аренда, участки, разрешения на стройку',
    position:'Председатель Комитета по управлению имуществом' },
  { slug:'obrazovanie',  emoji:'🎓', title:'Образование',               subtitle:'школы, детские сады',
    position:'Начальник Управления образования' },
  { slug:'kultura',      emoji:'🎭', title:'Культура',                  subtitle:'дома культуры, мероприятия',
    position:'Начальник Управления культуры' },
  { slug:'sport',        emoji:'⚽', title:'Спорт и физкультура',        subtitle:'секции, площадки, соревнования',
    position:'Начальник Управления физической культуры и спорта' },
  { slug:'soczashchita', emoji:'👪', title:'Соцзащита и семья',          subtitle:'поддержка, льготы, несовершеннолетние',
    position:'Заместитель главы по образованию, культуре, физической культуре, спорту и социальному развитию' },
  { slug:'bezopasnost',  emoji:'🛡️', title:'Безопасность и порядок',    subtitle:'ЧС, общественный порядок',
    position:'Заместитель главы по безопасности' },
  { slug:'biznes',       emoji:'🏪', title:'Бизнес и торговля',          subtitle:'торговля, реклама, туризм, сельское хозяйство',
    position:'Заместитель главы по промышленности, инвестициям, потребительскому рынку, сельскому хозяйству, туризму и рекламе' },
  { slug:'drugoe',       emoji:'❓', title:'Не знаю / другой вопрос',   subtitle:'обращения и общие вопросы',
    position:'Заместитель главы по территориальной политике и общественным связям' },
];

export function seedCatalog(db) {
  const existing = db.prepare('SELECT COUNT(*) c FROM topics').get().c;
  if (existing > 0) return;
  const insOff = db.prepare('INSERT INTO officials(full_name, position) VALUES(?,?)');
  const insTop = db.prepare('INSERT INTO topics(slug,emoji,title,subtitle,official_id,sort_order) VALUES(?,?,?,?,?,?)');
  const tx = db.transaction(() => {
    CATALOG.forEach((c, i) => {
      const off = insOff.run('— (ФИО уточняется)', c.position);
      insTop.run(c.slug, c.emoji, c.title, c.subtitle, off.lastInsertRowid, i);
    });
  });
  tx();
}
