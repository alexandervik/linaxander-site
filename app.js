/* Линаксандер · поведение страницы
   Дождь, карта с городами, появление блоков, форма подписки.
   Скрипт ждёт разметку: блок кода на странице Squarespace
   может отрисоваться позже самого скрипта. */
(function boot(attempt){
  attempt = attempt || 0;
  if (document.readyState === 'loading'){
    return document.addEventListener('DOMContentLoaded', function(){ boot(0); }, {once:true});
  }
  // на разных страницах свой набор блоков — ждём любой из знакомых
  var ready = document.getElementById('rain') || document.getElementById('map') ||
              document.getElementById('subForm') || document.querySelector('.reveal');
  if (!ready && attempt < 40) return setTimeout(function(){ boot(attempt + 1); }, 100);
  lxInit();
})();

function lxInit(){
'use strict';
var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ══════════════════════════════════════════════════════════
   1. ДОЖДЬ
   Полноэкранный canvas: тонкие косые штрихи цвета бумаги,
   изредка — золотые. Плотность считается от площади окна.
   ══════════════════════════════════════════════════════════ */
(function rain(){
  var cv = document.getElementById('rain');
  if (!cv) return;                       // на странице отрывка дождя нет
  var ctx = cv.getContext('2d');
  var W = 0, H = 0, dpr = 1, drops = [], raf = null;

  function seed(d, first){
    d.x = Math.random() * (W + 260) - 130;
    d.y = first ? Math.random() * H : -Math.random() * H * 0.35;
    d.len = 12 + Math.random() * 46;          // длина штриха
    d.v = 5.5 + Math.random() * 11;           // скорость падения
    d.w = 0.5 + Math.random() * 0.9;
    d.a = 0.05 + Math.random() * 0.22;
    d.gold = Math.random() < 0.16;            // редкая тёплая нота
    return d;
  }

  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var want = Math.round(Math.min(300, Math.max(90, (W * H) / 5200)));
    if (drops.length > want) drops.length = want;
    while (drops.length < want) drops.push(seed({}, true));
  }

  var SLANT = 0.19; // ветер: сдвиг по X на единицу длины

  function frame(){
    /* если окно успело измениться (в т.ч. загрузка в скрытой вкладке,
       где на старте 0 × 0) — пересобираем холст, не дожидаясь события */
    if (W !== window.innerWidth || H !== window.innerHeight) resize();

    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    for (var i = 0; i < drops.length; i++){
      var d = drops[i];
      ctx.beginPath();
      ctx.lineWidth = d.w;
      ctx.strokeStyle = d.gold
        ? 'rgba(226,180,102,' + (d.a * 0.9) + ')'
        : 'rgba(232,223,200,' + d.a + ')';
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + d.len * SLANT, d.y + d.len);
      ctx.stroke();

      if (!REDUCED){
        d.y += d.v;
        d.x += d.v * SLANT;
        if (d.y - d.len > H) seed(d, false);
      }
    }
    if (!REDUCED) raf = requestAnimationFrame(frame);
  }

  window.addEventListener('resize', function(){
    resize();
    if (REDUCED) frame();   /* без анимации перерисовываем вручную */
  }, {passive:true});
  document.addEventListener('visibilitychange', function(){
    if (REDUCED) return;
    if (document.hidden){ cancelAnimationFrame(raf); raf = null; }
    else if (!raf) raf = requestAnimationFrame(frame);
  });

  resize();
  frame();
})();

/* ══════════════════════════════════════════════════════════
   2. КАРТА ЕВРОПЫ
   Подложка — присланный рельеф (1024 × 1024). Координаты городов
   привязаны к нему заранее: проекция картинки восстановлена по
   эталонной береговой линии, затем уточнена локально — проверено
   по стыкам государственных границ на самой картинке.
   Слой точек и картинка делят одну систему координат, поэтому
   метки держатся мест при любой ширине блока.
   ══════════════════════════════════════════════════════════ */
(function europe(){
  var VB = 1024;                     // сторона исходной картинки

  var CITIES = [
    { id:'msk', name:'Москва',     x:872.7, y:311.3, act:'// Часть I · ДО', photo:'var(--photo-msk)', focus:'50% 62%',
      geo:'55°45′ с.ш. · 37°37′ в.д. · двор',
      q:'«Москва обсыхала после дождя. Стряхивала с себя капли. По-кошачьи вытягивала под солнце спину Андреевского моста.»',
      note:'Бытовой гротеск.',
      dir:1, nudge:5 },
    { id:'ams', name:'Амстердам',  x:417.2, y:467.7, act:'// Часть III · МИ', photo:'var(--photo-ams)', focus:'50% 54%',
      geo:'52°22′ с.ш. · 4°54′ в.д. · вода',
      q:'«Он выныривал, затягивал воздух, толкал его ниже, в легкие, поднимал Лейку на уровень глаз и барахтался.»',
      note:'Слом.',
      dir:-1, nudge:-8 },
    { id:'sth', name:'Стокгольм',  x:599.2, y:318.3, act:'// Часть IV · ФА', photo:'var(--photo-sth)', focus:'50% 56%',
      geo:'59°20′ с.ш. · 18°04′ в.д. · провода',
      q:'«Звуком сломанной ветки щелкнул таймер, размытые шарики гирлянды на террасе качнулись, стали в ряд.»',
      note:'Чужой праздник.',
      dir:-1, nudge:-6 },
    { id:'wrs', name:'Варшава',    x:676.0, y:453.0, act:'// Часть II · РЕ', photo:'var(--photo-wrs)', focus:'50% 60%',
      geo:'52°14′ с.ш. · 21°01′ в.д. · вокзал',
      q:'«Она обняла его бережно. Положив ладонь на спину, между лопаток.»',
      note:'Выдох.',
      dir:1, nudge:16 }
  ];

  var NS = 'http://www.w3.org/2000/svg';
  function el(n, attrs){
    var e = document.createElementNS(NS, n);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  var svg = document.getElementById('map');
  if (!svg) return;                      // карта есть только на главной
  svg.setAttribute('viewBox', '0 0 ' + VB + ' ' + VB);

  /* — маршрут: Москва → Варшава → Амстердам → Стокгольм — */
  var order = ['msk','wrs','ams','sth'];
  var pts = order.map(function(id){
    var c = CITIES.filter(function(x){ return x.id === id; })[0];
    return [c.x, c.y];
  });
  var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
  for (var i = 1; i < pts.length; i++){
    var a = pts[i-1], b = pts[i];
    var mx = (a[0]+b[0])/2, my = (a[1]+b[1])/2;
    var nx = -(b[1]-a[1]), ny = (b[0]-a[0]);        // перпендикуляр к хорде
    var L = Math.hypot(nx, ny) || 1;
    d += 'Q' + (mx + nx/L*27).toFixed(1) + ' ' + (my + ny/L*27).toFixed(1) +
         ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
  }
  svg.appendChild(el('path', {class:'route', d:d}));

  /* — города — */
  var panel  = document.getElementById('mapPanel');
  var stage  = document.getElementById('mapStage');
  var canvas = document.getElementById('mapCanvas');
  var f = {
    act: document.getElementById('mpAct'),  city: document.getElementById('mpCity'),
    geo: document.getElementById('mpGeo'),  q: document.getElementById('mpQuote'),
    note: document.getElementById('mpNote')
  };
  var bg = document.getElementById('mpBg');
  var hint = document.getElementById('mpHint');
  var nodes = [];
  var DEFAULT_ID = 'msk';          // с этим городом страница открывается

  /* в подсказке перечисляем те города, что сейчас не показаны */
  function fillHint(activeId){
    var rest = CITIES.filter(function(c){ return c.id !== activeId; })
                     .map(function(c){ return c.name; });
    hint.innerHTML = rest.join('<br>') + '<br><br>— наведите на точку —';
  }

  function show(c, node, dim){
    f.act.textContent = c.act;
    f.city.textContent = c.name;
    f.geo.textContent = c.geo;
    f.q.textContent = c.q;
    f.note.textContent = c.note;
    bg.style.backgroundImage = c.photo || 'none';
    bg.style.backgroundPosition = c.focus || '50% 60%';
    panel.classList.toggle('has-photo', !!c.photo);
    panel.classList.add('on');
    stage.classList.toggle('hot', dim !== false);   // при загрузке не гасим соседей
    nodes.forEach(function(n){ n.classList.toggle('on', n === node); });
    fillHint(c.id);
  }
  /* уводя мышь, возвращаемся к городу по умолчанию, а не в пустую панель */
  function clear(){
    var i = 0;
    for (var k = 0; k < CITIES.length; k++) if (CITIES[k].id === DEFAULT_ID) i = k;
    show(CITIES[i], nodes[i], false);
  }

  var marks = [];

  CITIES.forEach(function(c){
    var p = [c.x, c.y];
    var g = el('g', {class:'city', tabindex:'0', role:'button',
                     'aria-label':c.name + '. ' + c.q});
    var halo = el('circle', {class:'halo', cx:p[0], cy:p[1]});
    halo.style.animationDelay = (marks.length * 0.85) + 's';   /* пульс вразнобой */
    var ring = el('circle', {class:'ring', cx:p[0], cy:p[1]});
    var dot  = el('circle', {class:'dot',  cx:p[0], cy:p[1]});
    var lbl  = el('text',   {class:'lbl',  'text-anchor':c.dir > 0 ? 'start' : 'end'});
    var sub  = el('text',   {class:'sub',  'text-anchor':c.dir > 0 ? 'start' : 'end'});
    var hit  = el('circle', {cx:p[0], cy:p[1], fill:'transparent'});  /* зона наведения */

    lbl.textContent = c.name.toUpperCase();
    sub.textContent = c.act.replace('// ', '').split(' · ')[0];
    [halo, ring, dot, lbl, sub, hit].forEach(function(n){ g.appendChild(n); });

    g.addEventListener('mouseenter', function(){ show(c, g); });
    g.addEventListener('focus',      function(){ show(c, g); });
    g.addEventListener('click',      function(){ show(c, g); });
    g.addEventListener('blur',       clear);
    nodes.push(g);
    marks.push({c:c, p:p, halo:halo, ring:ring, dot:dot, lbl:lbl, sub:sub, hit:hit});
    svg.appendChild(g);
  });

  /* Точки и подписи задаются в единицах viewBox, а карта тянется по ширине.
     Пересчитываем их так, чтобы на экране они всегда были одного размера. */
  function layout(){
    /* ширину берём у холста, а не у <svg>: у него она на момент запуска
       скрипта ещё не разрешена в 100% и даёт заниженное значение */
    var w = canvas.clientWidth;
    if (!(w > 0)) return;
    var k = VB / w;                         // единиц viewBox в одном пикселе

    /* подписи могут заходить в поля контейнера — у svg overflow: visible */
    var cs = getComputedStyle(stage);
    var minX = -Math.max(parseFloat(cs.paddingLeft) - 6, 0) * k;
    var maxX = VB + Math.max(parseFloat(cs.paddingRight) - 6, 0) * k;

    function place(m, dir){
      var x = m.p[0] + dir * 19 * k;
      var y = m.p[1] + m.c.nudge * k;
      var anchor = dir > 0 ? 'start' : 'end';
      m.lbl.setAttribute('x', x); m.lbl.setAttribute('y', y);
      m.lbl.setAttribute('text-anchor', anchor);
      m.sub.setAttribute('x', x); m.sub.setAttribute('y', y + 15 * k);
      m.sub.setAttribute('text-anchor', anchor);
    }

    marks.forEach(function(m){
      m.halo.setAttribute('r', 26 * k);
      m.ring.setAttribute('r', 11 * k);
      m.dot .setAttribute('r', 3.8 * k);
      m.hit .setAttribute('r', 30 * k);
      m.lbl.setAttribute('font-size', 13.5 * k);
      m.sub.setAttribute('font-size', 10 * k);
      m.lbl.setAttribute('stroke-width', 3 * k);    // тёмная подложка под текстом
      m.sub.setAttribute('stroke-width', 2.4 * k);

      /* на узкой карте подпись перестаёт помещаться со своей стороны —
         тогда разворачиваем её на другую сторону точки */
      place(m, m.c.dir);
      var b = m.lbl.getBBox();
      if (b.width && (b.x < minX || b.x + b.width > maxX)) place(m, -m.c.dir);
    });
  }

  /* открываем страницу с уже показанной Москвой */
  clear();
  setTimeout(function(){ hint.classList.add('in'); }, 900);

  layout();
  /* наблюдаем за контейнером, а не за самим <svg>: на SVG-элементе
     ResizeObserver срабатывает не во всех браузерах */
  if (window.ResizeObserver) new ResizeObserver(layout).observe(canvas);
  window.addEventListener('resize', layout, {passive:true});
  window.addEventListener('load', layout);
  requestAnimationFrame(layout);
  /* таймеры на случай, если страница открыта в фоне: там кадры и
     ResizeObserver не доставляются, а первый замер может быть ранним */
  setTimeout(layout, 0);
  setTimeout(layout, 400);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

  stage.addEventListener('mouseleave', clear);
})();

/* ══════════════════════════════════════════════════════════
   3. ПОЯВЛЕНИЕ БЛОКОВ, ШАПКА, НАВИГАЦИЯ
   ══════════════════════════════════════════════════════════ */
(function chrome(){
  var io = new IntersectionObserver(function(es){
    es.forEach(function(e){
      if (e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, {threshold:0.12, rootMargin:'0px 0px -8% 0px'});
  document.querySelectorAll('.reveal').forEach(function(n){ io.observe(n); });

  var nav = document.getElementById('nav');
  var links = [].slice.call(document.querySelectorAll('.nav-links a'));
  var secs = links.map(function(a){ return document.querySelector(a.getAttribute('href')); });

  function onScroll(){
    nav.classList.toggle('stuck', window.scrollY > 40);
    var y = window.scrollY + window.innerHeight * 0.34, cur = -1;
    secs.forEach(function(s, i){ if (s && s.offsetTop <= y) cur = i; });
    links.forEach(function(a, i){ a.classList.toggle('active', i === cur); });
  }
  var tick = false;
  window.addEventListener('scroll', function(){
    if (tick) return;
    tick = true;
    requestAnimationFrame(function(){ onScroll(); tick = false; });
  }, {passive:true});
  onScroll();
})();

/* ══════════════════════════════════════════════════════════
   4. ПОДПИСКА — без сети, подтверждение на месте
   ══════════════════════════════════════════════════════════ */
var subForm = document.getElementById('subForm');
if (subForm) subForm.addEventListener('submit', function(e){
  e.preventDefault();
  var mail = document.getElementById('subMail');
  var done = document.getElementById('subDone');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail.value)){
    mail.style.borderColor = '#8a5a2a';
    mail.focus();
    return;
  }
  mail.style.borderColor = '';
  mail.value = '';
  mail.blur();
  done.classList.add('on');
});
}
