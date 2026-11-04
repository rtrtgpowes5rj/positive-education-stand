export const utm='?utm_source=stand&utm_medium=qr&utm_campaign=education_stand';
const E='https://edu-pt.ru/';

export const catalogs={
 pros:{title:'Профессиональные программы',note:'Практикумы, интенсивы и спринты для специалистов и руководителей',url:E+'for_pros'+utm,short:'edu-pt.ru/for_pros'},
 products:{title:'Курсы по эксплуатации продуктов',note:'PT NGFW, PT NAD, MaxPatrol SIEM и VM, EDR, PT Sandbox, PT AF PRO',url:E+'kursy-po-ekspluatacii-productov-pt'+utm,short:'edu-pt.ru/kursy-po-ekspluatacii-productov-pt'}
};

// Программы из презентации «Программы обучения»
export const programs={
 base:{name:'Основы практической кибербезопасности',kind:'Интенсив',path:'cybersecurity-fundamentals'},
 net:{name:'Архитектура сетевой безопасности',kind:'Практикум',path:'network_security_architecture'},
 nta:{name:'Анализ сетевого трафика: искусство обнаружения атак',kind:'Практикум',path:'nta_course'},
 vm:{name:'Управление уязвимостями: от теории к практике',kind:'Практикум',path:'vm'},
 soc:{name:'Мониторинг и реагирование на инциденты',kind:'Практикум',path:'monitoring-i-reagirovanie'},
 soc2:{name:'Построение SOC 2.0: от концепции до реализации',kind:'Практикум',path:'building_soc'},
 hard:{name:'Харденинг ИТ-инфраструктуры: от дизайна до настроек',kind:'Практикум',path:'hardening_it_structure'},
 ot:{name:'Предотвращение атак на АСУ ТП',kind:'Практикум',path:'attacks_on_apcs'},
 appsec:{name:'Безопасность приложений: курс для инженеров',kind:'Практикум',path:'appsec_pro'},
 appsecLead:{name:'Безопасность приложений: спринт для тим-лидов и руководителей',kind:'Спринт',path:'appsec'},
 ai:{name:'Безопасная разработка с ИИ-агентами',kind:'Спринт',path:'ai-agents'},
 awareness:{name:'Культура кибербезопасности для ваших сотрудников',kind:'Awareness',path:'awareness'},

 // Планы 2027 (бэклог roadmap_courses): без ссылок и QR до анонса
 ethical:{name:'Этичный хакинг: реализация полного цикла атаки',kind:'Интенсив',plan:true},
 intSiem:{name:'Анализ событий безопасности с помощью SIEM',kind:'Интенсив',plan:true},
 intNta:{name:'Анализ сетевых атак с помощью NTA',kind:'Интенсив',plan:true},
 intWaf:{name:'Анализ кибератак на веб-приложения с помощью WAF',kind:'Интенсив',plan:true},
 intSast:{name:'Применение SAST: поиск и устранение веб-уязвимостей',kind:'Интенсив',plan:true},
 aiSecops:{name:'AI-технологии для Security Operations',kind:'Спринт',plan:true},
 llmSec:{name:'Безопасность LLM: атаки и защита',kind:'Спринт',plan:true},
 aiCyber:{name:'Применение LLM и AI в кибербезопасности',kind:'Спринт',plan:true},
 ciso:{name:'Программа для CISO',kind:'Для руководителей',plan:true},
 // Курсы по эксплуатации продуктов
 ngfw:{name:'Миграция на PT NGFW: полное руководство',kind:'Продукт',path:'kursy-po-ekspluatacii-productov-pt/pt-ngfw'},
 af:{name:'Защита веб-приложений на базе PT AF PRO',kind:'Продукт',path:'kursy-po-ekspluatacii-productov-pt/pt-af-pro'},
 nad:{name:'Обнаружение кибератак в трафике при помощи PT NAD',kind:'Продукт',path:'kursy-po-ekspluatacii-productov-pt/pt-nad'},
 siem:{name:'MaxPatrol SIEM: от настройки до расследования инцидентов',kind:'Продукт',path:'kursy-po-ekspluatacii-productov-pt/mp-siem'},
 sandbox:{name:'Возможности PT Sandbox: от настройки до интеграций',kind:'Продукт',path:'kursy-po-ekspluatacii-productov-pt/pt-sandbox'},
 edr:{name:'Эффективная защита конечных устройств с MaxPatrol EDR',kind:'Продукт',path:'kursy-po-ekspluatacii-productov-pt/mp-edr'},
 mpvm:{name:'Применение MaxPatrol VM в процессе управления уязвимостями',kind:'Продукт',path:'kursy-po-ekspluatacii-productov-pt/mp-vm'}
};
for(const p of Object.values(programs)){if(p.plan)continue;p.url=E+p.path+utm;p.short='edu-pt.ru/'+p.path}

export const people={
 igor:{name:'Игорь Павлов',role:'сетевой архитектор',ini:'ИП'},
 artem:{name:'Артём Крылов',role:'администратор систем',ini:'АК'},
 marina:{name:'Марина Левина',role:'SOC · дежурная смена',ini:'МЛ'},
 dima:{name:'Дмитрий Орлов',role:'тимлид разработки',ini:'ДО'}
};

// Пять уровней. programs — какие программы витрины стоят за навыком
export const levels=[
 {id:'perimeter',code:'01',name:'Периметр',title:'Расставьте защиту по сети',who:'igor',
  how:'Перетаскивайте средства защиты из панели на красные круги схемы.',
  hints:["Начни с границы: первое, что видит атакующий, — шлюз.", "Сканирование портов останавливает межсетевой экран (NGFW).", "Веб-запросы к порталу разбирает WAF, а вложения писем проверяет Sandbox."],
  chat:['С утра на границе сканируют порты, а в логах портала странные запросы.','Ставь средства защиты на свои участки. Каждое гасит свой класс атак — увидишь по пакетам.'],
  goals:['Закрыть границу с интернетом','Защитить портал и почту','Видеть трафик внутри сети','Закрыть рабочие станции и SOC'],
  cheat:{title:'Кто за что отвечает',items:[['NGFW','фильтрует соединения на границе'],['WAF','разбирает HTTP-запросы к порталу'],['Sandbox','запускает вложения в изоляции'],['NTA','видит трафик внутри сети'],['EDR','следит за процессами на хостах'],['SIEM','собирает события со всех систем']]},
  programs:['base','net','ngfw','af','sandbox']},
 {id:'hardening',code:'02',name:'Харденинг',title:'Настройте безопасные конфигурации',who:'artem',
  how:'Нажимайте на строки конфигов, чтобы заменить их безопасными, затем запустите проверку.',
  hints:["Ищи строки, где пароль или сессия идут открытым текстом или включена устаревшая версия.", "Опасны: вход под root, вход по паролю, TLS 1.0/1.1, SNMPv2 на запись, Telnet.", "Трогать нельзя две строки: порт портала 443 и отправку логов в SIEM."],
  chat:['Завтра проверка. В трёх конфигах пять опасных настроек.','Но две из «странных» строк держат сервис. Тронешь их — портал ляжет.'],
  goals:['Закрыть опасные настройки','Не сломать портал','Не ослепить SIEM'],
  cheat:{title:'Как думать',items:[['Лишнее','всё, что не нужно сервису, — поверхность атаки'],['Открытый текст','пароли и сессии должны идти по шифрованным каналам'],['Устаревшее','старые версии протоколов — первые кандидаты'],['Проверка','нужную сервису строку тронете — сканер это покажет']]},
  programs:['hard','vm','mpvm']},
 {id:'traffic',code:'03',name:'Трафик',title:'Найдите аномалию в потоке',who:'marina',
  how:'Выбирайте потоки в списке, смотрите инспектор и помечайте подозрительные.',
  hints:["Сравни ритм: человек работает всплесками, а программа — строго по таймеру.", "Один поток шлёт одинаковые ответы каждые 30 секунд на внешний адрес.", "Второй — сотни уникальных длинных имён в DNS с TXT-ответами."],
  chat:['NAD собрал шесть сессий за десять минут.','Два из них — не те, кем кажутся. Смотри на ритм, размер и имена.'],
  goals:['Найти канал управления','Найти утечку через DNS','Не обвинить безобидное'],
  cheat:{title:'На что смотреть',items:[['Ритм','человек — всплесками, программа — по таймеру'],['Размер','одинаковые ответы подозрительны'],['Имена','длинные случайные поддомены — не норма'],['Окно','крупный объём в окне задания — норма']]},
  programs:['nta','nad']},
 {id:'soc',code:'04',name:'Мониторинг',title:'Соберите цепочку инцидента',who:'marina',
  how:'Перетащите событие (или выберите и нажмите на этап) и поставьте его в цепочку.',
  hints:["Хронология такая: перебор пароля, права, кража учётных данных, движение по сети.", "Фоновые события (chrome, SYSTEM, блокировка пользователя) — не атака.", "Все четыре события связаны с buh-07 и учёткой svc_backup."],
  chat:['Хосты из прошлой задачи подсветились в SIEM. Восемь событий, четыре — атака.','Расставь по этапам и реши, как реагировать.'],
  goals:['Собрать цепочку из 4 событий','Выбрать точное реагирование'],
  cheat:{title:'Шпаргалка Windows',items:[['4625','неудачный вход'],['4624','успешный вход'],['4672','назначены спецпривилегии'],['Sysmon 10','доступ к памяти процесса']]},
  programs:['soc','siem','edr']},
 {id:'agent',code:'05',name:'ИИ-агент',title:'Проверьте pull request агента',who:'dima',
  how:'Отмечайте опасные строки diff и выключайте лишние права агента.',
  hints:["Ищи строки, которые что-то скачивают, отправляют наружу или собирают запрос из строки.", "Инструкция для агента, спрятанная в README, — тоже атака.", "Агенту для исправления нужны только чтение репозитория и тесты."],
  chat:['Кодинг-агент прислал исправление экспорта отчётов. Просит права на всё.','Найди, что нельзя мёржить, и урежь ему доступ.'],
  goals:['Отклонить опасные строки','Урезать права агента','Пройти merge-проверку'],
  cheat:{title:'Красные флаги',items:[['Чужой код','скачать из сети и сразу запустить'],['Секреты','переменные окружения уходят наружу'],['SQL','строка запроса собрана из параметра'],['Данные','команды, спрятанные в README и тикетах'],['Права','шире, чем нужно для задачи']]},
  programs:['appsec','ai']}
];
// Витрина: структура и подтверждённые связи «программа → курс по продукту» — из roadmap_courses (docs/ecosystem.md)
export const baseShort={ngfw:'PT NGFW',af:'PT AF PRO',edr:'MaxPatrol EDR',siem:'MaxPatrol SIEM',nad:'PT NAD',sandbox:'PT Sandbox',mpvm:'MaxPatrol VM'};
export const ecosystem={
 rows:[
  {id:'basics',name:'Основы и Red Team',note:'вход в профессию',pro:['base','ethical'],base:[]},
  {id:'network',name:'Сетевая защита и архитектура',note:'Blue Team',pro:['net','hard','intWaf'],base:['ngfw','af','edr']},
  {id:'soc',name:'SOC и расследование',note:'Blue Team',pro:['soc','nta','intSiem','intNta','aiSecops'],base:['siem','nad','sandbox']},
  {id:'vm',name:'Уязвимости и АСУ ТП',note:'',pro:['vm','ot'],base:['mpvm']},
  {id:'appsec',name:'AppSec и ИИ-агенты',note:'Green Team',pro:['appsec','ai','intSast','llmSec','aiCyber'],base:[]},
  {id:'lead',name:'Руководители и сотрудники',note:'',pro:['soc2','appsecLead','awareness','ciso'],base:[]}
 ]
};

// Блиц-вопросы лежат в public/questions.json (см. README). Файл читается при каждом запуске,
// поэтому на стенде его можно править без пересборки. Встроенная копия — на случай, если файл недоступен.
import bundled from '../public/questions.json';
export const blitz={...bundled};
const valid=q=>q&&typeof q.q==='string'&&Array.isArray(q.a)&&q.a.length>=2&&Number.isInteger(q.ok)&&q.ok>=0&&q.ok<q.a.length;
export async function loadQuestions(){
 try{
  const r=await fetch('./questions.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)return;
  const j=await r.json();
  for(const lv of levels){const list=(j[lv.id]||[]).filter(valid);if(list.length)blitz[lv.id]=list}
 }catch(e){}
}

// Бегущая строка на заставке. Записи таблицы рекордов вставляются после третьей строки автоматически
export const ticker=[
 'Центр практического обучения Positive Technologies',
 'Смена инженера ИБ: 5 уровней, около 5 минут',
 'Чем быстрее и точнее — тем больше очков. Лучшие попадают в таблицу рекордов',
 'В финале — рейтинг и рекомендации по развитию',
 'Подойдите к стенду: подберём программу под вашу задачу'
];

export const ranks=[
 [1500,'Легенда полигона'],
 [880,'Архитектор защиты'],
 [700,'Старший инженер ИБ'],
 [500,'Инженер ИБ'],
 [0,'Стажёр полигона']
];
export const rankFor=s=>ranks.find(([min])=>s>=min)[1];

// Пул угроз на схеме сети
export const pool=['боты и сканеры IP-диапазонов','APT-группировки','шифровальщики и вымогатели','фишинг и дипфейк-звонки','атаки на цепочку поставок','ИИ-агенты в роли атакующих','эксплойты нулевого дня'];
