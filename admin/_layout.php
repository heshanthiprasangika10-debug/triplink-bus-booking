<?php
function admin_page_start(string $csrfToken): void
{
    ?>
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta name="theme-color" content="#04301f">
      <title>TripLink Admin Dashboard</title>
      <link rel="stylesheet" href="../assets/css/style.css">
      <link rel="stylesheet" href="admin.css">
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.8/dist/chart.umd.min.js" defer></script>
      <script src="dashboard.js" defer></script>
    </head>
    <body class="admin-body">
      <div class="admin-shell">
        <aside class="admin-sidebar">
          <a class="admin-brand" href="index.php"><img src="../assets/img/logo.svg" alt="TripLink"></a>
          <nav aria-label="Admin navigation">
            <a class="active" href="#dashboard">Dashboard</a>
            <a href="#bookings">Bookings</a>
            <span class="admin-nav-heading">MANAGEMENT</span>
            <button type="button" disabled>Buses <small>Phase 2</small></button>
            <button type="button" disabled>Routes <small>Phase 2</small></button>
            <button type="button" disabled>Schedules <small>Phase 2</small></button>
            <button type="button" disabled>Trips <small>Phase 2</small></button>
            <button type="button" disabled>Reports <small>Phase 2</small></button>
            <button type="button" disabled>Staff <small>Phase 3</small></button>
            <button type="button" disabled>Tracking <small>Phase 4</small></button>
          </nav>
          <p class="admin-sidebar-note">TripLink operations</p>
        </aside>
        <main class="admin-main">
          <header class="admin-topbar">
            <div>
              <button type="button" class="admin-menu-toggle" aria-label="Open admin navigation" aria-expanded="false">☰</button>
              <div><span class="admin-eyebrow">OVERVIEW</span><h1>Dashboard</h1></div>
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
    ?>
          </div>
        </main>
      </div>
      <div class="admin-sidebar-backdrop" hidden></div>
    </body>
    </html>
    <?php
}
