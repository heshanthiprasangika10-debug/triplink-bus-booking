# TripLink 🚌 — Sri Lanka Bus Seat Booking

PHP + MySQL (API) · React (frontend) · HTML/CSS

## Run karanna (WAMP / XAMPP)
1. `triplink` folder eka web root ekata damanna (`C:\wamp64\www\` for WAMP, `C:\xampp\htdocs\` for XAMPP)
2. WAMP/XAMPP eke **Apache** + **MySQL** start karanna
3. Fresh install ekak nam phpMyAdmin eke `api/config.php` wala `DB_NAME` ekata saman database ekak create/select karala **Import** → `database.sql` select karala Go. Existing database ekak nam `database.sql` import karanna epa; eya tables drop karanawa.
4. `api/config.php` eke DB user/password check karanna (WAMP/XAMPP default: root / empty)
5. Browser eke: **http://localhost/triplink/**
6. Admin panel: http://localhost/triplink/admin/ (password: `triplink123`, `api/config.php` eke maru karanna)

> Internet connection ona (React, Google Fonts CDN walin load wenawa).

## Author / Contact
- Email: [heshanthiprasangika10@gmail.com](mailto:heshanthiprasangika10@gmail.com?subject=TripLink%20enquiry)
- Phone: [+94 76 66 94 397](tel:+94766694397)
- Address: Matara, Sri Lanka
- Map: 5.9549, 80.5550 (TripLink Office; update `address`, `lat`, `lng`, `zoom`, and `placeName` in the `CONTACT` object near the top of `assets/js/app.jsx` for your real office location.)

### Existing database schema updates
Select the `triplink_db` database in phpMyAdmin and run these safe-to-repeat update files in order: `database_update_admin_management.sql`, `database_update_users.sql`, `database_update_round_trip.sql`, then `database_update_admin_analytics.sql`. Do not import `database.sql` into an existing installation because it drops and recreates TripLink tables. To diagnose a local setup, open `http://localhost/triplink/api/health.php`; it is restricted to localhost or a logged-in admin. API exception details are logged to the PHP error log; set `DEBUG` to `true` in `api/config.php` only during local debugging, then return it to `false`.

### Passenger accounts setup
phpMyAdmin eke TripLink database eka select karala **Import** → `database_update_users.sql` → **Go** click karanna. Me update eka existing bookings/data makanne naha; safely nawatha run karanna puluwan.

### Passenger profile photos
Select the existing application database in phpMyAdmin and run `database_update_avatar.sql` (it is safe to rerun). Ensure Apache can write to `assets/uploads/avatars/` under the project folder. In WAMP's active `php.ini`, set `upload_max_filesize = 6M`, `post_max_size = 8M`, and `memory_limit = 256M`, then restart Apache so PHP can accept the full 5 MB application limit and process large images. Signed-in passengers can manage a profile photo from the account menu; images are validated and re-encoded as metadata-free 512 × 512 JPEGs with 128 × 128 thumbnails. The upload directory blocks script execution and is excluded from Git except for its protection and placeholder files.

## Hero photos
The current hero placeholders are `hero1.jpg` (6000 × 4000), `hero2.jpg` (6000 × 4000), `hero3.jpg` (6000 × 4000), and `hero4.jpg` (5472 × 3648); replace these placeholder pictures with images you own or that are licensed. The site discovers `hero*.jpg`, `.jpeg`, `.png`, and `.webp` files in `assets/img/` (up to eight, sorted by name), and `api/hero_images.php` adds file-modification cache versions and creates progressive JPEG copies no wider than 1920 pixels for large files in `assets/img/optimized/`. Edit the `HERO_SLIDES` metadata near the top of `assets/js/app.jsx` to customize each known photo's alt text, focus point, overlay and SVG fallback; unlisted filenames receive a generic description and focus. The SVG fallbacks remain in place. The first photo is preloaded from the dynamic image list; remaining slides are loaded when the browser is idle, and the slider changes every five seconds.

## Folder structure
```
triplink/
├── index.html            # React entry
├── database.sql          # tables + sample data
├── api/                  # PHP REST API (cities, search, seats, live tracking, booking)
├── admin/index.php       # admin: bookings list, revenue, cancel
└── assets/{css,js,img}   # style.css, app.jsx, logo + hero images
```

## Features
- Route search, live seat map (2+2 layout), up to 6 seats
- Double booking block (UNIQUE key + DB transaction)
- E-ticket with QR code, print/PDF
- Find / cancel booking using reference + phone (cancel up to 2h before)
- Admin dashboard
- Daily trips auto-generate from `schedules` table (next 30 days)
- Live bus tracking demo with simulated positions (not real GPS)
- Passenger registration/login and account booking history; guest bookings still supported

## Account API endpoints
- `POST api/register.php`, `POST api/login.php`, `POST api/logout.php`, `GET api/me.php`
- `GET api/my_bookings.php?filter=upcoming|past|cancelled`
- Existing `api/book.php`, `api/booking.php` and `api/cancel.php` support both guest and account bookings.

> Live tracking uses Leaflet and OpenStreetMap tiles from CDNs, so an internet connection is required.

### View switcher
The floating right-edge switcher changes the public site between **Mobile version**, **Web version**, or **Auto (recommended)** (long-press the button for Auto). Its choice is stored as `triplink-view` in local storage; a valid `?view=mobile`, `?view=desktop`, or `?view=auto` URL parameter takes precedence. On phones, Web mode sets the viewport width to 1200 so the regular desktop media queries apply; on wider devices, Mobile mode opens the same-origin site in a centred 390px iframe (`?view=mobile&embedded=1`). Embedded booking, login, language settings and maps therefore continue using the same origin and session. The early `assets/js/viewmode.js` script applies the selection before first paint; no build tooling or service worker is required.

### Round-trip bookings
Select **Round trip** in the home search, choose a return date, and complete both bus/seat selections before confirming the shared passenger details. Round trips create two booking references linked by a group reference; the outbound and return seats are committed together, so a seat conflict on either leg rolls back both.

For an existing installation, select the TripLink database in phpMyAdmin and import `database_update_round_trip.sql`. The migration adds the grouping columns and converts `trips`, `bookings`, and `booking_seats` to InnoDB when needed, so both seat inserts can be rolled back together. Fresh installs already use InnoDB and include the round-trip booking columns in `database.sql`. The endpoint is `POST api/book_round.php`.

To verify, search a route with a return date, select outbound seats, choose a return bus, then confirm. Open the ticket/manage page using either leg reference; both ticket legs and the combined amount should be shown. Try the same-day option with an outbound arrival later than the return departure; that return bus must be rejected. Ordinary one-way booking remains unchanged.

### Languages
TripLink supports English, Sinhala and Tamil. Use the **EN | සිං | த** control in the navigation; your choice is saved in this browser. Check the home page, search filters, seats, ticket, account pages and live tracking after switching languages. Add `?i18n=debug` to the URL to check translation coverage in the browser console.

### Admin analytics dashboard
The admin dashboard includes date-filtered KPIs and Chart.js reports for revenue, routes, occupancy, booking weekdays and bus types. On an existing installation, select the TripLink database in phpMyAdmin and import `database_update_admin_analytics.sql` once; it safely adds the analytics indexes if they are missing. Fresh installs already include those indexes in `database.sql`. Chart.js is loaded from a CDN, so the admin charts require an internet connection.

To verify, open `http://localhost/triplink/admin/`, sign in, and try Today, Last 7 days, Last 30 days, This month and Custom ranges. Compare chart data with the data-table toggles, use PNG downloads, and test search/status filters and pagination under Recent bookings. Confirm a booking cancellation still frees its seats. Dashboard analytics endpoints are `admin/api/stats_kpis.php`, `stats_revenue.php`, `stats_routes.php` and `stats_occupancy.php`; they require the admin session.

### Admin management and reports
For an existing installation, select the TripLink database in phpMyAdmin and import `database_update_admin_management.sql`. It adds admin entity status/timestamps, city coordinates, trip cancellation status, a unique bus-registration index, and the admin audit table without dropping existing data. If it reports duplicate bus registration numbers, resolve those duplicates first, then import again. Fresh installs already have these fields and tables in `database.sql`.

The admin menu now includes Buses, Routes & Cities, Schedules, Trips, Reports and Audit log. Changes use CSRF-protected POST forms and are recorded in the audit log. Schedule edits update/remove only future trips with no booking rows; trips with bookings are retained. Cancelling a trip keeps its booking/seat history, and passenger notifications are not configured. Reports provide filtered booking, revenue, occupancy, bus and schedule CSV exports, plus a trip passenger manifest; use **Print / Save PDF** and choose “Save as PDF” in the browser.

To verify, import the migration first, then open `http://localhost/triplink/admin/`. Try creating/editing/deactivating a bus, route, city and schedule; test that overlapping schedules are refused and booked trips are preserved. Generate trips, cancel and restore one, then check Audit log and export a CSV/manifest. Existing booking/search pages should hide cancelled trips while preserving their booking records.

## Test on mobile
Open `http://localhost/triplink/` in your browser and use DevTools' device toolbar at 375–430px (phones), 768px (tablet), and 1366px (desktop). Check that the navigation drawer opens/closes, route search and seat selection fit the viewport, and the fixed bottom tabs/seat confirmation bar do not cover content. The site includes a lightweight install manifest; no service worker or API caching is used.

## Next ideas
Live bus map (Leaflet), real payments (PayHere), SMS (Notify.lk), JWT user login, Vite + React Router migration.
