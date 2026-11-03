<?php
function admin_page_start(string $csrfToken, string $title = 'Dashboard', string $active = 'dashboard', bool $dashboardAssets = true): void
{
    $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    ?>
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta name="theme-color" content="#04301f">
      <title>TripLink Admin · <?= $safeTitle ?></title>
      <link rel="stylesheet" href="../assets/css/style.css">
      <link rel="stylesheet" href="admin.css">
      <?php if ($dashboardAssets): ?>
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.8/dist/chart.umd.min.js" defer></script>
        <script src="dashboard.js" defer></script>
      <?php endif; ?>
    </head>
    <body class="admin-body">
      <div class="admin-shell">
        <aside class="admin-sidebar">
          <a class="admin-brand" href="index.php"><img src="../assets/img/logo.svg" alt="TripLink"></a>
          <nav aria-label="Admin navigation">
            <a class="<?= $active === 'dashboard' ? 'active' : '' ?>" href="index.php#dashboard">Dashboard</a>
            <a href="index.php#bookings">Bookings</a>
            <span class="admin-nav-heading">MANAGEMENT</span>
            <a class="<?= $active === 'buses' ? 'active' : '' ?>" href="manage.php?section=buses">Buses</a>
            <a class="<?= $active === 'routes' || $active === 'cities' ? 'active' : '' ?>" href="manage.php?section=routes">Routes & Cities</a>
            <a class="<?= $active === 'schedules' ? 'active' : '' ?>" href="manage.php?section=schedules">Schedules</a>
            <a class="<?= $active === 'trips' ? 'active' : '' ?>" href="manage.php?section=trips">Trips</a>
            <a class="<?= $active === 'reports' ? 'active' : '' ?>" href="reports.php">Reports</a>
            <a class="<?= $active === 'audit' ? 'active' : '' ?>" href="manage.php?section=audit">Audit log</a>
            <button type="button" disabled>Staff <small>Phase 3</small></button>
            <button type="button" disabled>Tracking <small>Phase 4</small></button>
          </nav>
          <p class="admin-sidebar-note">TripLink operations</p>
        </aside>
        <main class="admin-main">
          <header class="admin-topbar">
            <div>
              <button type="button" class="admin-menu-toggle" aria-label="Open admin navigation" aria-expanded="false">☰</button>
              <div><span class="admin-eyebrow">TRIPLINK ADMIN</span><h1><?= $safeTitle ?></h1></div>
            </div>
            <form method="post" class="admin-logout">
              <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
              <input type="hidden" name="logout" value="1">
              <button type="submit">Log out</button>
            </form>
          </header>
          <div class="admin-content">
    <?php
}

function admin_page_end(): void
{
    $contactEmail = htmlspecialchars(SITE_CONTACT_EMAIL, ENT_QUOTES, 'UTF-8');
    $contactPhone = htmlspecialchars(SITE_CONTACT_PHONE['display'], ENT_QUOTES, 'UTF-8');
    $contactTel = htmlspecialchars(SITE_CONTACT_PHONE['tel'], ENT_QUOTES, 'UTF-8');
    ?>
          </div>
          <footer class="admin-contact-footer">
            <a href="mailto:<?= $contactEmail ?>?subject=TripLink%20enquiry" aria-label="Email TripLink">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m3 7 9 6 9-6"></path></svg>
              <span><?= $contactEmail ?></span>
            </a>
            <a href="tel:<?= $contactTel ?>" aria-label="Call TripLink">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3H5a2 2 0 0 0-2 2c0 8.84 7.16 16 16 16a2 2 0 0 0 2-2v-2l-5-2-2 3a14 14 0 0 1-7-7l3-2-2-5H7Z"></path></svg>
              <span><?= $contactPhone ?></span>
            </a>
          </footer>
        </main>
      </div>
      <div class="admin-sidebar-backdrop" hidden></div>
    </body>
    </html>
    <?php
}
