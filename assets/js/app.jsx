const { useState, useEffect, useRef, useCallback } = React;
const CONTACT = {
  email: 'heshanthiprasangika10@gmail.com',
  phoneDisplay: '+94 76 66 94 397',
  phoneTel: '+94766694397',
  whatsapp: '94766694397',
  hours: '6:00 AM - 10:00 PM',
  // CHANGE THESE to your real office address / coordinates
  address: 'Matara, Sri Lanka',
  lat: 5.9549,
  lng: 80.5550,
  zoom: 15,
  placeName: 'TripLink Office',
};
const LangContext = React.createContext(null);
const LocationContext = React.createContext(() => {});
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

function ContactIcon({ type }) {
  const paths = {
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    phone: <path d="M7 3H5a2 2 0 0 0-2 2c0 8.84 7.16 16 16 16a2 2 0 0 0 2-2v-2l-5-2-2 3a14 14 0 0 1-7-7l3-2-2-5H7Z" />,
    whatsapp: <><path d="M20.5 11.6a8.6 8.6 0 0 1-12.7 7.5L3 20l.9-4.6a8.6 8.6 0 1 1 16.6-3.8Z" /><path d="M8.2 7.8c.3-.6.7-.6 1-.6h.5c.2 0 .4.1.5.4l.8 1.8c.1.2.1.4 0 .6l-.6.8c-.2.2-.2.4 0 .6.5.9 1.3 1.7 2.2 2.2.2.1.4.1.6-.1l.8-1c.2-.2.4-.2.6-.1l1.8.8c.3.1.4.3.4.5 0 .3-.1 1-.6 1.4-.5.5-1.2.8-2 .7-1.1-.1-2.5-.7-4-2-1.3-1.1-2.2-2.5-2.5-3.5-.3-1.1.1-2 .5-2.5Z" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  };
  return <svg className={`contact-icon contact-icon-${type}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]}</svg>;
}

function LocationLink({ className = '' }) {
  const openLocation = React.useContext(LocationContext);
  return (
    <button type="button" className={`location-link ${className}`.trim()} onClick={(event) => openLocation(event.currentTarget)} aria-label={t('location.showMap')}>
      <ContactIcon type="pin" /><span>{CONTACT.address}</span>
    </button>
  );
}

function LocationModal({ open, onClose, triggerRef }) {
  const mapNode = useRef(null);
  const mapRef = useRef(null);
  const [mapError, setMapError] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${CONTACT.lat},${CONTACT.lng}`;
  const searchUrl = `https://www.google.com/maps/search/?api=1&query=${CONTACT.lat},${CONTACT.lng}`;

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = mapNode.current && mapNode.current.closest('[role="dialog"]');
    const focusable = () => dialog
      ? Array.from(dialog.querySelectorAll('a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])')).filter((item) => item.offsetParent !== null)
      : [];
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const focusFrame = window.requestAnimationFrame(() => {
      const closeButton = dialog && dialog.querySelector('.location-close');
      if (closeButton) closeButton.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      window.cancelAnimationFrame(focusFrame);
      window.clearTimeout(copyTimer.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (triggerRef.current && triggerRef.current.isConnected) triggerRef.current.focus();
    };
  }, [open, onClose, triggerRef]);

  useEffect(() => {
    if (!open || !mapNode.current) return undefined;
    if (!window.L) {
      setMapError(true);
      return undefined;
    }
    setMapError(false);
    let map;
    let resizeTimer;
    let frame;
    try {
      map = window.L.map(mapNode.current, { scrollWheelZoom: false, zoomControl: true })
        .setView([CONTACT.lat, CONTACT.lng], CONTACT.zoom);
      mapRef.current = map;
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
      }).addTo(map);
      const icon = window.L.divIcon({
        className: 'triplink-location-marker',
        html: '<span class="triplink-location-pin"><svg viewBox="0 0 32 40" aria-hidden="true"><path d="M16 1C7.7 1 1 7.7 1 16c0 10.1 15 23 15 23s15-12.9 15-23C31 7.7 24.3 1 16 1Z" fill="#f2b632" stroke="#04301f" stroke-width="2"/><rect x="7.5" y="12" width="17" height="12" rx="2" fill="#04301f"/><path d="M10 10h12l2 3H8l2-3Zm-.5 8h13M10 24v2m12-2v2" fill="none" stroke="#f2b632" stroke-width="1.5"/><circle cx="11" cy="24" r="1.5" fill="#fff"/><circle cx="21" cy="24" r="1.5" fill="#fff"/></svg></span>',
        iconSize: [42, 52],
        iconAnchor: [21, 48],
        popupAnchor: [0, -44],
      });
      const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      }[char]));
      window.L.marker([CONTACT.lat, CONTACT.lng], { icon }).addTo(map)
        .bindPopup(`<strong>${escapeHtml(CONTACT.placeName)}</strong><br>${escapeHtml(CONTACT.address)}`)
        .openPopup();
      map.on('click', () => map.scrollWheelZoom.enable());
      frame = window.requestAnimationFrame(() => {
        resizeTimer = window.setTimeout(() => {
          if (mapRef.current === map) map.invalidateSize();
        }, 120);
      });
    } catch (error) {
      if (map) map.remove();
      mapRef.current = null;
      setMapError(true);
    }
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(resizeTimer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [open]);

  if (!open) return null;
  const copyAddress = async () => {
    let success = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(CONTACT.address);
        success = true;
      } catch (error) {
        success = false;
      }
    }
    if (!success) {
      let field;
      try {
        field = document.createElement('textarea');
        field.value = CONTACT.address;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        success = document.execCommand('copy');
      } catch (error) {
        success = false;
      } finally {
        if (field && field.parentNode) field.parentNode.removeChild(field);
      }
    }
    if (success) {
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1800);
    }
  };
  return (
    <div className="location-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="location-dialog" role="dialog" aria-modal="true" aria-labelledby="location-dialog-title">
        <div className="location-dialog-head">
          <div><h2 id="location-dialog-title">{t('location.title')}</h2><p>{CONTACT.address}</p></div>
          <button type="button" className="location-close" onClick={onClose} aria-label={t('location.close')}>×</button>
        </div>
        {!mapError
          ? <div ref={mapNode} className="location-map" role="application" aria-label={t('location.mapLabel')} />
          : <div className="location-map-fallback"><ContactIcon type="pin" /><span>{CONTACT.address}</span><a href={searchUrl} target="_blank" rel="noopener noreferrer">{t('location.openMaps')}</a></div>}
        <div className="location-actions">
          <a className="btn gold" href={directionsUrl} target="_blank" rel="noopener noreferrer">{t('location.directions')}</a>
          <a className="btn ghost" href={searchUrl} target="_blank" rel="noopener noreferrer">{t('location.openMaps')}</a>
          <button type="button" className="btn ghost location-copy" onClick={copyAddress}>{t(copied ? 'location.copied' : 'location.copyAddress')}</button>
        </div>
        {copied && <span className="location-copy-toast" role="status" aria-live="polite">{t('location.copied')}</span>}
      </section>
    </div>
  );
}

function CopyContactButton({ value, item }) {
  const [message, setMessage] = useState('');
  const timer = useRef(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async () => {
    let copied = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        copied = true;
      } catch (error) {
        copied = false;
      }
    }
    if (!copied) {
      let field;
      try {
        field = document.createElement('textarea');
        field.value = value;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        copied = document.execCommand('copy');
      } catch (error) {
        copied = false;
      } finally {
        if (field && field.parentNode) field.parentNode.removeChild(field);
      }
    }
    setMessage(t(copied ? 'contact.copied' : 'contact.copyFailed'));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(''), 1800);
  };
  return (
    <span className="contact-copy-wrap">
      <button type="button" className="contact-copy" onClick={copy} aria-label={t('contact.copy', { item })}>{t('contact.copyAction')}</button>
      {message && <span className="contact-copy-toast" role="status" aria-live="polite">{message}</span>}
    </span>
  );
}

function ContactHelp() {
  return (
    <div className="contact-help no-print">
      <b>{t('contact.needHelp')}</b>
      <a href={`tel:${CONTACT.phoneTel}`} aria-label={t('contact.callAria')}><ContactIcon type="phone" />{CONTACT.phoneDisplay}</a>
      <a href={`mailto:${CONTACT.email}?subject=TripLink%20enquiry`} aria-label={t('contact.emailAria')}><ContactIcon type="mail" />{CONTACT.email}</a>
      <a className="contact-whatsapp-link" href={`https://wa.me/${CONTACT.whatsapp}?text=Hi%20TripLink%2C%20I%20need%20help%20with%20my%20booking`} target="_blank" rel="noopener noreferrer" aria-label={t('contact.whatsappAria')}><ContactIcon type="whatsapp" />{t('contact.whatsappUs')}</a>
      <LocationLink />
    </div>
  );
}

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

function useViewMode() {
  const [view, setView] = useState(() => window.TripLinkView.get());
  const [mode, setMode] = useState(() => window.TripLinkView.getMode());
  useEffect(() => window.TripLinkView.onChange((change) => {
    setView(change.effective);
    setMode(change.mode);
  }), []);
  return { view, mode };
}

function ViewSwitcher() {
  const { view, mode } = useViewMode();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => {
    try {
      const seen = window.localStorage.getItem('triplink-view-switcher-seen') === '1';
      if (!seen) window.localStorage.setItem('triplink-view-switcher-seen', '1');
      return !seen;
    } catch (error) {
      return true;
    }
  });
  const [toast, setToast] = useState('');
  const longPress = useRef(false);
  const pressTimer = useRef(null);
  const hideTimer = useRef(null);
  const firstShownAt = useRef(Date.now());
  const wrapper = useRef(null);

  const keepVisible = useCallback((duration) => {
    window.clearTimeout(hideTimer.current);
    setExpanded(true);
    try {
      window.localStorage.setItem('triplink-view-switcher-seen', '1');
    } catch (error) {
      // The control remains usable when storage is disabled.
    }
    hideTimer.current = window.setTimeout(() => {
      if (!open && wrapper.current && !wrapper.current.matches(':hover, :focus-within')) setExpanded(false);
    }, duration);
  }, [open]);

  useEffect(() => {
    const firstVisit = expanded;
    const remaining = Math.max(0, 6000 - (Date.now() - firstShownAt.current));
    hideTimer.current = window.setTimeout(() => {
      if (firstVisit && !wrapper.current?.matches(':hover, :focus-within')) setExpanded(false);
      else if (!firstVisit) setExpanded(false);
    }, firstVisit ? remaining : 0);
    return () => window.clearTimeout(hideTimer.current);
  }, []);

  useEffect(() => {
    const unsubscribe = window.TripLinkView.onChange((change) => {
      if (change.source === 'user') {
        setToast(change.mode === 'auto'
          ? t('view.autoToast')
          : t(change.effective === 'mobile' ? 'view.mobileToast' : 'view.desktopToast'));
        window.setTimeout(() => setToast(''), 2400);
        keepVisible(4000);
      } else if (change.source === 'frame-error') {
        setToast(t('view.frameFallback'));
        window.setTimeout(() => setToast(''), 4000);
      }
    });
    return () => {
      unsubscribe();
      window.clearTimeout(hideTimer.current);
      window.clearTimeout(pressTimer.current);
    };
  }, [keepVisible]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event) => {
      if (wrapper.current && !wrapper.current.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        wrapper.current?.querySelector('.view-switcher-toggle')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  if (new URLSearchParams(window.location.search).get('embedded') === '1') return null;

  const targetMode = view === 'mobile' ? 'desktop' : 'mobile';
  const targetLabel = t(targetMode === 'mobile' ? 'view.mobileVersion' : 'view.webVersion');
  const icon = view === 'mobile'
    ? <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4M7 8h10" /></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M10 5h4m-4 14h4" /></svg>;

  const beginPress = () => {
    longPress.current = false;
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      longPress.current = true;
      setOpen(true);
      keepVisible(4000);
    }, 550);
  };
  const endPress = () => window.clearTimeout(pressTimer.current);
  const toggleView = () => {
    if (longPress.current) {
      longPress.current = false;
      return;
    }
    window.TripLinkView.set(targetMode);
  };

  return (
    <div
      className={`view-switcher${expanded || open ? '' : ' is-collapsed'}`}
      data-mode={view}
      ref={wrapper}
      onPointerEnter={() => { setExpanded(true); window.clearTimeout(hideTimer.current); }}
      onPointerLeave={() => keepVisible(4000)}
      onFocus={() => { setExpanded(true); window.clearTimeout(hideTimer.current); }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) keepVisible(4000); }}
    >
      <button
        type="button"
        className="view-switcher-toggle"
        aria-label={t(targetMode === 'mobile' ? 'view.switchToMobile' : 'view.switchToWeb')}
        aria-pressed={view === 'mobile'}
        aria-haspopup="menu"
        aria-expanded={open}
        title={targetLabel}
        onPointerDown={beginPress}
        onPointerUp={endPress}
        onPointerCancel={endPress}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || (event.altKey && event.key === 'ArrowDown')) {
            event.preventDefault();
            setOpen(true);
            keepVisible(4000);
            window.setTimeout(() => wrapper.current?.querySelector('[role="menuitem"]')?.focus(), 0);
          }
        }}
        onContextMenu={(event) => { event.preventDefault(); setOpen(true); keepVisible(4000); }}
        onClick={toggleView}
      >
        <span className="view-switcher-icon">{icon}</span>
        <span className="view-switcher-tooltip">{targetLabel}</span>
      </button>
      {open && <div className="view-switcher-menu" role="menu" aria-label={t('view.menuLabel')}>
        <button type="button" role="menuitem" onClick={() => { setOpen(false); window.TripLinkView.set('auto'); }}>
          {t('view.auto')}
        </button>
      </div>}
      {toast && <div className="view-switcher-toast" role="status" aria-live="polite">{toast}</div>}
    </div>
  );
}

/* ================= CONFIG ================= */
const API = 'api/';
const HERO_SLIDES = [
  { src: 'assets/img/hero1.jpg', fallback: 'assets/img/hero1.svg', focus: '72% 58%', alt: 'Blue city bus in busy urban traffic', overlay: { start: '.98', mid: '.88', end: '.62' } },
  { src: 'assets/img/hero2.jpg', fallback: 'assets/img/hero2.svg', focus: '34% 55%', alt: 'Green city bus among urban traffic', overlay: { start: '.97', mid: '.86', end: '.60' } },
  { src: 'assets/img/hero3.jpg', fallback: 'assets/img/hero3.svg', focus: '43% 54%', alt: 'Green bus moving through a city street', overlay: { start: '.97', mid: '.85', end: '.58' } },
  { src: 'assets/img/hero4.jpg', fallback: 'assets/img/hero4.svg', focus: '70% 54%', alt: 'White city bus on an urban street', overlay: { start: '.99', mid: '.90', end: '.66' } },
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
  if (error && error.data && error.data.debug_message) return error.data.debug_message;
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

function initialsForName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => Array.from(part)[0] || '').join('').toLocaleUpperCase();
}

function Avatar({ user, size = 40, className = '', onClick, ariaLabel, editBadge = false }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [useFullImage, setUseFullImage] = useState(false);
  const fullPhotoUrl = user && user.avatar_url;
  const thumbnailUrl = size <= 40 && user && user.avatar_thumb_url;
  const photoUrl = thumbnailUrl && !useFullImage ? thumbnailUrl : fullPhotoUrl;
  useEffect(() => {
    setImageFailed(false);
    setUseFullImage(false);
  }, [fullPhotoUrl, thumbnailUrl]);
  const name = user && user.name || '';
  let colorHash = 0;
  for (const character of name) colorHash = (colorHash * 31 + character.codePointAt(0)) >>> 0;
  const color = `hsl(${colorHash % 360} 48% 34%)`;
  const content = (
    <>
      {photoUrl && !imageFailed
        ? <img src={photoUrl} alt="" loading="lazy" decoding="async" onError={() => {
          if (thumbnailUrl && !useFullImage) setUseFullImage(true);
          else setImageFailed(true);
        }} />
        : <span aria-hidden="true">{(user && user.initials) || initialsForName(name) || '?'}</span>}
      {editBadge && <i className="avatar-edit-badge" aria-hidden="true">✎</i>}
    </>
  );
  const style = { width: size, height: size, '--avatar-color': color };
  return onClick
    ? <button type="button" className={`avatar ${className}`.trim()} style={style} onClick={onClick} aria-label={ariaLabel}>{content}</button>
    : <span className={`avatar ${className}`.trim()} style={style} aria-label={ariaLabel}>{content}</span>;
}

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
                <button className="nav-account-name" aria-expanded={userMenu} onClick={() => setUserMenu(!userMenu)}><Avatar user={user} size={32} className="avatar-nav" /><span>{user.name.split(/\s+/)[0]}</span><span aria-hidden="true">▾</span></button>
                {userMenu && <div className="nav-account-menu">
                  <button onClick={() => nav('profile')}>{t('nav.profile')}</button>
                  <button onClick={() => { setOpen(false); setUserMenu(false); onLogout(); }}>{t('nav.logout')}</button>
                </div>}
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
function Hero({ cities, destinations, onSearch }) {
  const [idx, setIdx] = useState(0);
  const [slides, setSlides] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showAllDestinations, setShowAllDestinations] = useState(false);
  const [date, setDate] = useState(todayStr());
  const [tripMode, setTripMode] = useState('oneway');
  const [returnDate, setReturnDate] = useState(todayStr());
  const [err, setErr] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);

  useEffect(() => {
    let cancelled = false;
    const config = window.TripLinkHeroSlidesPromise || Promise.resolve(null);
    config.then((remoteSlides) => {
      if (cancelled) return;
      const sourceSlides = Array.isArray(remoteSlides) && remoteSlides.length
        ? remoteSlides
        : HERO_SLIDES;
      setSlides(sourceSlides.map((slide) => ({
        ...slide,
        overlay: slide.overlay || { start: '.97', mid: '.84', end: '.58' },
        displaySrc: slide.src,
        naturalWidth: 0,
        naturalHeight: 0,
        fit: 'cover',
        ready: false,
      })));
      setIdx(0);
    });
    return () => { cancelled = true; };
  }, []);

  const slideSignature = slides.map((slide) => slide.src).join('|');
  useEffect(() => {
    if (!slides.length) return undefined;
    let cancelled = false;
    let idleHandle;
    let timeoutHandle;
    const loadSlide = (index) => {
      const slide = slides[index];
      if (!slide) return;
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        if (cancelled) return;
        const naturalWidth = image.naturalWidth || 0;
        setSlides((current) => current.map((item, itemIndex) => itemIndex === index
          && item.src === slide.src
          ? {
            ...item, displaySrc: slide.src, naturalWidth, naturalHeight: image.naturalHeight || 0,
            fit: naturalWidth >= 900 ? 'cover' : 'contain', ready: true,
          }
          : item));
      };
      image.onerror = () => {
        if (cancelled) return;
        setSlides((current) => current.map((item, itemIndex) => itemIndex === index
          && item.src === slide.src
          ? { ...item, displaySrc: slide.fallback, naturalWidth: 0, naturalHeight: 0, fit: 'cover', ready: true }
          : item));
      };
      image.src = slide.src;
    };

    loadSlide(0);
    const loadRemaining = () => slides.slice(1).forEach((_, offset) => loadSlide(offset + 1));
    if (window.requestIdleCallback) idleHandle = window.requestIdleCallback(loadRemaining, { timeout: 2500 });
    else timeoutHandle = window.setTimeout(loadRemaining, 800);
    return () => {
      cancelled = true;
      if (idleHandle !== undefined && window.cancelIdleCallback) window.cancelIdleCallback(idleHandle);
      window.clearTimeout(timeoutHandle);
    };
  }, [slideSignature]);

  useEffect(() => {
    const updateVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    if (searchFocused || !pageVisible || slides.length < 2) return undefined;
    const timer = window.setInterval(() => {
      const searchForm = document.querySelector('#top .search');
      if (document.hidden || (searchForm && searchForm.contains(document.activeElement))) return;
      setIdx((current) => (current + 1) % slides.length);
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [searchFocused, pageVisible, slides.length]);

  const useFallback = (index) => {
    setSlides((current) => current.map((slide, slideIndex) => slideIndex === index && slide.displaySrc !== slide.fallback
      ? { ...slide, displaySrc: slide.fallback, naturalWidth: 0, naturalHeight: 0, fit: 'cover', ready: true }
      : slide));
  };
  const swipeStart = (event) => {
    if (event.target instanceof Element && event.target.closest('.search')) return;
    if (event.touches[0]) event.currentTarget.dataset.touchStartX = event.touches[0].clientX;
  };
  const swipeEnd = (event) => {
    if (event.target instanceof Element && event.target.closest('.search')) return;
    const start = Number(event.currentTarget.dataset.touchStartX);
    const end = event.changedTouches[0] && event.changedTouches[0].clientX;
    if (Number.isFinite(start) && Number.isFinite(end) && Math.abs(end - start) > 48) {
      setIdx((current) => slides.length
        ? (current + (end < start ? 1 : slides.length - 1)) % slides.length
        : current);
    }
    delete event.currentTarget.dataset.touchStartX;
  };

  const submit = (e) => {
    e.preventDefault();
    if (!from || !to) return setErr(t('home.errCities'));
    if (from === to) return setErr(t('home.errSameCity'));
    if (tripMode === 'round' && returnDate < date) return setErr(t('home.errReturnDate'));
    setErr(''); onSearch({ from, to, date, tripMode, returnDate });
  };
  const availableDestinations = (origin) => (destinations && destinations[String(origin)]) || [];
  const hasRoute = (origin, destination) => availableDestinations(origin).some((id) => String(id) === String(destination));
  const destinationOptions = from && !showAllDestinations
    ? cities.filter((city) => availableDestinations(from).some((id) => String(id) === String(city.id)))
    : cities;
  const changeFrom = (nextFrom) => {
    setFrom(nextFrom);
    if (!showAllDestinations && to && !hasRoute(nextFrom, to)) setTo('');
  };
  const toggleAllDestinations = () => {
    if (showAllDestinations && !hasRoute(from, to)) setTo('');
    setShowAllDestinations((current) => !current);
  };
  const swap = () => {
    if (!hasRoute(to, from)) setShowAllDestinations(true);
    setFrom(to);
    setTo(from);
  };

  return (
    <section className="hero" id="top" onTouchStart={swipeStart} onTouchEnd={swipeEnd}>
      {slides.map((slide, i) => (
        <div key={slide.src} className={'slide ' + (i === idx ? 'on' : '')} aria-hidden={i !== idx} style={{
          '--slide-focus': slide.focus,
          '--overlay-start': slide.overlay.start,
          '--overlay-mid': slide.overlay.mid,
          '--overlay-end': slide.overlay.end,
        }}>
          <div className="slide-backdrop" aria-hidden="true" style={{ backgroundImage: `url("${slide.displaySrc}")`, '--slide-focus': slide.focus }} />
          <div className="slide-image-wrap" data-fit={slide.fit} style={{ '--slide-focus': slide.focus, '--natural-width': `${slide.naturalWidth}px` }}>
            <img
              className={'slide-photo ' + (slide.ready ? 'ready' : '')}
              src={slide.displaySrc}
              alt={slide.alt}
              aria-label={slide.alt}
              decoding="async"
              width={slide.naturalWidth || 1600}
              height={slide.naturalHeight || 900}
              onError={() => useFallback(i)}
            />
          </div>
        </div>
      ))}
      <div className="container fade">
        <h1>{t('home.title1')}<br /><span>{t('home.title2')}</span></h1>
        <p className="sub">{t('home.subtitle')}</p>

        <form
          className={'search ' + (tripMode === 'round' ? 'round-trip-search' : '')}
          onSubmit={submit}
          onFocusCapture={() => setSearchFocused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setSearchFocused(false);
          }}
        >
          <div className="search-mode" role="group" aria-label={t('home.tripType')}>
            <button type="button" className={tripMode === 'oneway' ? 'active' : ''} aria-pressed={tripMode === 'oneway'} onClick={() => setTripMode('oneway')}>{t('home.oneWay')}</button>
            <button type="button" className={tripMode === 'round' ? 'active' : ''} aria-pressed={tripMode === 'round'} onClick={() => setTripMode('round')}>{t('home.roundTrip')}</button>
          </div>
          <div className="field search-from">
            <label>{t('home.from')}</label>
            <select value={from} onChange={(e) => changeFrom(e.target.value)}>
              <option value="">{t('home.pickup')}</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{cityName(c.name)}</option>)}
            </select>
          </div>
          <button type="button" className="swap search-swap" onClick={swap} title={t('home.swapAria')} aria-label={t('home.swapAria')}>⇄ <span>{t('home.swap')}</span></button>
          <div className="field search-to">
            <label>{t('home.to')}</label>
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">{t('home.destination')}</option>
              {destinationOptions.map((c) => <option key={c.id} value={c.id}>{cityName(c.name)}</option>)}
            </select>
            {from && <button type="button" className="text-link destination-fallback" onClick={toggleAllDestinations}>
              {t(showAllDestinations ? 'home.showRouteDestinations' : 'home.showAllDestinations')}
            </button>}
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
        {slides.map((slide, i) => <button type="button" key={slide.src} className={i === idx ? 'on' : ''} aria-current={i === idx ? 'true' : undefined} onClick={() => setIdx(i)} aria-label={t('home.slide', { number: i + 1 })} />)}
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

function ContactSection() {
  return (
    <section className="block contact-section" id="contact">
      <div className="container">
        <div className="title">
          <small>{t('contact.eyebrow')}</small>
          <h2>{t('contact.title')}</h2>
          <p>{t('contact.intro')}</p>
        </div>
        <div className="contact-actions">
          <a className="contact-action contact-action-call" href={`tel:${CONTACT.phoneTel}`} aria-label={t('contact.callAria')}>
            <ContactIcon type="phone" /><span>{t('contact.callUs')}</span><b>{CONTACT.phoneDisplay}</b>
          </a>
          <a className="contact-action contact-action-whatsapp" href={`https://wa.me/${CONTACT.whatsapp}?text=Hi%20TripLink%2C%20I%20need%20help%20with%20my%20booking`} target="_blank" rel="noopener noreferrer" aria-label={t('contact.whatsappAria')}>
            <ContactIcon type="whatsapp" /><span>{t('contact.whatsappUs')}</span><b>{t('contact.messageInstantly')}</b>
          </a>
          <a className="contact-action contact-action-email" href={`mailto:${CONTACT.email}?subject=TripLink%20enquiry`} aria-label={t('contact.emailAria')}>
            <ContactIcon type="mail" /><span>{t('contact.emailUs')}</span><b>{CONTACT.email}</b>
          </a>
        </div>
        <p className="contact-hours">{t('contact.hours', { hours: CONTACT.hours })}</p>
        <LocationLink className="contact-section-location" />
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
          <div className="footer-contact"><h4>{t('footer.contact')}</h4><ul>
            <li className="footer-contact-row">
              <a className="contact-link" href={`tel:${CONTACT.phoneTel}`} aria-label={t('contact.callAria')}><ContactIcon type="phone" /><span>{CONTACT.phoneDisplay}</span></a>
              <CopyContactButton value={CONTACT.phoneTel} item={t('contact.phone')} />
              <a className="contact-whatsapp-icon" href={`https://wa.me/${CONTACT.whatsapp}?text=Hi%20TripLink%2C%20I%20need%20help%20with%20my%20booking`} target="_blank" rel="noopener noreferrer" aria-label={t('contact.whatsappAria')}><ContactIcon type="whatsapp" /></a>
            </li>
            <li className="footer-contact-row">
              <a className="contact-link" href={`mailto:${CONTACT.email}?subject=TripLink%20enquiry`} aria-label={t('contact.emailAria')}><ContactIcon type="mail" /><span>{CONTACT.email}</span></a>
              <CopyContactButton value={CONTACT.email} item={t('contact.email')} />
            </li>
            <li><LocationLink className="footer-location" /></li>
          </ul></div>
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

function Results({ query, cities, onSelect, onSearch, onBack, roundTripStage, outboundSelection, onChangeOutbound }) {
  const [trips, setTrips] = useState(null);
  const [searchInfo, setSearchInfo] = useState(null);
  const [err, setErr] = useState('');
  const filterIdentity = `${query.from}:${query.to}:${query.date}`;
  const [filters, setFilters] = useState(() => loadResultFilters(filterIdentity));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef(null);
  const filterTriggerRef = useRef(null);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const name = (id) => cityName((cities.find((c) => String(c.id) === String(id)) || {}).name || '');

  useEffect(() => {
    setTrips(null); setSearchInfo(null); setErr('');
    let active = true;
    get(`search.php?from=${query.from}&to=${query.to}&date=${query.date}`)
      .then((d) => {
        if (!active) return;
        setSearchInfo(d);
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
        {trips && trips.length === 0 && !err && searchInfo && searchInfo.route_exists === false && <div className="empty route-empty">
          <h3>{t('results.noDirectRoute')}</h3>
          <div className="route-suggestions">
            {searchInfo.suggestions && searchInfo.suggestions.reverse && <button type="button" className="btn ghost" onClick={() => onSearch({
              from: searchInfo.suggestions.reverse.from_id,
              to: searchInfo.suggestions.reverse.to_id,
              date: query.date,
            })}>{t('results.reverseRoute', { route: `${cityName(searchInfo.suggestions.reverse.from_city)} → ${cityName(searchInfo.suggestions.reverse.to_city)}` })}</button>}
            {searchInfo.suggestions && searchInfo.suggestions.from_origin && searchInfo.suggestions.from_origin.length > 0 && <>
              <h4>{t('results.originRoutes', { city: name(query.from) })}</h4>
              {searchInfo.suggestions.from_origin.map((route) => <button type="button" className="btn ghost" key={`${route.from_id}:${route.to_id}`} onClick={() => onSearch({
                from: route.from_id,
                to: route.to_id,
                date: query.date,
              })}>{cityName(route.from_city)} → {cityName(route.to_city)}</button>)}
            </>}
            {searchInfo.suggestions && searchInfo.suggestions.via_colombo && <button type="button" className="btn gold" onClick={() => onSearch({
              from: searchInfo.suggestions.via_colombo.from_id,
              to: searchInfo.suggestions.via_colombo.via_id,
              date: query.date,
            })}>{t('results.viaColombo', {
              first: `${cityName(searchInfo.suggestions.via_colombo.from_city)} → ${cityName(searchInfo.suggestions.via_colombo.via_city)}`,
              second: `${cityName(searchInfo.suggestions.via_colombo.via_city)} → ${cityName(searchInfo.suggestions.via_colombo.to_city)}`,
            })}</button>}
          </div>
        </div>}
        {trips && trips.length === 0 && !err && searchInfo && searchInfo.route_exists !== false && <div className="empty">{t('results.noBuses')}</div>}
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
              ? <p className="booking-account-note booking-account-user"><Avatar user={user} size={28} className="avatar-booking" /><span>{t('seats.bookingAs', { name: user.name })}</span></p>
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
          {user ? <p className="booking-account-note booking-account-user"><Avatar user={user} size={28} className="avatar-booking" /><span>{t('seats.bookingAs', { name: user.name })}</span></p> : <p className="booking-account-note">{t('round.guestNote')}</p>}
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
      <ContactHelp />
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
        <ContactHelp />
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

function AvatarCropper({ src, zoom, rotation, onReady, onZoomChange }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const dragRef = useRef(null);
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imageReady, setImageReady] = useState(false);

  useEffect(() => {
    let active = true;
    setImageReady(false);
    setOffset({ x: 0, y: 0 });
    const image = new Image();
    image.onload = () => {
      if (active) {
        imageRef.current = image;
        setImageReady(true);
        if (onReady) onReady();
      }
    };
    image.src = src;
    return () => {
      active = false;
      imageRef.current = null;
    };
  }, [src, onReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const radians = rotation * Math.PI / 180;
    const sourceMax = Math.min(image.naturalWidth, image.naturalHeight);
    const scale = 512 / sourceMax * zoom;
    const rotatedWidth = (Math.abs(image.naturalWidth * Math.cos(radians)) + Math.abs(image.naturalHeight * Math.sin(radians))) * scale;
    const rotatedHeight = (Math.abs(image.naturalWidth * Math.sin(radians)) + Math.abs(image.naturalHeight * Math.cos(radians))) * scale;
    const maxX = Math.max(0, (rotatedWidth - 512) / 2);
    const maxY = Math.max(0, (rotatedHeight - 512) / 2);
    const safeOffset = {
      x: Math.max(-maxX, Math.min(maxX, offset.x)),
      y: Math.max(-maxY, Math.min(maxY, offset.y)),
    };
    if (safeOffset.x !== offset.x || safeOffset.y !== offset.y) setOffset(safeOffset);
    context.clearRect(0, 0, 512, 512);
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 512, 512);
    context.save();
    context.translate(256 + safeOffset.x, 256 + safeOffset.y);
    context.rotate(radians);
    context.scale(scale, scale);
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    context.restore();
  }, [src, zoom, rotation, offset, imageReady]);

  const pointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2) {
      const points = Array.from(pointersRef.current.values()).slice(0, 2);
      pinchRef.current = {
        distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
        zoom,
      };
      dragRef.current = null;
    } else {
      dragRef.current = { x: event.clientX, y: event.clientY };
    }
  };
  const pointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const points = Array.from(pointersRef.current.values()).slice(0, 2);
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      if (pinchRef.current.distance > 0) {
        onZoomChange(Math.max(1, Math.min(3, pinchRef.current.zoom * distance / pinchRef.current.distance)));
      }
      return;
    }
    if (!dragRef.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const factor = 512 / Math.max(1, bounds.width);
    const dx = (event.clientX - dragRef.current.x) * factor;
    const dy = (event.clientY - dragRef.current.y) * factor;
    dragRef.current = { x: event.clientX, y: event.clientY };
    setOffset((current) => ({ x: current.x + dx, y: current.y + dy }));
  };
  const pointerEnd = (event) => {
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = null;
    if (pointersRef.current.size === 1) {
      const point = pointersRef.current.values().next().value;
      dragRef.current = { x: point.x, y: point.y };
    } else {
      dragRef.current = null;
    }
  };
  return <canvas
    ref={canvasRef}
    className="avatar-crop-canvas"
    width="512"
    height="512"
    role="img"
    aria-label={t('profile.cropTitle')}
    onPointerDown={pointerDown}
    onPointerMove={pointerMove}
    onPointerUp={pointerEnd}
    onPointerCancel={pointerEnd}
  />;
}

function MyProfile({ user, onUserUpdated, onBack }) {
  const [cropSrc, setCropSrc] = useState('');
  const [cropOpen, setCropOpen] = useState(false);
  const [cropReady, setCropReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);
  const inputRef = useRef(null);
  const modalRef = useRef(null);
  const pickerTriggerRef = useRef(null);
  const toastTimer = useRef(null);
  const busyRef = useRef(false);
  busyRef.current = busy;

  useEffect(() => () => {
    window.clearTimeout(toastTimer.current);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
  }, [cropSrc]);

  useEffect(() => {
    if (!cropOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusables = () => Array.from(modalRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled)'))
      .filter((element) => element.offsetParent !== null);
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault();
        setCropOpen(false);
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !modalRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !modalRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const frame = window.requestAnimationFrame(() => modalRef.current?.querySelector('.avatar-crop-close')?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      window.cancelAnimationFrame(frame);
      if (pickerTriggerRef.current) pickerTriggerRef.current.focus();
    };
  }, [cropOpen]);

  const showMessage = (text, isError = false) => {
    setMessage(text);
    setMessageError(isError);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setMessage(''), 2600);
  };
  const handleCropReady = useCallback(() => setCropReady(true), []);

  const openPicker = (event, input) => {
    pickerTriggerRef.current = event.currentTarget;
    input.current?.click();
  };

  const chooseFile = (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showMessage(t('api.avatarUnsupportedType'), true);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showMessage(t('api.avatarTooLarge'), true);
      return;
    }
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(URL.createObjectURL(file));
    setZoom(1);
    setRotation(0);
    setCropReady(false);
    setCropOpen(true);
    if (inputRef.current) inputRef.current.value = '';
  };

  const uploadCrop = () => {
    const canvas = modalRef.current && modalRef.current.querySelector('.avatar-crop-canvas');
    if (!canvas) return;
    setBusy(true);
    setProgress(0);
    canvas.toBlob((blob) => {
      if (!blob) {
        setBusy(false);
        showMessage(t('api.avatarUploadFailed'), true);
        return;
      }
      const formData = new FormData();
      formData.append('avatar', blob, 'profile.jpg');
      const request = new XMLHttpRequest();
      request.open('POST', API + 'avatar_upload.php');
      request.withCredentials = true;
      request.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100));
      };
      request.onload = () => {
        let data;
        try { data = JSON.parse(request.responseText); } catch (error) { data = null; }
        if (request.status >= 200 && request.status < 300 && data && data.user) {
          onUserUpdated(data.user);
          setCropOpen(false);
          showMessage(t('profile.saved'));
        } else {
          if (data && data.user) {
            onUserUpdated(data.user);
            setCropOpen(false);
          }
          const failure = new Error(data && data.error || t('api.avatarUploadFailed'));
          failure.data = data;
          failure.status = request.status;
          showMessage(request.status === 401 ? t('api.avatarLoginRequired') : errorMessage(failure), true);
        }
        setBusy(false);
      };
      request.onerror = () => {
        setBusy(false);
        showMessage(t('api.avatarUploadFailed'), true);
      };
      request.onabort = () => {
        setBusy(false);
        showMessage(t('api.avatarUploadFailed'), true);
      };
      request.send(formData);
    }, 'image/jpeg', 0.9);
  };

  const removePhoto = async () => {
    if (!user.avatar_url || !window.confirm(t('profile.removeConfirm'))) return;
    setBusy(true);
    try {
      const request = await fetch(API + 'avatar_delete.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      const data = await request.json();
      if (!request.ok || !data.user) {
        if (data.user) onUserUpdated(data.user);
        const failure = new Error(data.error || t('api.avatarDeleteFailed'));
        failure.data = data;
        failure.status = request.status;
        throw failure;
      }
      onUserUpdated(data.user);
      showMessage(t('profile.removed'));
    } catch (error) {
      showMessage(error.status === 401 ? t('api.avatarLoginRequired') : errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };

  const dragOver = (event) => event.preventDefault();
  const dropFile = (event) => {
    event.preventDefault();
    chooseFile(event.dataTransfer.files && event.dataTransfer.files[0]);
  };

  return (
    <>
      <div className="page-head"><div className="container">
        <button type="button" className="back" onClick={onBack}>{t('profile.back')}</button>
        <h2>{t('profile.title')}</h2>
        <p>{t('profile.intro')}</p>
      </div></div>
      <div className="page profile-page"><div className="container">
        <section className="panel profile-editor" onDragOver={dragOver} onDrop={dropFile}>
          <div className="profile-editor-avatar">
            <Avatar user={user} size={120} className="avatar-profile-large" onClick={(event) => openPicker(event, inputRef)} ariaLabel={t('profile.editAvatar')} editBadge />
          </div>
          <div className="profile-editor-details">
            <h3>{user.name}</h3><p>{user.email}</p><p>{user.phone}</p>
            <div className="profile-editor-actions">
              <button type="button" className="btn gold" onClick={(event) => openPicker(event, inputRef)} disabled={busy}>{t(user.avatar_url ? 'profile.changePhoto' : 'profile.uploadPhoto')}</button>
              <button type="button" className="btn ghost" onClick={(event) => {
                pickerTriggerRef.current = event.currentTarget;
                document.getElementById('avatar-camera-input')?.click();
              }} disabled={busy}>{t('profile.takePhoto')}</button>
              {user.avatar_url && <button type="button" className="btn ghost avatar-remove" onClick={removePhoto} disabled={busy}>{t('profile.removePhoto')}</button>}
            </div>
            <div className="avatar-drop-hint"><b>{t('profile.dropTitle')}</b><span>{t('profile.dropHint')}</span></div>
          </div>
          <input ref={inputRef} className="avatar-file-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label={t('profile.uploadPhoto')} onChange={(event) => chooseFile(event.target.files && event.target.files[0])} />
          <input id="avatar-camera-input" className="avatar-file-input" type="file" accept="image/jpeg,image/png,image/webp" capture="user" aria-label={t('profile.takePhoto')} onChange={(event) => chooseFile(event.target.files && event.target.files[0])} />
        </section>
      </div></div>
      {message && <div className={`avatar-toast${messageError ? ' is-error' : ''}`} role={messageError ? 'alert' : 'status'}>{message}</div>}
      {cropOpen && <div className="avatar-crop-backdrop" onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) setCropOpen(false);
      }}>
        <section className="avatar-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title" ref={modalRef}>
          <button type="button" className="avatar-crop-close" aria-label={t('profile.cancel')} onClick={() => !busy && setCropOpen(false)} disabled={busy}>×</button>
          <h2 id="avatar-crop-title">{t('profile.cropTitle')}</h2>
          <div className="avatar-crop-window"><AvatarCropper src={cropSrc} zoom={zoom} rotation={rotation} onReady={handleCropReady} onZoomChange={setZoom} /></div>
          <label className="avatar-zoom-control">{t('profile.zoom')}
            <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} disabled={busy} />
          </label>
          <div className="avatar-crop-actions">
            <button type="button" className="btn ghost" onClick={() => setRotation((current) => (current + 90) % 360)} disabled={busy}>{t('profile.rotate')}</button>
            <button type="button" className="btn ghost" onClick={() => setCropOpen(false)} disabled={busy}>{t('profile.cancel')}</button>
            <button type="button" className="btn gold" onClick={uploadCrop} disabled={busy || !cropReady}>{busy ? t('profile.progress', { percent: progress }) : t('profile.save')}</button>
          </div>
          {busy && <progress className="avatar-upload-progress" max="100" value={progress} aria-label={t('profile.uploading')} />}
        </section>
      </div>}
    </>
  );
}

/* ================= PASSENGER BOOKING HISTORY ================= */
function MyBookings({ user, onOpenTicket, onBook, onAuthRequired, onEditProfile }) {
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
          <Avatar user={user} size={72} className="avatar-profile-bookings" onClick={onEditProfile} ariaLabel={t('profile.editAvatar')} editBadge />
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
  const [locationOpen, setLocationOpen] = useState(false);
  const locationTrigger = useRef(null);
  const [user, setUser] = useState(null);
  const [cities, setCities] = useState([]);
  const [popular, setPopular] = useState([]);
  const [destinations, setDestinations] = useState({});
  const [query, setQuery] = useState(null);
  const [roundTrip, setRoundTrip] = useState(null);
  const [tripId, setTripId] = useState(null);
  const [done, setDone] = useState(null);
  const [authReturn, setAuthReturn] = useState('bookings');
  const [keepSeatsMounted, setKeepSeatsMounted] = useState(false);
  const [ticketReturn, setTicketReturn] = useState('home');
  const [loadErr, setLoadErr] = useState('');
  const openLocation = useCallback((trigger) => {
    locationTrigger.current = trigger;
    setLocationOpen(true);
  }, []);
  const closeLocation = useCallback(() => setLocationOpen(false), []);

  useEffect(() => { get('cities.php').then((d) => { setCities(d.cities); setPopular(d.popular); setDestinations(d.destinations || {}); }).catch((e) => setLoadErr(errorMessage(e))); }, []);
  useEffect(() => {
    get('me.php')
      .then((data) => setUser(data.user))
      .catch((e) => setLoadErr(errorMessage(e)));
  }, []);
  useEffect(() => {
    const titles = {
      home: t('title.home'),
      results: `TripLink | ${t('nav.routes')}`,
      profile: `TripLink | ${t('profile.title')}`,
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
    <LocationContext.Provider value={openLocation}>
    <>
      <Nav page={page} go={go} user={user} onLogin={() => beginLogin()} onLogout={handleLogout} onBookings={openBookings} />
      {loadErr && <div className="err" style={{ margin: '90px 20px 0' }}>{loadErr}</div>}
      {page === 'home' && <>
        <Hero cities={cities} destinations={destinations} onSearch={search} />
        <Features />
        <PopularRoutes popular={popular} cities={cities} onPick={search} />
        <How />
        <ContactSection />
      </>}
      {page === 'results' && query && <Results
        query={query}
        cities={cities}
        onSearch={search}
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
      {page === 'profile' && user && <MyProfile user={user} onUserUpdated={setUser} onBack={() => go('bookings')} />}
      {page === 'login' && <Auth mode="login" onMode={go} onSuccess={authSuccess} />}
      {page === 'register' && <Auth mode="register" onMode={go} onSuccess={authSuccess} />}
      {page === 'bookings' && user && <MyBookings user={user} onOpenTicket={openTicket} onBook={() => go('home', 'top')} onAuthRequired={requireBookingsLogin} onEditProfile={() => go('profile')} />}
      {page === 'live' && <LiveTracking />}
      <Footer go={go} onBookings={openBookings} onLogin={() => beginLogin()} />
      <MobileTabs page={page} go={go} user={user} onLogin={() => beginLogin()} onBookings={openBookings} />
      <LocationModal open={locationOpen} onClose={closeLocation} triggerRef={locationTrigger} />
    </>
    </LocationContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<LangProvider><App /></LangProvider>);
ReactDOM.createRoot(document.getElementById('view-switcher-root')).render(<ViewSwitcher />);
