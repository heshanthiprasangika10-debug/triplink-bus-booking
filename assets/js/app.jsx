const { useState, useEffect, useRef, useCallback } = React;
const LangContext = React.createContext(null);
const t = (key, vars) => window.I18N.t(key, vars);
const cityName = (name) => window.I18N.cityName(name);
const busTypeName = (value) => {
  const keys = { Normal: 'bus.normal', 'Semi Luxury': 'bus.semiLuxury', Luxury: 'bus.luxury', 'Super Luxury': 'bus.superLuxury' };
  return keys[value] ? t(keys[value]) : value;
};
const amenityName = (value) => {
  const keys = { AC: 'amenity.ac', WiFi: 'amenity.wifi', Charging: 'amenity.charging', 'Reclining Seats': 'amenity.reclining' };
  return keys[value] ? t(keys[value]) : value;
};

function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => window.I18N.getLanguage());
  const setLang = useCallback((next) => {
    window.I18N.setLanguage(next);
    setLangState(next);
  }, []);
  const value = React.useMemo(() => ({ lang, setLang, t }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}
const useLang = () => React.useContext(LangContext);

/* ================= CONFIG ================= */
const API = 'api/';
// Hero slider images. Replace with your own photos (e.g. 'assets/img/colombo.jpg') — they auto-change every 5s.
const HERO_IMAGES = [
  'assets/img/hero1.svg',
  'assets/img/hero2.svg',
  'assets/img/hero3.svg',
  'assets/img/hero4.svg',
];
const SLIDE_MS = 5000;

/* ================= HELPERS ================= */
const get = async (path) => {
  const r = await fetch(API + path);
  const d = await r.json();
  if (!r.ok) { const e = new Error(d.error || t('common.requestFailed')); e.data = d; e.code = d.code; e.status = r.status; throw e; }
  return d;
};
const post = async (path, body) => {
  const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json();
  if (!r.ok) { const e = new Error(d.error || t('common.requestFailed')); e.data = d; e.code = d.code; e.status = r.status; throw e; }
  return d;
};
const errorMessage = (error) => {
  const key = error && error.data && error.data.code;
  const translationKey = key ? `api.${key}` : '';
  return translationKey && Object.prototype.hasOwnProperty.call(window.I18N.dictionaries.en, translationKey)
    ? t(translationKey, { days: error.data.days })
    : error && error.message ? error.message : t('common.requestFailed');
};
const todayStr = () => {
  const d = new Date(); const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const fmtTime = (time) => {
  const [hours, minutes] = String(time).split(':').map(Number);
  try {
    return new Intl.DateTimeFormat(window.I18N.locale(), { hour: 'numeric', minute: '2-digit' })
      .format(new Date(2000, 0, 1, hours, minutes));
  } catch (error) {
    return `${((hours + 11) % 12) + 1}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
  }
};
const fmtDate = (date) => {
  try {
    return new Intl.DateTimeFormat(window.I18N.locale(), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      .format(new Date(date + 'T00:00:00'));
  } catch (error) {
    return new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
};
const lkr = (amount) => {
  const locale = window.I18N.locale();
  const digits = Number(amount).toLocaleString(locale, { maximumFractionDigits: 0 });
  return `${window.I18N.getLanguage() === 'si' ? 'රු.' : window.I18N.getLanguage() === 'ta' ? 'ரூ.' : 'LKR'} ${digits}`;
};
const duration = (a, b) => {
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  let d = toMin(b) - toMin(a); if (d < 0) d += 1440;
  return t('common.duration', { hours: Math.floor(d / 60), minutes: d % 60 });
};
const durationMinutes = (depart, arrive) => {
  const minutes = (time) => {
    const [hours, mins] = String(time || '').split(':').map(Number);
    return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(mins) ? mins : 0);
  };
  let total = minutes(arrive) - minutes(depart);
  if (total < 0) total += 1440;
  return total;
};
const tripArrivalDateTime = (trip) => {
  const date = new Date(`${trip.depart_date}T00:00:00`);
  if (trip.arrive_time < trip.depart_time) date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day} ${trip.arrive_time}`;
};
const timeBucket = (time) => {
  const [hours, mins] = String(time || '').split(':').map(Number);
  const value = (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(mins) ? mins : 0);
  if (value >= 300 && value < 720) return 'Morning';
  if (value >= 720 && value < 1020) return 'Afternoon';
  if (value >= 1020 && value < 1260) return 'Evening';
  return 'Night';
};
if (new URLSearchParams(window.location.search).get('debug') === 'filters') {
  console.assert(timeBucket('21:30') === 'Night', '21:30 belongs to Night');
  console.assert(timeBucket('02:00') === 'Night', '02:00 belongs to Night');
  console.assert(timeBucket('14:00') === 'Afternoon', '14:00 belongs to Afternoon');
  console.assert(durationMinutes('23:30', '01:00') === 90, 'Overnight duration should wrap past midnight');
}
const comfortRank = { Normal: 1, 'Semi Luxury': 2, Luxury: 3, 'Super Luxury': 4 };
const normalizeAmenity = (value) => {
  const key = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const known = { ac: 'AC', wifi: 'WiFi', charging: 'Charging', 'reclining seats': 'Reclining Seats' };
  return known[key] || String(value || '').trim();
};
const tripAmenities = (trip) => String(trip.amenities || '').split(',').map(normalizeAmenity).filter(Boolean);
const RESULT_FILTER_STORAGE_KEY = 'triplink:results-filters';
const emptyResultFilters = () => ({
  sort: 'earliest',
  preset: '',
  times: [],
  types: [],
  amenities: [],
  minFare: null,
  maxFare: null,
  availableOnly: true,
});
const loadResultFilters = (identity) => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(RESULT_FILTER_STORAGE_KEY) || 'null');
    if (!saved || saved.identity !== identity) return emptyResultFilters();
    const value = saved.filters;
    if (!value || typeof value !== 'object') return emptyResultFilters();
    return {
      ...emptyResultFilters(),
      ...value,
      times: Array.isArray(value.times) ? value.times : [],
      types: Array.isArray(value.types) ? value.types : [],
      amenities: Array.isArray(value.amenities) ? value.amenities : [],
      availableOnly: value.availableOnly !== false,
    };
  } catch (e) {
    return emptyResultFilters();
  }
};
const applyFilters = (trips, filters, priceBounds) => trips.filter((trip) => {
  if (filters.availableOnly && Number(trip.seats_left) <= 0) return false;
  if (filters.times.length && !filters.times.includes(timeBucket(trip.depart_time))) return false;
  if (filters.types.length && !filters.types.includes(trip.bus_type)) return false;
  const amenities = tripAmenities(trip).map((value) => value.toLowerCase());
  if (filters.amenities.some((value) => !amenities.includes(value.toLowerCase()))) return false;
  const fare = Number(trip.fare);
  const minFare = filters.minFare == null ? priceBounds.min : Number(filters.minFare);
  const maxFare = filters.maxFare == null ? priceBounds.max : Number(filters.maxFare);
  return fare >= minFare && fare <= maxFare;
});
const applySort = (trips, sort) => {
  const comfort = (trip) => comfortRank[trip.bus_type] || 0;
  const comparators = {
    earliest: (a, b) => String(a.depart_time).localeCompare(String(b.depart_time)),
    cheapest: (a, b) => Number(a.fare) - Number(b.fare),
    fastest: (a, b) => durationMinutes(a.depart_time, a.arrive_time) - durationMinutes(b.depart_time, b.arrive_time),
    latest: (a, b) => String(b.depart_time).localeCompare(String(a.depart_time)),
    seats: (a, b) => Number(b.seats_left) - Number(a.seats_left),
    comfort: (a, b) => comfort(b) - comfort(a) || Number(a.fare) - Number(b.fare),
  };
  const compare = comparators[sort] || comparators.earliest;
  return trips.map((trip, index) => ({ trip, index })).sort((a, b) => compare(a.trip, b.trip) || a.index - b.index).map(({ trip }) => trip);
};

/* ================= LOGO ================= */
const Logo = ({ onClick, height }) => (
  <img className="logo" src="assets/img/logo.svg" alt="TripLink" loading="lazy" decoding="async" onClick={onClick} style={height ? { height } : null} />
);

/* ================= NAV ================= */
function Nav({ page, go, user, onLogin, onLogout, onBookings }) {
  const { lang, setLang } = useLang();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  useEffect(() => {
    const f = () => setSolid(window.scrollY > 40);
    f(); window.addEventListener('scroll', f);
    return () => window.removeEventListener('scroll', f);
  }, []);
  useEffect(() => {
    if (!open && !userMenu) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') { setOpen(false); setUserMenu(false); }
    };
    const closeOnOutsideClick = (event) => {
      if (!event.target.closest('.nav')) { setOpen(false); setUserMenu(false); }
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('click', closeOnOutsideClick);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('click', closeOnOutsideClick);
    };
  }, [open, userMenu]);
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);
  const nav = (p, hash) => { setOpen(false); setUserMenu(false); go(p, hash); };
  return (
    <header className={'nav ' + (solid || page !== 'home' ? 'solid' : '')}>
      <div className="container">
        <Logo onClick={() => nav('home')} />
        <button className="burger" onClick={() => setOpen(!open)} aria-label={t(open ? 'nav.menu.close' : 'nav.menu.open')} aria-expanded={open} aria-controls="primary-navigation">{open ? '×' : '☰'}</button>
        <ul id="primary-navigation" className={open ? 'open' : ''}>
          <li><button className={page === 'home' ? 'active' : ''} onClick={() => nav('home')}>{t('nav.home')}</button></li>
          <li><button onClick={() => nav('home', 'routes')}>{t('nav.routes')}</button></li>
          <li><button onClick={() => nav('home', 'how')}>{t('nav.how')}</button></li>
          <li><button className={page === 'live' ? 'active' : ''} onClick={() => nav('live')}>{t('nav.live')}</button></li>
          {user
            ? <li><button className={page === 'bookings' ? 'active' : ''} onClick={() => { setOpen(false); setUserMenu(false); onBookings(); }}>{t('nav.bookings')}</button></li>
            : <li><button className={page === 'manage' ? 'active' : ''} onClick={() => nav('manage')}>{t('nav.findBooking')}</button></li>}
          {user
            ? <li className="nav-account">
                <button className="nav-account-name" aria-expanded={userMenu} onClick={() => setUserMenu(!userMenu)}>{user.name.split(/\s+/)[0]} ▾</button>
                {userMenu && <div className="nav-account-menu"><button onClick={() => { setOpen(false); setUserMenu(false); onLogout(); }}>{t('nav.logout')}</button></div>}
              </li>
            : <li><button onClick={() => { setOpen(false); onLogin(); }}>{t('nav.login')}</button></li>}
          <li className="language-switcher" role="group" aria-label={t('nav.language')}>
            {['en', 'si', 'ta'].map((value) => <button key={value} type="button" aria-label={t(value === 'en' ? 'nav.languageEnglish' : value === 'si' ? 'nav.languageSinhala' : 'nav.languageTamil')} aria-pressed={lang === value} className={lang === value ? 'active' : ''} onClick={() => { setLang(value); setOpen(false); }}>{value === 'en' ? 'EN' : value === 'si' ? 'සිං' : 'த'}</button>)}
          </li>
          <li><button className="cta" onClick={() => nav('home', 'top')}>{t('nav.bookNow')}</button></li>
        </ul>
      </div>
    </header>
  );
}

/* ================= HERO + SEARCH ================= */
function Hero({ cities, onSearch }) {
  const [idx, setIdx] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState(todayStr());
  const [tripMode, setTripMode] = useState('oneway');
  const [returnDate, setReturnDate] = useState(todayStr());
  const [err, setErr] = useState('');

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % HERO_IMAGES.length), SLIDE_MS);
    return () => clearInterval(t);
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!from || !to) return setErr(t('home.errCities'));
    if (from === to) return setErr(t('home.errSameCity'));
    if (tripMode === 'round' && returnDate < date) return setErr(t('home.errReturnDate'));
    setErr(''); onSearch({ from, to, date, tripMode, returnDate });
  };
  const swap = () => { setFrom(to); setTo(from); };

  return (
    <section className="hero" id="top">
      {HERO_IMAGES.map((src, i) => (
        <div key={src} className={'slide ' + (i === idx ? 'on' : '')} style={{ backgroundImage: `url(${src})` }} />
      ))}
      <div className="container fade" onTouchStart={(event) => { if (event.touches[0]) event.currentTarget.dataset.touchStartX = event.touches[0].clientX; }} onTouchEnd={(event) => {
        const start = Number(event.currentTarget.dataset.touchStartX);
        const end = event.changedTouches[0] && event.changedTouches[0].clientX;
        if (Number.isFinite(start) && Number.isFinite(end) && Math.abs(end - start) > 48) setIdx((current) => (current + (end < start ? 1 : HERO_IMAGES.length - 1)) % HERO_IMAGES.length);
      }}>
        <h1>{t('home.title1')}<br /><span>{t('home.title2')}</span></h1>
        <p className="sub">{t('home.subtitle')}</p>

        <form className={'search ' + (tripMode === 'round' ? 'round-trip-search' : '')} onSubmit={submit}>
          <div className="search-mode" role="group" aria-label={t('home.tripType')}>
            <button type="button" className={tripMode === 'oneway' ? 'active' : ''} aria-pressed={tripMode === 'oneway'} onClick={() => setTripMode('oneway')}>{t('home.oneWay')}</button>
            <button type="button" className={tripMode === 'round' ? 'active' : ''} aria-pressed={tripMode === 'round'} onClick={() => setTripMode('round')}>{t('home.roundTrip')}</button>
          </div>
          <div className="field search-from">
            <label>{t('home.from')}</label>
            <select value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="">{t('home.pickup')}</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{cityName(c.name)}</option>)}
            </select>
          </div>
          <button type="button" className="swap search-swap" onClick={swap} title={t('home.swapAria')} aria-label={t('home.swapAria')}>⇄ <span>{t('home.swap')}</span></button>
          <div className="field search-to">
            <label>{t('home.to')}</label>
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">{t('home.destination')}</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{cityName(c.name)}</option>)}
            </select>
          </div>
          <div className="field search-date">
            <label htmlFor="trip-departure-date">{t('home.departureDate')}</label>
            <input id="trip-departure-date" type="date" value={date} min={todayStr()} onChange={(e) => { setDate(e.target.value); if (returnDate < e.target.value) setReturnDate(e.target.value); }} />
          </div>
          {tripMode === 'round' && <div className="field search-return-date">
            <label htmlFor="trip-return-date">{t('home.returnDate')}</label>
            <input id="trip-return-date" type="date" value={returnDate} min={date} onChange={(e) => setReturnDate(e.target.value)} />
          </div>}
          <button className="btn gold search-submit" type="submit">{t('home.search')}</button>
        </form>
        {err && <div className="err" style={{ maxWidth: 1020 }}>{err}</div>}

        <div className="stats">
          <div><b>12+</b><span>{t('home.citiesStat')}</span></div>
          <div><b>40+</b><span>{t('home.departuresStat')}</span></div>
          <div><b>24/7</b><span>{t('home.bookingStat')}</span></div>
        </div>
      </div>
      <div className="dots">
        {HERO_IMAGES.map((_, i) => <button key={i} className={i === idx ? 'on' : ''} onClick={() => setIdx(i)} aria-label={t('home.slide', { number: i + 1 })} />)}
      </div>
    </section>
  );
}

/* ================= HOME SECTIONS ================= */
function Features() {
  const items = [
    ['💺', 'home.featureSeatTitle', 'home.featureSeat'],
    ['⚡', 'home.featureTicketTitle', 'home.featureTicket'],
    ['🛡️', 'home.featureSafeTitle', 'home.featureSafe'],
    ['📱', 'home.featureManageTitle', 'home.featureManage'],
  ];
  return (
    <section className="block">
      <div className="container">
        <div className="title"><small>{t('home.featuresEyebrow')}</small><h2>{t('home.featuresTitle')}</h2><p>{t('home.featuresIntro')}</p></div>
        <div className="grid4">
          {items.map(([icon, title, description]) => (
            <div className="card" key={title}><div className="ico">{icon}</div><h3>{t(title)}</h3><p>{t(description)}</p></div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PopularRoutes({ popular, cities, onPick }) {
  const id = (name) => (cities.find((c) => c.name === name) || {}).id;
  return (
    <section className="block" id="routes" style={{ background: '#fff' }}>
      <div className="container">
        <div className="title"><small>{t('home.routesEyebrow')}</small><h2>{t('home.routesTitle')}</h2><p>{t('home.routesIntro')}</p></div>
        <div className="grid4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))' }}>
          {popular.map((r) => (
            <div className="card route-card" key={r.id} onClick={() => onPick({ from: id(r.from_city), to: id(r.to_city), date: todayStr() })}>
              <div>
                <div className="r">{cityName(r.from_city)}<i>➜</i>{cityName(r.to_city)}</div>
                <small>{r.distance_km} km</small>
              </div>
              <div className="p">{t('home.fromFare', { price: lkr(r.from_fare) })}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function How() {
  const s = [['1', 'home.stepSearch', 'home.stepSearchDesc'], ['2', 'home.stepSeats', 'home.stepSeatsDesc'], ['3', 'home.stepDetails', 'home.stepDetailsDesc'], ['4', 'home.stepTicket', 'home.stepTicketDesc']];
  return (
    <section className="block how" id="how">
      <div className="container">
        <div className="title"><small>{t('home.howEyebrow')}</small><h2>{t('home.howTitle')}</h2><p>{t('home.howIntro')}</p></div>
        <div className="grid4">{s.map(([number, title, description]) => <div className="step" key={number}><div className="n">{number}</div><h3>{t(title)}</h3><p>{t(description)}</p></div>)}</div>
      </div>
    </section>
  );
}

function Footer({ go, onBookings, onLogin }) {
  return (
    <footer>
      <div className="container">
        <div className="cols">
          <div>
            <Logo height={54} onClick={() => go('home')} />
            <p style={{ fontSize: 14, maxWidth: 300 }}>{t('footer.tagline')}</p>
          </div>
          <div><h4>{t('footer.quick')}</h4><ul><li><button className="footer-link" onClick={() => go('home')}>{t('footer.home')}</button></li><li><button className="footer-link" onClick={() => go('home', 'routes')}>{t('footer.routes')}</button></li><li><button className="footer-link" onClick={onBookings}>{t('footer.booking')}</button></li><li><button className="footer-link" onClick={onLogin}>{t('footer.loginSignup')}</button></li></ul></div>
          <div><h4>{t('footer.support')}</h4><ul><li>{t('footer.online')}</li><li>{t('footer.cancel')}</li><li>{t('footer.faq')}</li></ul></div>
          <div><h4>{t('footer.contact')}</h4><ul><li>📞 +94 77 000 0000</li><li>✉️ hello@triplink.lk</li><li>📍 {cityName('Matara')}, {window.I18N.getLanguage() === 'en' ? 'Sri Lanka' : window.I18N.getLanguage() === 'si' ? 'ශ්‍රී ලංකාව' : 'இலங்கை'}</li></ul></div>
        </div>
        <div className="copy">© {new Date().getFullYear()} TripLink. {t('footer.rights')} · {t('footer.student')}</div>
      </div>
    </footer>
  );
}

function MobileTabs({ page, go, user, onLogin, onBookings }) {
  const accountPage = page === 'bookings' || page === 'login' || page === 'register';
  return (
    <nav className="mobile-tabs" aria-label={t('nav.quick')}>
      <button className={page === 'home' ? 'active' : ''} onClick={() => go('home')}><span aria-hidden="true">⌂</span><small>{t('nav.home')}</small></button>
      <button className={page === 'live' ? 'active' : ''} onClick={() => go('live')}><span aria-hidden="true">◎</span><small>{t('nav.live')}</small></button>
      <button className={page === 'manage' || page === 'bookings' ? 'active' : ''} onClick={() => user ? onBookings() : go('manage')}><span aria-hidden="true">▣</span><small>{user ? t('nav.bookings') : t('nav.myBooking')}</small></button>
      <button className={accountPage ? 'active' : ''} onClick={() => user ? onBookings() : onLogin()}><span aria-hidden="true">{user ? '●' : '♙'}</span><small>{user ? t('nav.account') : t('nav.login')}</small></button>
    </nav>
  );
}

/* ================= RESULTS ================= */
const RESULT_SORTS = [
  ['earliest', 'results.earliest'],
  ['cheapest', 'results.cheapestFirst'],
  ['fastest', 'results.fastest'],
  ['latest', 'results.latest'],
  ['seats', 'results.mostSeats'],
  ['comfort', 'results.highestComfort'],
];
const RESULT_TIMES = ['Morning', 'Afternoon', 'Evening', 'Night'];
const RESULT_TIME_LABELS = { Morning: '05:00–11:59', Afternoon: '12:00–16:59', Evening: '17:00–20:59', Night: '21:00–04:59' };
const RESULT_TYPES = ['Normal', 'Semi Luxury', 'Luxury', 'Super Luxury'];
const RESULT_PRESETS = [
  { id: 'cheapest', label: 'results.cheapest', sort: 'cheapest' },
  { id: 'fastest', label: 'results.fastest', sort: 'fastest' },
  { id: 'night', label: 'results.nightBuses', sort: 'earliest', times: ['Night'] },
  { id: 'luxury', label: 'results.luxuryOnly', sort: 'earliest', types: ['Luxury', 'Super Luxury'] },
  { id: 'wifi-ac', label: 'results.wifiAc', sort: 'earliest', amenities: ['WiFi', 'AC'] },
];
function FilterPanel({ trips, filters, setFilters, priceBounds, amenities, prefix, onReset }) {
  const toggle = (group, value) => {
    setFilters((current) => ({
      ...current,
      [group]: current[group].includes(value)
        ? current[group].filter((item) => item !== value)
        : [...current[group], value],
    }));
  };
  const typeCount = (type) => trips.filter((trip) => trip.bus_type === type).length;
  const minValue = filters.minFare == null ? priceBounds.min : filters.minFare;
  const maxValue = filters.maxFare == null ? priceBounds.max : filters.maxFare;
  const setFare = (side, raw) => {
    const value = raw === '' ? null : Math.max(priceBounds.min, Math.min(priceBounds.max, Number(raw)));
    setFilters((current) => {
      const next = { ...current, [side === 'min' ? 'minFare' : 'maxFare']: value };
      const nextMin = side === 'min' ? (value == null ? priceBounds.min : value) : (next.minFare == null ? priceBounds.min : next.minFare);
      const nextMax = side === 'max' ? (value == null ? priceBounds.max : value) : (next.maxFare == null ? priceBounds.max : next.maxFare);
      if (nextMin > nextMax) next[side === 'min' ? 'maxFare' : 'minFare'] = value;
      return next;
    });
  };
  const toggleTime = (time) => toggle('times', time);

  return (
    <div className="result-filter-groups">
      <div className="result-filter-heading"><h3>{t('results.filters')}</h3><button type="button" className="text-link" onClick={onReset}>{t('results.resetAll')}</button></div>
      <fieldset className="result-filter-group">
        <legend>{t('results.departureTime')}</legend>
        <div className="result-time-chips">
          {RESULT_TIMES.map((time) => <button type="button" key={time} title={RESULT_TIME_LABELS[time]} aria-label={`${t(`results.${time.toLowerCase()}`)}, ${RESULT_TIME_LABELS[time]}`} className={filters.times.includes(time) ? 'selected' : ''} aria-pressed={filters.times.includes(time)} onClick={() => toggleTime(time)}>{t(`results.${time.toLowerCase()}`)}</button>)}
        </div>
      </fieldset>
      <fieldset className="result-filter-group">
        <legend>{t('results.busType')}</legend>
        {RESULT_TYPES.map((type) => <label className="result-check" key={type}>
          <input type="checkbox" checked={filters.types.includes(type)} onChange={() => toggle('types', type)} />
          <span>{busTypeName(type)}</span><small>{typeCount(type)}</small>
        </label>)}
      </fieldset>
      {amenities.length > 0 && <fieldset className="result-filter-group">
        <legend>{t('results.amenities')} <small>{t('results.allSelected')}</small></legend>
        {amenities.map((amenity) => <label className="result-check" key={amenity}>
          <input type="checkbox" checked={filters.amenities.includes(amenity)} onChange={() => toggle('amenities', amenity)} />
          <span>{amenityName(amenity)}</span>
        </label>)}
      </fieldset>}
      <fieldset className="result-filter-group">
        <legend>{t('results.priceRange')}</legend>
        <p className="result-price-label">{lkr(minValue)} – {lkr(maxValue)}</p>
        <div className="result-price-inputs">
          <label htmlFor={`${prefix}-price-min`}>{t('results.minPrice')}<input id={`${prefix}-price-min`} type="number" min={priceBounds.min} max={priceBounds.max} step="100" value={minValue} onChange={(event) => setFare('min', event.target.value)} /></label>
          <label htmlFor={`${prefix}-price-max`}>{t('results.maxPrice')}<input id={`${prefix}-price-max`} type="number" min={priceBounds.min} max={priceBounds.max} step="100" value={maxValue} onChange={(event) => setFare('max', event.target.value)} /></label>
        </div>
      </fieldset>
      <fieldset className="result-filter-group">
        <legend>{t('results.availability')}</legend>
        <label className="result-check">
          <input type="checkbox" checked={filters.availableOnly} onChange={(event) => setFilters((current) => ({ ...current, availableOnly: event.target.checked }))} />
          <span>{t('results.availableOnly')}</span>
        </label>
      </fieldset>
    </div>
  );
}

function ActiveFilterChips({ filters, bounds, onRemove }) {
  const chips = [
    ...filters.times.map((value) => ({ key: `time:${value}`, label: t(`results.${value.toLowerCase()}`), group: 'times', value })),
    ...filters.types.map((value) => ({ key: `type:${value}`, label: busTypeName(value), group: 'types', value })),
    ...filters.amenities.map((value) => ({ key: `amenity:${value}`, label: amenityName(value), group: 'amenities', value })),
  ];
  if (filters.minFare != null || filters.maxFare != null) chips.push({ key: 'price', label: `${lkr(filters.minFare == null ? bounds.min : filters.minFare)} – ${lkr(filters.maxFare == null ? bounds.max : filters.maxFare)}`, group: 'price' });
  if (!filters.availableOnly) chips.push({ key: 'availability', label: t('results.includingSoldOut'), group: 'availability' });
  if (!chips.length) return null;
  return <div className="result-active-chips" aria-label={t('results.activeFilters')}>{chips.map((chip) => <button type="button" key={chip.key} onClick={() => onRemove(chip)}>{chip.label}<span aria-hidden="true">×</span><span className="sr-only">{t('results.removeFilter', { filter: chip.label })}</span></button>)}</div>;
}

function FilterDrawer({ open, onClose, onReset, count, children, drawerRef, triggerRef }) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = drawerRef.current;
    const focusable = () => dialog ? Array.from(dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null) : [];
    const close = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'Tab') {
        const items = focusable();
        if (!items.length) return;
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus(); }
        else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
      }
    };
    document.addEventListener('keydown', close);
    const first = focusable()[0];
    if (first) first.focus();
    return () => {
      document.removeEventListener('keydown', close);
      document.body.style.overflow = previousOverflow;
      if (triggerRef.current) triggerRef.current.focus();
    };
  }, [open, onClose, drawerRef, triggerRef]);
  if (!open) return null;
  return (
    <div className="filter-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="filter-drawer" role="dialog" aria-modal="true" aria-label={t('results.filterBuses')} ref={drawerRef}>
        <div className="filter-drawer-content">{children}</div>
        <div className="filter-drawer-footer">
          <button type="button" className="btn ghost" onClick={onReset}>{t('results.reset')}</button>
          <button type="button" className="btn gold" onClick={onClose}>{t(count === 1 ? 'results.showCount_one' : 'results.showCount_other', { count })}</button>
        </div>
      </section>
    </div>
  );
}

function Results({ query, cities, onSelect, onBack, roundTripStage, outboundSelection, onChangeOutbound }) {
  const [trips, setTrips] = useState(null);
  const [err, setErr] = useState('');
  const filterIdentity = `${query.from}:${query.to}:${query.date}`;
  const [filters, setFilters] = useState(() => loadResultFilters(filterIdentity));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef(null);
  const filterTriggerRef = useRef(null);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const name = (id) => cityName((cities.find((c) => String(c.id) === String(id)) || {}).name || '');

  useEffect(() => {
    setTrips(null); setErr('');
    let active = true;
    get(`search.php?from=${query.from}&to=${query.to}&date=${query.date}`)
      .then((d) => {
        if (!active) return;
        const isReturn = roundTripStage === 'returnResults' && outboundSelection;
        const arrivalDateTime = isReturn ? tripArrivalDateTime(outboundSelection.trip) : '';
        const eligible = isReturn
          ? d.trips.filter((trip) => `${trip.depart_date} ${trip.depart_time}` > arrivalDateTime)
          : d.trips;
        setTrips(eligible);
      }).catch((e) => { if (active) setErr(errorMessage(e)); });
    return () => { active = false; };
  }, [query.from, query.to, query.date, roundTripStage, outboundSelection]);

  useEffect(() => {
    try { sessionStorage.setItem(RESULT_FILTER_STORAGE_KEY, JSON.stringify({ identity: filterIdentity, filters })); } catch (e) { /* storage may be unavailable */ }
  }, [filterIdentity, filters]);

  const priceBounds = React.useMemo(() => {
    if (!trips || !trips.length) return { min: 0, max: 0 };
    const fares = trips.map((trip) => Number(trip.fare)).filter(Number.isFinite);
    return { min: fares.length ? Math.min(...fares) : 0, max: fares.length ? Math.max(...fares) : 0 };
  }, [trips]);
  const amenities = React.useMemo(() => {
    if (!trips) return [];
    const found = new Map();
    trips.forEach((trip) => tripAmenities(trip).forEach((value) => {
      const key = value.toLowerCase();
      if (!found.has(key)) found.set(key, value);
    }));
    return Array.from(found.values()).sort((a, b) => a.localeCompare(b));
  }, [trips]);
  const filteredTrips = React.useMemo(() => trips ? applyFilters(trips, filters, priceBounds) : [], [trips, filters, priceBounds]);
  const visibleTrips = React.useMemo(() => applySort(filteredTrips, filters.sort), [filteredTrips, filters.sort]);
  const filterCount = filters.times.length + filters.types.length + filters.amenities.length
    + ((filters.minFare != null || filters.maxFare != null) ? 1 : 0) + (!filters.availableOnly ? 1 : 0);
  const resetFilters = useCallback(() => {
    setFilters(emptyResultFilters());
  }, []);
  const changeFilters = (updater) => {
    setFilters((current) => ({ ...updater(current), preset: '' }));
  };
  const setSort = (sort) => { setFilters((current) => ({ ...current, sort, preset: '' })); };
  const usePreset = (selected) => {
    if (filters.preset === selected.id && activePreset(selected)) { resetFilters(); return; }
    setFilters({
      ...emptyResultFilters(),
      sort: selected.sort,
      preset: selected.id,
      times: selected.times || [],
      types: selected.types || [],
      amenities: selected.amenities || [],
    });
  };
  const removeChip = (chip) => {
    if (chip.group === 'price') setFilters((current) => ({ ...current, preset: '', minFare: null, maxFare: null }));
    else if (chip.group === 'availability') setFilters((current) => ({ ...current, preset: '', availableOnly: true }));
    else setFilters((current) => ({ ...current, preset: '', [chip.group]: current[chip.group].filter((value) => value !== chip.value) }));
  };
  const activePreset = (selected) => {
    if (filters.preset !== selected.id) return false;
    return filters.sort === selected.sort
      && JSON.stringify(filters.times) === JSON.stringify(selected.times || [])
      && JSON.stringify(filters.types) === JSON.stringify(selected.types || [])
      && JSON.stringify(filters.amenities) === JSON.stringify(selected.amenities || []);
  };
  const filterPanel = (prefix) => <FilterPanel trips={trips || []} filters={filters} setFilters={changeFilters} priceBounds={priceBounds} amenities={amenities} prefix={prefix} onReset={resetFilters} />;
  const cheapest = visibleTrips.length ? Math.min(...visibleTrips.map((trip) => Number(trip.fare))) : null;
  const fastest = visibleTrips.length ? Math.min(...visibleTrips.map((trip) => durationMinutes(trip.depart_time, trip.arrive_time))) : null;
  const listSignature = visibleTrips.map((trip) => trip.id).join(',');

  return (
    <>
      <div className="page-head"><div className="container">
        <button className="back" onClick={onBack}>{t('results.changeSearch')}</button>
        <h2>{name(query.from)} ➜ {name(query.to)}</h2>
        <p>{fmtDate(query.date)}</p>
        {roundTripStage === 'returnResults' && outboundSelection && <div className="round-trip-banner">
          <div><b>{t('results.stepReturn')}</b><span>{cityName(outboundSelection.trip.from_city)} → {cityName(outboundSelection.trip.to_city)} · {fmtDate(outboundSelection.trip.depart_date)} · {outboundSelection.trip.bus_name} · {t('seats.seats')} {outboundSelection.seats.join(', ')}</span></div>
          <button type="button" className="back" onClick={onChangeOutbound}>{t('results.changeOutbound')}</button>
        </div>}
      </div></div>
      <div className="results-sticky"><div className="container"><b>{name(query.from)} → {name(query.to)}</b><span>{fmtDate(query.date)}</span></div></div>
      <div className="page results-page" style={{ paddingTop: 36 }}><div className="container">
        {err && <div className="err">{err}</div>}
        {!trips && !err && <div className="result-skeletons" aria-label={t('results.loading')}>{[1, 2, 3].map((item) => <div className="result-skeleton" key={item}><i /><i /><i /><i /></div>)}</div>}
        {trips && trips.length === 0 && !err && <div className="empty">{t('results.noBuses')}</div>}
        {trips && trips.length > 0 && <div className="filter-results-layout">
          <aside className="result-sidebar">{filterPanel('desktop')}</aside>
          <section className="filter-results-main" aria-label={t('results.resultsLabel')}>
            <div className="result-toolbar">
              <p aria-live="polite" aria-atomic="true">{t(visibleTrips.length === 1 ? 'results.busCount_one' : 'results.busCount_other', { count: visibleTrips.length })}</p>
              <div className="result-sort-controls">
                <button type="button" className="btn ghost result-filter-trigger" ref={filterTriggerRef} onClick={() => setDrawerOpen(true)}>{t('results.filters')} {filterCount > 0 && <span>{filterCount}</span>}</button>
                <label htmlFor="result-sort">{t('results.sortBy')}
                  <select id="result-sort" value={filters.sort} onChange={(event) => setSort(event.target.value)}>
                    {RESULT_SORTS.map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <div className="result-presets" aria-label={t('results.presets')}>
              {RESULT_PRESETS.map((item) => <button type="button" key={item.id} aria-pressed={activePreset(item)} className={activePreset(item) ? 'active' : ''} onClick={() => usePreset(item)}>{t(item.label)}</button>)}
              {filterCount > 0 && <button type="button" className="result-reset-mobile" onClick={resetFilters}>{t('results.reset')}</button>}
            </div>
            <ActiveFilterChips filters={filters} bounds={priceBounds} onRemove={removeChip} />
            {visibleTrips.length === 0
              ? <div className="empty result-empty"><h3>{t('results.noMatchTitle')}</h3><p>{t('results.noMatchIntro')}</p><button className="btn gold" type="button" onClick={resetFilters}>{t('results.clearFilters')}</button></div>
              : <div className="result-trip-list" key={listSignature}>
                {visibleTrips.map((trip) => {
                  const badges = [];
                  if (Number(trip.fare) === cheapest) badges.push('results.cheapestBadge');
                  if (durationMinutes(trip.depart_time, trip.arrive_time) === fastest) badges.push('results.fastestBadge');
                  if (Number(trip.seats_left) < 8) badges.push('results.fewSeats');
                  return <div className="trip filter-trip" key={trip.id}>
                    <div className="bus">
                      <b>{trip.bus_name}</b>
                      <span className="badge gold">{busTypeName(trip.bus_type)}</span>
                      {tripAmenities(trip).map((amenity) => <span className="badge" key={amenity}>{amenityName(amenity)}</span>)}
                      {badges.slice(0, 2).map((badge) => <span className={`badge ${badge === 'results.cheapestBadge' ? 'gold' : ''}`} key={badge}>{t(badge)}</span>)}
                    </div>
                    <div className="times">
                      <div><b>{fmtTime(trip.depart_time)}</b><small>{cityName(trip.from_city)}</small></div>
                      <div className="line" />
                      <div style={{ textAlign: 'right' }}><b>{fmtTime(trip.arrive_time)}</b><small>{cityName(trip.to_city)}</small></div>
                    </div>
                    <div className="price">
                      <b>{lkr(trip.fare)}</b>
                      <small>{duration(trip.depart_time, trip.arrive_time)} · <span className={trip.seats_left < 8 ? 'left-low' : ''}>{t('results.seatsLeft', { count: trip.seats_left })}</span></small>
                    </div>
                    <button className="btn trip-action" disabled={trip.seats_left <= 0} onClick={() => onSelect(trip.id)}>{trip.seats_left <= 0 ? t('results.soldOut') : t('results.selectSeats')}</button>
                  </div>;
                })}
              </div>}
          </section>
        </div>}
      </div></div>
      <FilterDrawer open={drawerOpen} onClose={closeDrawer} onReset={resetFilters} count={visibleTrips.length} drawerRef={drawerRef} triggerRef={filterTriggerRef}>
        {filterPanel('mobile')}
      </FilterDrawer>
    </>
  );
}

/* ================= SEAT SELECTION ================= */
function Seats({ tripId, onBack, onBooked, user, onLogin, selectionMode = 'oneway', onLegSelected }) {
  const [data, setData] = useState(null);
  const [picked, setPicked] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => get('seats.php?trip_id=' + tripId).then(setData).catch((e) => setErr(errorMessage(e))), [tripId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (user) {
      setForm({ name: user.name, phone: user.phone, email: user.email });
    }
  }, [user]);

  if (err && !data) return <div className="page"><div className="container"><div className="err">{err}</div><button className="btn" style={{ marginTop: 14 }} onClick={onBack}>← Back</button></div></div>;
  if (!data) return <div className="page"><div className="spinner" /></div>;

  const { trip, booked } = data;
  const rows = Math.ceil(trip.total_seats / 4);
  const toggle = (n) => {
    setErr('');
    setPicked((p) => p.includes(n) ? p.filter((x) => x !== n) : p.length >= 6 ? (setErr(t('seats.errMax')), p) : [...p, n].sort((a, b) => a - b));
  };
  const seatBtn = (n) => n > trip.total_seats ? <span key={n} /> : (
    <button key={n} type="button" className={'seat ' + (picked.includes(n) ? 'sel' : '')} disabled={booked.includes(n)} onClick={() => toggle(n)}>{n}</button>
  );
  const total = picked.length * Number(trip.fare);

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!picked.length) return setErr(t('seats.errSelect'));
    if (selectionMode !== 'oneway') {
      onLegSelected({ trip, seats: picked });
      return;
    }
    setBusy(true);
    try {
      const r = await post('book.php', { trip_id: trip.id, seats: picked, ...form });
      onBooked({ ref: r.ref, phone: form.phone });
    } catch (ex) {
      setErr(errorMessage(ex));
      if (ex.data && ex.data.conflict) { setPicked([]); load(); }
    } finally { setBusy(false); }
  };
  const continueLabel = selectionMode === 'outbound' ? t('seats.continueReturn') : t('seats.continueDetails');

  return (
    <>
      <div className="page-head"><div className="container">
        <button className="back" onClick={onBack}>{t('seats.back')}</button>
        <h2>{cityName(trip.from_city)} ➜ {cityName(trip.to_city)}</h2>
        <p>{fmtDate(trip.depart_date)} · {fmtTime(trip.depart_time)} · {trip.bus_name} ({trip.bus_type})</p>
      </div></div>
      <div className={'page seats-page ' + (picked.length ? 'has-picked-seats' : '')} style={{ paddingTop: 36 }}><div className="container">
        <div className="seat-wrap">
          <div className="panel">
            <h3>{t('seats.chooseTitle')}</h3>
            <div className="bus-body">
              <div className="driver">{t('seats.driver')} <div className="wheel" /></div>
              {Array.from({ length: rows }, (_, r) => {
                const b = r * 4;
                return <div className="seat-row" key={r}>{seatBtn(b + 1)}{seatBtn(b + 2)}<span />{seatBtn(b + 3)}{seatBtn(b + 4)}</div>;
              })}
            </div>
            <div className="legend"><span><i />{t('seats.available')}</span><span><i className="s" />{t('seats.selected')}</span><span><i className="b" />{t('seats.booked')}</span></div>
          </div>

          <form id="seat-booking-form" className="panel" onSubmit={submit}>
            <h3>{selectionMode === 'oneway' ? t('seats.summary') : `${t(selectionMode === 'outbound' ? 'seats.outbound' : 'seats.return')} ${t('seats.seats').toLowerCase()}`}</h3>
            {selectionMode !== 'oneway'
              ? <p className="booking-account-note">{t('seats.selectLegInfo')}</p>
              : user
              ? <p className="booking-account-note">{t('seats.bookingAs', { name: user.name })}</p>
              : <p className="booking-account-note">{t('seats.accountPrompt')} <button type="button" className="text-link" onClick={onLogin}>{t('seats.loginTrack')}</button></p>}
            <div className="sum-row"><span>{t('seats.seats')}</span><span>{picked.length ? <span className="chips">{picked.map((s) => <span className="chip" key={s}>{s}</span>)}</span> : '—'}</span></div>
            <div className="sum-row"><span>{t('seats.farePerSeat')}</span><span>{lkr(trip.fare)}</span></div>
            <div className="sum-row total"><span>{t('seats.total')}</span><span>{lkr(total)}</span></div>

            <div className="form-grid">
              {selectionMode === 'oneway' && <>
                <div className="field"><label htmlFor="booking-name">{t('seats.passengerName')}</label><input id="booking-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('seats.fullName')} /></div>
                <div className="field"><label htmlFor="booking-phone">{t('seats.phone')}</label><input id="booking-phone" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={t('seats.phonePlaceholder')} inputMode="tel" /></div>
                <div className="field"><label htmlFor="booking-email">{t('seats.emailOptional')}</label><input id="booking-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={t('seats.emailPlaceholder')} /></div>
                {err && <div className="err">{err}</div>}
                <button className="btn gold seat-desktop-submit" disabled={busy || !picked.length}>{busy ? t('seats.booking') : t('seats.confirmBooking', { total: lkr(total) })}</button>
                <small style={{ color: 'var(--muted)' }}>{t('seats.paymentNote')}</small>
              </>}
              {selectionMode !== 'oneway' && <>
                {err && <div className="err">{err}</div>}
                <button type="submit" className="btn gold seat-desktop-submit" disabled={!picked.length}>{continueLabel}</button>
              </>}
            </div>
          </form>
        </div>
        {picked.length > 0 && <div className="seat-sticky-bar">
          <div><b>{t('seats.seats')}: {picked.join(', ')}</b><span>{t('seats.total')} {lkr(total)}</span></div>
          {selectionMode === 'oneway'
            ? <button className="btn gold" type="submit" form="seat-booking-form" disabled={busy}>{busy ? t('seats.booking') : t('seats.confirm')}</button>
            : <button className="btn gold" type="button" disabled={!picked.length} onClick={() => onLegSelected({ trip, seats: picked })}>{continueLabel}</button>}
        </div>}
      </div></div>
    </>
  );
}

function RoundTripConfirm({ outbound, returnLeg, user, onBooked, onBack }) {
  const [form, setForm] = useState({ name: user ? user.name : '', phone: user ? user.phone : '', email: user ? user.email : '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (user) setForm({ name: user.name, phone: user.phone, email: user.email });
  }, [user]);
  const legTotal = (selection) => Number(selection.trip.fare) * selection.seats.length;
  const grandTotal = legTotal(outbound) + legTotal(returnLeg);
  const submit = async (event) => {
    event.preventDefault();
    setErr('');
    if (form.name.trim().length < 2) return setErr(t('round.errName'));
    if (form.phone.replace(/\D/g, '').length < 9) return setErr(t('round.errPhone'));
    setBusy(true);
    try {
      const response = await post('book_round.php', {
        outbound: { trip_id: outbound.trip.id, seats: outbound.seats },
        return: { trip_id: returnLeg.trip.id, seats: returnLeg.seats },
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
      });
      onBooked({ ref: response.outbound.ref, phone: form.phone, group_ref: response.group_ref });
    } catch (error) {
      setErr(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const summary = (label, selection) => (
    <article className="card round-leg-summary">
      <div className="round-leg-heading"><h3>{label}</h3><span className="badge gold">{busTypeName(selection.trip.bus_type)}</span></div>
      <p className="round-leg-route">{cityName(selection.trip.from_city)} <span>→</span> {cityName(selection.trip.to_city)}</p>
      <p>{fmtDate(selection.trip.depart_date)} · {fmtTime(selection.trip.depart_time)} – {fmtTime(selection.trip.arrive_time)}</p>
      <p>{selection.trip.bus_name} · {selection.trip.reg_no || ''}</p>
      <div className="round-leg-bottom"><span>{t('seats.seats')} {selection.seats.join(', ')}</span><b>{lkr(legTotal(selection))}</b></div>
    </article>
  );
  return (
    <>
      <div className="page-head"><div className="container">
        <button className="back" onClick={onBack}>{t('round.changeReturn')}</button>
        <h2>{t('round.reviewTitle')}</h2>
        <p>{t('round.reviewIntro')}</p>
      </div></div>
      <div className="page round-confirm-page"><div className="container round-confirm-layout">
        <div className="round-legs">{summary(t('round.outbound'), outbound)}{summary(t('round.return'), returnLeg)}<div className="round-grand-total"><span>{t('round.total')}</span><b>{lkr(grandTotal)}</b></div></div>
        <form className="panel round-passenger" onSubmit={submit}>
          <h3>{t('round.passengerDetails')}</h3>
          {user ? <p className="booking-account-note">{t('seats.bookingAs', { name: user.name })}</p> : <p className="booking-account-note">{t('round.guestNote')}</p>}
          <div className="form-grid">
            <div className="field"><label htmlFor="round-passenger-name">{t('round.passengerName')}</label><input id="round-passenger-name" required minLength="2" maxLength="100" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
            <div className="field"><label htmlFor="round-passenger-phone">{t('round.phone')}</label><input id="round-passenger-phone" required minLength="9" inputMode="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
            <div className="field"><label htmlFor="round-passenger-email">{t('round.email')}</label><input id="round-passenger-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
            {err && <div className="err" role="alert">{err}</div>}
            <button type="submit" className="btn gold" disabled={busy}>{busy ? t('round.booking') : t('round.confirm', { total: lkr(grandTotal) })}</button>
            <small style={{ color: 'var(--muted)' }}>{t('round.atomicNote')}</small>
          </div>
        </form>
      </div></div>
    </>
  );
}

/* ================= TICKET ================= */
function TicketCard({ booking, label }) {
  const qrRef = useRef(null);

  useEffect(() => {
    if (!qrRef.current || typeof QRCode === 'undefined') return;
    qrRef.current.innerHTML = '';
    new QRCode(qrRef.current, { text: `TRIPLINK|${booking.ref}|${booking.from_city}-${booking.to_city}|${booking.depart_date} ${booking.depart_time}|SEATS:${booking.seats.join(',')}`, width: 130, height: 130, colorDark: '#04301f' });
  }, [booking]);

  const cancelled = booking.status === 'cancelled';

  return (
    <div className="ticket fade">
      <div className="top"><img src="assets/img/logo.svg" alt="TripLink" loading="lazy" decoding="async" /><div className="ticket-ref">{label && <span className="badge gold">{label}</span>}{t('ticket.bookingRef')}<br /><b>{booking.ref}</b></div></div>
      <div className="ok">{cancelled ? <span className="status-x">{t('ticket.cancelled')}</span> : t('ticket.confirmed')}</div>
      <div className="body">
        <div>
          <div className="route">{cityName(booking.from_city)} ➜ {cityName(booking.to_city)}</div>
          <dl>
            <div><dt>{t('ticket.date')}</dt><dd>{fmtDate(booking.depart_date)}</dd></div>
            <div><dt>{t('ticket.departure')}</dt><dd>{fmtTime(booking.depart_time)}</dd></div>
            <div><dt>{t('ticket.passenger')}</dt><dd>{booking.passenger_name}</dd></div>
            <div><dt>{t('ticket.seats')}</dt><dd>{booking.seats.length ? booking.seats.join(', ') : '—'}</dd></div>
            <div><dt>{t('ticket.bus')}</dt><dd>{booking.bus_name} · {booking.reg_no}</dd></div>
            <div><dt>{t('ticket.total')}</dt><dd>{lkr(booking.total)}</dd></div>
          </dl>
        </div>
        <div className="qr"><div ref={qrRef} style={{ opacity: cancelled ? .25 : 1 }} /></div>
      </div>
      <div className="foot"><span>{t('ticket.arriveEarly')}</span><span>{t('ticket.payOnBoarding')}</span></div>
    </div>
  );
}

function Ticket({ b, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const legs = b.legs && b.legs.length ? b.legs : [b];
  const cancelLeg = async (leg) => {
    const legName = leg.leg === 'outbound' ? t('ticket.outbound') : leg.leg === 'return' ? t('ticket.return') : t('ticket.cancelBooking');
    if (!confirm(t('ticket.cancelLegConfirm', { leg: legName, ref: leg.ref }))) return false;
    setBusy(true); setMsg('');
    try {
      await post('cancel.php', { ref: leg.ref, phone: leg.phone || b.phone || '' });
      return true;
    } catch (error) {
      setMsg(errorMessage(error));
      return false;
    } finally { setBusy(false); }
  };
  const cancelAll = async () => {
    if (!confirm(t('ticket.cancelAllConfirm'))) return;
    setMsg('');
    const results = await Promise.all(legs.filter((leg) => leg.status !== 'cancelled').map(cancelLeg));
    if (results.some(Boolean) && results.some((result) => !result)) setMsg(t('ticket.partialCancel'));
    if (onChanged) onChanged();
  };
  const share = async () => {
    const text = legs.map((leg) => `${leg.leg ? `${leg.leg === 'outbound' ? t('ticket.outbound') : t('ticket.return')}: ` : ''}${cityName(leg.from_city)} to ${cityName(leg.to_city)} · ${fmtDate(leg.depart_date)} · ${leg.ref}`).join('\n');
    const shareData = { title: `TripLink ticket ${b.group_ref || b.ref}`, text, url: window.location.href };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (error) { if (error.name !== 'AbortError') setMsg(t('ticket.shareError')); }
    } else if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`); setMsg(t('ticket.copied')); }
      catch (error) { setMsg(t('ticket.copyError')); }
    } else setMsg(t('ticket.shareUnsupported'));
  };
  return (
    <>
      {b.group_ref && <div className="round-ticket-total"><span>{t('ticket.groupTotal')}</span><b>{lkr(b.grand_total || legs.reduce((total, leg) => total + Number(leg.total), 0))}</b><small>{t('ticket.groupRef', { ref: b.group_ref })}</small></div>}
      {legs.map((leg) => <div className="round-ticket-leg" key={leg.ref}>
        <TicketCard booking={leg} label={b.group_ref ? (leg.leg === 'return' ? t('ticket.return') : t('ticket.outbound')) : ''} />
        {leg.status !== 'cancelled' && <div className="no-print ticket-leg-actions">
          <button type="button" className="btn ghost" disabled={busy} onClick={() => cancelLeg(leg).then((cancelled) => { if (cancelled && onChanged) onChanged(); })}>{t('ticket.cancel', { leg: leg.leg === 'outbound' ? t('ticket.outbound') : leg.leg === 'return' ? t('ticket.return') : t('ticket.cancelBooking') })}</button>
        </div>}
      </div>)}
      <div className="no-print ticket-actions">
        <button className="btn" onClick={() => window.print()}>{t('ticket.print')}</button>
        <button className="btn ghost" onClick={share}>{t('ticket.share')}</button>
        {b.group_ref && legs.some((leg) => leg.status !== 'cancelled') && <button className="btn ghost" disabled={busy} onClick={cancelAll}>{t('ticket.cancelBoth')}</button>}
      </div>
      {msg && <div className="err" style={{ maxWidth: 640, margin: '14px auto 0' }} role="alert">{msg}</div>}
    </>
  );
}

function TicketPage({ ref_, phone, user, onHome }) {
  const [b, setB] = useState(null); const [err, setErr] = useState('');
  const load = useCallback(() => {
    const query = new URLSearchParams({ ref: ref_ });
    if (!user && phone) query.set('phone', phone);
    return get(`booking.php?${query}`).then((d) => setB(d.booking)).catch((e) => setErr(errorMessage(e)));
  }, [ref_, phone, user]);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="page"><div className="container">
      {err && <div className="err">{err}</div>}
      {!b && !err && <div className="spinner" />}
      {b && <><Ticket b={b} onChanged={load} /><div className="no-print" style={{ textAlign: 'center', marginTop: 16 }}><button className="back" style={{ color: 'var(--g700)' }} onClick={onHome}>{t('ticket.back')}</button></div></>}
    </div></div>
  );
}

/* ================= MANAGE BOOKING ================= */
function Manage() {
  const [ref_, setRef] = useState(''); const [phone, setPhone] = useState('');
  const [b, setB] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const find = async (e) => {
    e && e.preventDefault(); setErr(''); setBusy(true);
    try { const d = await get(`booking.php?ref=${encodeURIComponent(ref_.trim())}&phone=${encodeURIComponent(phone)}`); setB(d.booking); }
    catch (ex) { setB(null); setErr(errorMessage(ex)); } finally { setBusy(false); }
  };
  return (
    <>
      <div className="page-head"><div className="container"><h2>{t('manage.title')}</h2><p>{t('manage.intro')}</p></div></div>
      <div className="page" style={{ paddingTop: 36 }}><div className="container">
        {!b && (
          <form className="panel manage" onSubmit={find}>
            <div className="form-grid" style={{ marginTop: 0 }}>
              <div className="field"><label>{t('manage.reference')}</label><input required value={ref_} onChange={(e) => setRef(e.target.value)} placeholder={t('manage.referencePlaceholder')} style={{ textTransform: 'uppercase' }} /></div>
              <div className="field"><label>{t('manage.phoneUsed')}</label><input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('seats.phonePlaceholder')} inputMode="tel" /></div>
              {err && <div className="err">{err}</div>}
              <button className="btn" disabled={busy}>{busy ? t('manage.searching') : t('manage.find')}</button>
            </div>
          </form>
        )}
        {b && <><Ticket b={b} onChanged={find} /><div style={{ textAlign: 'center', marginTop: 16 }}><button className="back" style={{ color: 'var(--g700)' }} onClick={() => setB(null)}>{t('manage.searchAnother')}</button></div></>}
      </div></div>
    </>
  );
}

/* ================= PASSENGER AUTH ================= */
function Auth({ mode, onMode, onSuccess }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const registering = mode === 'register';

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (registering) {
      if (form.name.trim().length < 2) return setErr(t('auth.nameMin'));
      if (form.phone.replace(/\D/g, '').length < 9) return setErr(t('auth.phoneValid'));
      if (form.password.length < 8) return setErr(t('auth.passwordMin'));
      if (form.password !== form.confirm) return setErr(t('auth.passwordMismatch'));
    }

    setBusy(true);
    try {
      const data = await post(registering ? 'register.php' : 'login.php', registering
        ? { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), password: form.password }
        : { email: form.email.trim(), password: form.password });
      onSuccess(data.user);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head"><div className="container">
        <h2>{t(registering ? 'auth.createTitle' : 'auth.welcome')}</h2>
        <p>{t(registering ? 'auth.registerIntro' : 'auth.loginIntro')}</p>
      </div></div>
      <div className="page auth-page"><div className="container">
        <div className="auth-panel panel fade">
          <div className="auth-tabs">
            <button type="button" className={!registering ? 'active' : ''} onClick={() => onMode('login')}>{t('auth.login')}</button>
            <button type="button" className={registering ? 'active' : ''} onClick={() => onMode('register')}>{t('nav.signup')}</button>
          </div>
          <form onSubmit={submit} className="form-grid">
            {registering && <>
              <div className="field"><label htmlFor="auth-name">{t('auth.fullName')}</label><input id="auth-name" autoComplete="name" required maxLength="100" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="field"><label htmlFor="auth-phone">{t('auth.phone')}</label><input id="auth-phone" autoComplete="tel" required inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </>}
            <div className="field"><label htmlFor="auth-email">{t('auth.email')}</label><input id="auth-email" type="email" autoComplete="email" required maxLength="120" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="field"><label htmlFor="auth-password">{t('auth.password')}</label>
              <div className="password-control"><input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} required minLength={registering ? 8 : undefined} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')}>{showPassword ? t('auth.hidePassword') : t('auth.showPassword')}</button></div>
            </div>
            {registering && <div className="field"><label htmlFor="auth-confirm">{t('auth.confirmPassword')}</label><input id="auth-confirm" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></div>}
            {err && <div className="err" role="alert">{err}</div>}
            <button className="btn gold" disabled={busy}>{busy ? t('auth.wait') : registering ? t('auth.create') : t('auth.login')}</button>
            <p className="auth-switch">{t(registering ? 'auth.already' : 'auth.newHere')} <button type="button" className="text-link" onClick={() => onMode(registering ? 'login' : 'register')}>{registering ? t('auth.login') : t('nav.signup')}</button></p>
          </form>
        </div>
      </div></div>
    </>
  );
}

/* ================= PASSENGER BOOKING HISTORY ================= */
function MyBookings({ user, onOpenTicket, onBook, onAuthRequired }) {
  const [filter, setFilter] = useState('upcoming');
  const [bookings, setBookings] = useState([]);
  const [busy, setBusy] = useState(true);
  const [cancelling, setCancelling] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setErr('');
    try {
      const data = await get(`my_bookings.php?filter=${filter}`);
      setBookings(data.bookings);
    } catch (e) {
      setErr(errorMessage(e));
      if (e.status === 401) onAuthRequired();
    } finally {
      setBusy(false);
    }
  }, [filter, onAuthRequired]);

  useEffect(() => { load(); }, [load]);

  const canCancel = (booking) => new Date(`${booking.depart_date}T${booking.depart_time}`).getTime() - Date.now() >= 2 * 60 * 60 * 1000;
  const cancel = async (booking) => {
    if (!canCancel(booking)) return;
    if (!confirm(t('bookings.cancelConfirm', { ref: booking.ref }))) return;
    setCancelling(booking.ref);
    setErr('');
    try {
      await post('cancel.php', { ref: booking.ref });
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setCancelling('');
    }
  };
  const bookingGroups = React.useMemo(() => {
    const groups = new Map();
    bookings.forEach((booking) => {
      const key = booking.group_ref || booking.ref;
      if (!groups.has(key)) groups.set(key, { group_ref: booking.group_ref, legs: [] });
      groups.get(key).legs.push(booking);
    });
    return Array.from(groups.values()).map((group) => ({
      ...group,
      legs: group.legs.sort((a, b) => (a.leg === 'outbound' ? -1 : 0) - (b.leg === 'outbound' ? -1 : 0)),
    }));
  }, [bookings]);

  return (
    <>
      <div className="page-head"><div className="container">
        <h2>{t('bookings.title')}</h2>
        <p>{t('bookings.intro')}</p>
      </div></div>
      <div className="page bookings-page"><div className="container">
        <section className="profile-panel panel">
          <div className="profile-avatar">{user.name.trim().charAt(0).toUpperCase()}</div>
          <div><small>{t('bookings.profile')}</small><h3>{user.name}</h3><p>{user.email} · {user.phone}</p></div>
        </section>
        <div className="booking-tabs" role="tablist" aria-label={t('bookings.history')}>
          {[['upcoming', 'bookings.upcoming'], ['past', 'bookings.past'], ['cancelled', 'bookings.cancelledTab']].map(([value, label]) => (
            <button type="button" role="tab" aria-selected={filter === value} className={filter === value ? 'active' : ''} key={value} onClick={() => setFilter(value)}>{t(label)}</button>
          ))}
        </div>
        {err && <div className="err" role="alert">{err}</div>}
        {busy && <div className="spinner" />}
        {!busy && !err && bookings.length === 0 && <div className="empty booking-empty"><p>{t(`bookings.empty${filter[0].toUpperCase()}${filter.slice(1)}`)}</p><button className="btn gold" onClick={onBook}>{t('bookings.bookBus')}</button></div>}
        {!busy && bookingGroups.map((group) => {
          const outbound = group.legs.find((leg) => leg.leg === 'outbound') || group.legs[0];
          const returnLeg = group.legs.find((leg) => leg.leg === 'return');
          const booking = outbound;
          const canCancelThis = (leg) => filter === 'upcoming' && leg.status === 'confirmed' && canCancel(leg);
          return (
            <article className="card booking-card fade" key={group.group_ref || booking.ref}>
              <div className="booking-card-head">
                <div>
                  <h3>{returnLeg
                    ? `${cityName(booking.from_city)} → ${cityName(booking.to_city)} · ${cityName(returnLeg.from_city)} → ${cityName(returnLeg.to_city)}`
                    : `${cityName(booking.from_city)} → ${cityName(booking.to_city)}`}</h3>
                  <small>{fmtDate(booking.depart_date)} · {fmtTime(booking.depart_time)}{returnLeg ? ` · ${t('bookings.return', { date: fmtDate(returnLeg.depart_date), time: fmtTime(returnLeg.depart_time) })}` : ` – ${fmtTime(booking.arrive_time)}`}</small>
                  {group.group_ref
                    ? <small>{t('bookings.groupRef', { ref: group.group_ref })} · {group.legs.map((leg) => `${leg.leg === 'outbound' ? t('ticket.outbound') : t('ticket.return')}: ${leg.ref}`).join(' · ')}</small>
                    : <small>{t('bookings.ref', { ref: booking.ref })}</small>}
                </div>
                <span className={'badge booking-status ' + (group.legs.every((leg) => leg.status === 'confirmed') ? 'gold' : '')}>{t(group.legs.every((leg) => leg.status === 'cancelled') ? 'bookings.cancelled' : 'bookings.confirmed')}</span>
              </div>
              <div className="booking-details">
                {group.legs.map((leg) => <div key={leg.ref}><small>{leg.leg ? t('bookings.legBus', { leg: leg.leg === 'outbound' ? t('ticket.outbound') : t('ticket.return') }) : t('bookings.bus')}</small><b>{leg.bus_name}</b><span>{leg.reg_no} · {busTypeName(leg.bus_type)} · {t('seats.seats')} {leg.seats.join(', ') || '—'}</span></div>)}
                <div><small>{t('bookings.total')}</small><b>{lkr(group.legs.reduce((total, leg) => total + Number(leg.total), 0))}</b></div>
              </div>
              <div className="booking-actions">
                <button className="btn" onClick={() => onOpenTicket(booking.ref)}>{t('bookings.viewTicket')}</button>
                {group.legs.map((leg) => filter === 'upcoming' && leg.status === 'confirmed' && (
                  <button className="btn ghost" key={leg.ref} disabled={!canCancelThis(leg) || cancelling === leg.ref} title={!canCancelThis(leg) ? t('bookings.cancelDeadline') : ''} onClick={() => cancel(leg)}>
                    {cancelling === leg.ref ? t('bookings.cancelling') : t('bookings.cancelLeg', { leg: leg.leg === 'outbound' ? t('ticket.outbound') : leg.leg === 'return' ? t('ticket.return') : t('ticket.cancelBooking') })}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div></div>
    </>
  );
}

/* ================= LIVE BUS TRACKING ================= */
function LiveTracking() {
  const { lang } = useLang();
  const mapElement = useRef(null);
  const mapRef = useRef(null);
  const routeLayerRef = useRef(null);
  const markersRef = useRef(new Map());
  const [buses, setBuses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [updatedAt, setUpdatedAt] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!window.L) {
      setErr('live.mapError');
      return;
    }

    const map = window.L.map(mapElement.current).setView([7.8731, 80.7718], 7);
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    const routes = window.L.layerGroup().addTo(map);
    mapRef.current = map;
    routeLayerRef.current = routes;
    const resizeMap = () => map.invalidateSize({ pan: false });
    const resizeObserver = window.ResizeObserver ? new ResizeObserver(resizeMap) : null;
    if (resizeObserver) resizeObserver.observe(mapElement.current);
    const resizeTimer = setTimeout(resizeMap, 150);

    let active = true;
    let timer;
    const refresh = async () => {
      try {
        const data = await get('live.php?demo=1');
        if (!active) return;
        setBuses(data.buses);
        setUpdatedAt(data.server_time);
        setErr('');
      } catch (e) {
        if (active) setErr('live.refreshError');
      } finally {
        if (active) timer = setTimeout(refresh, 5000);
      }
    };
    refresh();

    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(resizeTimer);
      if (resizeObserver) resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      routeLayerRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const routeLayer = routeLayerRef.current;
    if (!map || !routeLayer || !window.L) return;

    routeLayer.clearLayers();
    const activeIds = new Set(buses.map((bus) => String(bus.trip_id)));
    markersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    const routes = new Set();
    buses.forEach((bus) => {
      const routeKey = `${bus.from_city}|${bus.to_city}`;
      if (!routes.has(routeKey)) {
        routes.add(routeKey);
        window.L.polyline([bus.from, bus.to], { color: '#0b6342', weight: 3, opacity: 0.45, dashArray: '7 8' }).addTo(routeLayer);
      }

      const id = String(bus.trip_id);
      let marker = markersRef.current.get(id);
      const safe = (value) => String(value).replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      }[char]));
      const popup = `<b>${safe(bus.bus_name)}</b><br>${safe(cityName(bus.from_city))} → ${safe(cityName(bus.to_city))}<br>${safe(t('live.popupProgress', { progress: Math.round(bus.progress) }))}`;
      if (!marker) {
        marker = window.L.marker([bus.lat, bus.lng], {
          icon: window.L.divIcon({
            className: 'live-bus-icon',
            html: '<span>🚌</span>',
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          }),
        }).addTo(map).bindPopup(popup);
        markersRef.current.set(id, marker);
        marker.on('click', () => setSelectedId(Number(id)));
      } else {
        marker.setLatLng([bus.lat, bus.lng]);
        marker.setPopupContent(popup);
      }
    });
  }, [buses, lang]);

  const focusBus = (bus) => {
    setSelectedId(bus.trip_id);
    if (mapRef.current) mapRef.current.flyTo([bus.lat, bus.lng], 9, { duration: 0.8 });
    const marker = markersRef.current.get(String(bus.trip_id));
    if (marker) marker.openPopup();
  };

  return (
    <>
      <div className="page-head"><div className="container">
        <h2>{t('live.title')}</h2>
        <p>{t('live.intro')}</p>
      </div></div>
      <div className="page live-page"><div className="container">
        <div className="live-heading">
          <div><b><span className="live-dot" /> {t('live.demo')}</b><small>{t('live.updates')}</small></div>
          {updatedAt && <small>{t('live.lastUpdated', { time: fmtTime(updatedAt) })}</small>}
        </div>
        {err && <div className="err">{t(err)}</div>}
        <div className="live-layout">
          <div className="live-map panel" ref={mapElement} aria-label={t('live.mapLabel')} />
          <aside className="live-list panel">
            <h3>{t('live.moving')} <span>{buses.length}</span></h3>
            <div className="live-cards">
              {buses.length === 0 && !err && <p className="live-empty">{t('live.empty')}</p>}
              {buses.map((bus) => (
                <button type="button" className={'live-bus-card ' + (selectedId === bus.trip_id ? 'selected' : '')} key={bus.trip_id} onClick={() => focusBus(bus)}>
                  <span className="live-bus-emoji">🚌</span>
                  <span className="live-bus-info">
                    <b>{bus.bus_name}</b><small>{bus.reg_no} · {busTypeName(bus.bus_type)}</small>
                    <small>{cityName(bus.from_city)} → {cityName(bus.to_city)}</small>
                    <small>{t('live.eta', { progress: Math.round(bus.progress), minutes: bus.eta_min })}</small>
                  </span>
                </button>
              ))}
            </div>
          </aside>
        </div>
        <p className="live-disclaimer">{t('live.disclaimer')}</p>
      </div></div>
    </>
  );
}

/* ================= APP ================= */
function App() {
  const { lang } = useLang();
  const [page, setPage] = useState('home');
  const [user, setUser] = useState(null);
  const [cities, setCities] = useState([]);
  const [popular, setPopular] = useState([]);
  const [query, setQuery] = useState(null);
  const [roundTrip, setRoundTrip] = useState(null);
  const [tripId, setTripId] = useState(null);
  const [done, setDone] = useState(null);
  const [authReturn, setAuthReturn] = useState('bookings');
  const [keepSeatsMounted, setKeepSeatsMounted] = useState(false);
  const [ticketReturn, setTicketReturn] = useState('home');
  const [loadErr, setLoadErr] = useState('');

  useEffect(() => { get('cities.php').then((d) => { setCities(d.cities); setPopular(d.popular); }).catch((e) => setLoadErr(errorMessage(e))); }, []);
  useEffect(() => {
    get('me.php')
      .then((data) => setUser(data.user))
      .catch((e) => setLoadErr(errorMessage(e)));
  }, []);
  useEffect(() => {
    const titles = {
      home: t('title.home'),
      results: `TripLink | ${t('nav.routes')}`,
      seats: `TripLink | ${t('seats.chooseTitle')}`,
      roundConfirm: `TripLink | ${t('round.reviewTitle')}`,
      ticket: `TripLink | ${t('ticket.bookingRef')}`,
      manage: `TripLink | ${t('manage.title')}`,
      login: `TripLink | ${t('auth.login')}`,
      register: `TripLink | ${t('nav.signup')}`,
      bookings: `TripLink | ${t('bookings.title')}`,
      live: `TripLink | ${t('live.title')}`,
    };
    document.title = titles[page] || 'TripLink';
  }, [page, lang]);

  const go = useCallback((p, hash) => {
    setPage(p);
    setTimeout(() => {
      if (hash && hash !== 'top') { const el = document.getElementById(hash); el ? el.scrollIntoView({ behavior: 'smooth' }) : window.scrollTo(0, 0); }
      else window.scrollTo({ top: 0 });
    }, 50);
  }, []);
  const beginLogin = useCallback((returnTo) => {
    const destination = returnTo || (page === 'seats' ? 'seats' : 'bookings');
    setAuthReturn(destination);
    if (page === 'seats') setKeepSeatsMounted(true);
    go('login');
  }, [go, page]);
  const openBookings = useCallback(() => {
    if (user) go('bookings');
    else beginLogin('bookings');
  }, [beginLogin, go, user]);
  const handleLogout = useCallback(async () => {
    try {
      await post('logout.php', {});
      setUser(null);
      setKeepSeatsMounted(false);
      setLoadErr('');
      go('home');
    } catch (e) {
      setLoadErr(errorMessage(e));
    }
  }, [go]);
  const authSuccess = useCallback((authenticatedUser) => {
    setUser(authenticatedUser);
    setKeepSeatsMounted(false);
    go(authReturn || 'bookings');
  }, [authReturn, go]);
  const requireBookingsLogin = useCallback(() => beginLogin('bookings'), [beginLogin]);
  const search = (q) => {
    const isRoundTrip = q.tripMode === 'round';
    const { tripMode, returnDate, ...searchQuery } = q;
    setQuery(searchQuery);
    setTripId(null);
    setRoundTrip(isRoundTrip ? {
      returnDate,
      outboundQuery: searchQuery,
      outbound: null,
      return: null,
      stage: 'outboundResults',
    } : null);
    go('results');
  };
  const selectTrip = (id) => {
    setTripId(id);
    if (roundTrip && roundTrip.stage === 'outboundResults') setRoundTrip((current) => ({ ...current, stage: 'outboundSeats' }));
    else if (roundTrip && roundTrip.stage === 'returnResults') setRoundTrip((current) => ({ ...current, stage: 'returnSeats' }));
    go('seats');
  };
  const completeRoundLeg = (selection) => {
    if (!roundTrip) return;
    if (roundTrip.stage === 'outboundSeats') {
      setRoundTrip((current) => ({ ...current, outbound: selection, stage: 'returnResults' }));
      setQuery({ from: roundTrip.outboundQuery.to, to: roundTrip.outboundQuery.from, date: roundTrip.returnDate });
      go('results');
    } else if (roundTrip.stage === 'returnSeats') {
      setRoundTrip((current) => ({ ...current, return: selection, stage: 'confirm' }));
      go('roundConfirm');
    }
  };
  const changeOutbound = () => {
    if (!roundTrip) return;
    setRoundTrip((current) => ({ ...current, outbound: null, return: null, stage: 'outboundResults' }));
    setQuery(roundTrip.outboundQuery);
    go('results');
  };
  const backToRoundResults = () => {
    if (!roundTrip) return go('results');
    if (roundTrip.stage === 'returnSeats') setRoundTrip((current) => ({ ...current, stage: 'returnResults' }));
    else if (roundTrip.stage === 'outboundSeats') setRoundTrip((current) => ({ ...current, stage: 'outboundResults' }));
    else if (roundTrip.stage === 'confirm') setRoundTrip((current) => ({ ...current, stage: 'returnResults' }));
    go('results');
  };
  const openTicket = (ref) => {
    setDone({ ref, phone: '' });
    setTicketReturn('bookings');
    go('ticket');
  };
  const keepSeatPage = page === 'seats' || (keepSeatsMounted && (page === 'login' || page === 'register'));

  return (
    <>
      <Nav page={page} go={go} user={user} onLogin={() => beginLogin()} onLogout={handleLogout} onBookings={openBookings} />
      {loadErr && <div className="err" style={{ margin: '90px 20px 0' }}>{loadErr}</div>}
      {page === 'home' && <>
        <Hero cities={cities} onSearch={search} />
        <Features />
        <PopularRoutes popular={popular} cities={cities} onPick={search} />
        <How />
      </>}
      {page === 'results' && query && <Results
        query={query}
        cities={cities}
        roundTripStage={roundTrip && roundTrip.stage}
        outboundSelection={roundTrip && roundTrip.outbound}
        onChangeOutbound={changeOutbound}
        onBack={() => { setRoundTrip(null); go('home'); }}
        onSelect={selectTrip}
      />}
      {keepSeatPage && tripId && <div style={{ display: page === 'seats' ? 'block' : 'none' }}><Seats
        key={tripId}
        tripId={tripId}
        user={user}
        selectionMode={roundTrip && ['outboundSeats', 'returnSeats'].includes(roundTrip.stage) ? roundTrip.stage.replace('Seats', '') : 'oneway'}
        onLegSelected={completeRoundLeg}
        onLogin={() => beginLogin('seats')}
        onBack={roundTrip ? backToRoundResults : () => go('results')}
        onBooked={(d) => { setDone(d); setRoundTrip(null); setTicketReturn('home'); setKeepSeatsMounted(false); go('ticket'); }}
      /></div>}
      {page === 'roundConfirm' && roundTrip && roundTrip.outbound && roundTrip.return && <RoundTripConfirm
        outbound={roundTrip.outbound}
        returnLeg={roundTrip.return}
        user={user}
        onBack={backToRoundResults}
        onBooked={(d) => { setDone(d); setRoundTrip(null); setTicketReturn('home'); go('ticket'); }}
      />}
      {page === 'ticket' && done && <TicketPage ref_={done.ref} phone={done.phone} user={user} onHome={() => go(ticketReturn)} />}
      {page === 'manage' && <Manage />}
      {page === 'login' && <Auth mode="login" onMode={go} onSuccess={authSuccess} />}
      {page === 'register' && <Auth mode="register" onMode={go} onSuccess={authSuccess} />}
      {page === 'bookings' && user && <MyBookings user={user} onOpenTicket={openTicket} onBook={() => go('home', 'top')} onAuthRequired={requireBookingsLogin} />}
      {page === 'live' && <LiveTracking />}
      <Footer go={go} onBookings={openBookings} onLogin={() => beginLogin()} />
      <MobileTabs page={page} go={go} user={user} onLogin={() => beginLogin()} onBookings={openBookings} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<LangProvider><App /></LangProvider>);
