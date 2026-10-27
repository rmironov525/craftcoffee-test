/* Корзина UCC: хранится в браузере покупателя, заказ уходит через api/order.php в Telegram-группу. */
(function () {
  var WA_PHONE = '77717711161';          // WhatsApp для связи и запасной отправки заказа, без +
  var ORDER_URL = '/api/order.php';       // скрипт на хостинге, пересылает заказ в Telegram-группу
  var FREE_FROM = 5000;
  var KEY = 'ucc_cart_v1';

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function total(c) { return c.reduce(function (s, i) { return s + i.price * i.qty; }, 0); }
  function count(c) { return c.reduce(function (s, i) { return s + i.qty; }, 0); }

  var cart = load();
  var drawer = document.getElementById('cart');
  var list = document.getElementById('cart-list');
  var sumEl = document.getElementById('cart-total');
  var deliveryEl = document.getElementById('cart-delivery');
  var form = document.getElementById('cart-form');
  var note = document.getElementById('cart-note');
  var emptyEl = document.getElementById('cart-empty');
  var doneEl = document.getElementById('cart-done');
  var fullEl = document.getElementById('cart-full');
  var lastFocus = null;

  function badge() {
    var n = count(cart);
    document.querySelectorAll('[data-cart-count]').forEach(function (b) { b.textContent = n; b.hidden = n === 0; });
  }

  function render() {
    badge();
    if (!drawer) return;
    if (cart.length) doneEl.hidden = true;
    emptyEl.hidden = cart.length > 0 || !doneEl.hidden;
    fullEl.hidden = cart.length === 0;
    list.innerHTML = '';
    cart.forEach(function (i, idx) {
      var li = document.createElement('li');
      li.className = 'ci';
      li.innerHTML =
        '<img src="' + i.img + '" alt="" width="64" height="64">' +
        '<div class="ci-body"><p class="ci-name"></p><p class="ci-meta"></p>' +
        '<div class="ci-row"><div class="qty qty-sm"><button type="button" data-d="-1" aria-label="Меньше">−</button><output>' + i.qty + '</output><button type="button" data-d="1" aria-label="Больше">+</button></div>' +
        '<b>' + fmt(i.price * i.qty) + ' тг</b></div></div>' +
        '<button type="button" class="ci-del" aria-label="Удалить">×</button>';
      li.querySelector('.ci-name').textContent = i.name;
      li.querySelector('.ci-meta').textContent = i.w + ' · ' + fmt(i.price) + ' тг';
      li.querySelectorAll('.qty button').forEach(function (b) {
        b.addEventListener('click', function () {
          i.qty = Math.max(1, Math.min(50, i.qty + Number(b.dataset.d)));
          save(cart); render();
        });
      });
      li.querySelector('.ci-del').addEventListener('click', function () {
        cart.splice(idx, 1); save(cart); render();
      });
      list.appendChild(li);
    });
    var t = total(cart);
    sumEl.textContent = fmt(t) + ' тг';
    deliveryEl.textContent = t >= FREE_FROM
      ? 'Доставка по Алматы бесплатная (в пределах Рыскулова, Саина, Аль-Фараби, ВОАД).'
      : 'До бесплатной доставки не хватает ' + fmt(FREE_FROM - t) + ' тг. Иначе стоимость доставки сообщим.';
  }

  function open() {
    if (!drawer) return;
    lastFocus = document.activeElement;
    drawer.hidden = false;
    document.body.classList.add('no-scroll');
    note.textContent = '';
    render();
    drawer.querySelector('.drawer-close').focus();
  }
  function close() {
    drawer.hidden = true;
    doneEl.hidden = true;
    document.body.classList.remove('no-scroll');
    if (lastFocus) lastFocus.focus();
  }

  function add(item) {
    try { item.img = new URL(item.img, location.href).href; } catch (e) {}
    var found = cart.filter(function (i) { return i.slug === item.slug && i.w === item.w; })[0];
    if (found) found.qty = Math.min(50, found.qty + item.qty);
    else cart.push(item);
    save(cart); render(); open();
  }

  function message() {
    var d = new FormData(form);
    var lines = ['Здравствуйте! Заказ с сайта craftcoffee.kz:', ''];
    cart.forEach(function (i, n) {
      lines.push((n + 1) + '. ' + i.name + ', ' + i.w + ' × ' + i.qty + ' = ' + fmt(i.price * i.qty) + ' тг');
    });
    var t = total(cart);
    lines.push('', 'Итого: ' + fmt(t) + ' тг' + (t >= FREE_FROM ? ' (доставка бесплатная)' : ' + доставка'));
    lines.push('', 'Имя: ' + d.get('name'), 'Телефон: ' + d.get('phone'), 'Адрес доставки: ' + d.get('address'));
    if ((d.get('comment') || '').trim()) lines.push('Комментарий: ' + d.get('comment'));
    return lines.join('\n');
  }

  function valid() {
    if (form.reportValidity()) return true;
    note.textContent = 'Заполните имя, телефон и адрес.';
    return false;
  }

  // Кнопки «+» в карточках каталога: добавляют 250 г
  document.querySelectorAll('[data-add]').forEach(function (b) {
    b.addEventListener('click', function () {
      add({ slug: b.dataset.slug, name: b.dataset.name, w: b.dataset.w, price: Number(b.dataset.price), img: b.dataset.img, qty: 1 });
    });
  });

  // Страница сорта: фасовка + количество
  var pf = document.querySelector('.order');
  if (pf) {
    var q = 1, out = pf.querySelector('output'), tot = pf.querySelector('.total'), photo = document.getElementById('photo');
    var thumbs = document.querySelectorAll('[data-thumb]'), view = 'bag';
    var show = function () {
      var w = pf.querySelector('input[name=w]:checked');
      var t = document.querySelector('[data-thumb=' + view + ']');
      var src = view === 'bag' ? w.dataset.img : t.dataset.img;
      var kind = view === 'bag' ? w.dataset.kind : t.dataset.kind;
      var alt = pf.dataset.name + (view === 'label' ? ', этикетка' : ', пакет ' + w.value);
      if (photo.getAttribute('src') !== src) { photo.src = src; photo.alt = alt; }
      photo.className = 'is-' + kind;
      thumbs.forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.thumb === view)); });
    };
    var upd = function () {
      var w = pf.querySelector('input[name=w]:checked');
      out.textContent = q; tot.textContent = fmt(w.dataset.price * q) + ' тг';
      var bagThumb = document.querySelector('[data-thumb=bag] img');
      if (bagThumb) bagThumb.src = w.dataset.img;
      show();
    };
    // Фото пакета / этикетка / доп. фото
    thumbs.forEach(function (t) { t.addEventListener('click', function () { view = t.dataset.thumb; show(); }); });
    pf.addEventListener('change', function () { view = 'bag'; upd(); });
    pf.querySelectorAll('.buy .qty button').forEach(function (b) {
      b.addEventListener('click', function () { q = Math.max(1, Math.min(50, q + Number(b.dataset.d))); upd(); });
    });
    pf.addEventListener('submit', function (e) {
      e.preventDefault();
      var w = pf.querySelector('input[name=w]:checked');
      add({ slug: pf.dataset.slug, name: pf.dataset.name, w: w.value, price: Number(w.dataset.price), img: w.dataset.cart || w.dataset.img, qty: q });
    });
    upd();
  }

  document.querySelectorAll('[data-cart-open]').forEach(function (b) { b.addEventListener('click', open); });
  if (drawer) {
    drawer.querySelectorAll('[data-cart-close]').forEach(function (b) { b.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !drawer.hidden) close(); });
    var submitBtn = document.getElementById('cart-submit');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!valid()) return;
      var d = new FormData(form);
      var body = {
        items: cart.map(function (i) { return { slug: i.slug, w: i.w, qty: i.qty }; }),
        name: d.get('name'), phone: d.get('phone'), address: d.get('address'),
        comment: d.get('comment'), website: d.get('website')
      };
      submitBtn.disabled = true;
      note.textContent = 'Отправляем заказ…';
      fetch(ORDER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
        .then(function (res) {
          if (!res.j.ok) throw res;
          cart = []; save(cart); render();
          fullEl.hidden = true; emptyEl.hidden = true; doneEl.hidden = false;
          document.getElementById('cart-done-title').textContent = 'Заказ №' + res.j.id + ' принят';
          form.reset(); note.textContent = '';
        })
        .catch(function (err) {
          var wa = 'https://wa.me/' + WA_PHONE + '?text=' + encodeURIComponent(message());
          var why = err && err.status === 429 ? 'Слишком много заказов подряд. ' : (err && err.j && err.j.error === 'fields' ? 'Проверьте имя, телефон и адрес. ' : 'Не получилось отправить заказ. ');
          note.innerHTML = '';
          note.appendChild(document.createTextNode(why));
          var a = document.createElement('a'); a.href = wa; a.target = '_blank'; a.rel = 'noopener';
          a.textContent = 'Отправить этот заказ в WhatsApp';
          note.appendChild(a);
        })
        .then(function () { submitBtn.disabled = false; });
    });
    document.getElementById('cart-clear').addEventListener('click', function () {
      cart = []; save(cart); render();
    });
  }
  render();
})();
