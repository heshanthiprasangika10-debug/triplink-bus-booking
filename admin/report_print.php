<?php
require __DIR__ . '/_helpers.php';
admin_require_login();

try {
    $input = admin_report_input();
    $report = admin_report_data(db(), $input);
} catch (Throwable $error) {
    http_response_code(400);
    $reportError = $error->getMessage();
}
function report_escape($value): string
{
    return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
}
?><!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= isset($report) ? report_escape($report['title']) : 'TripLink report' ?></title>
<style>
body{margin:0;padding:24px;color:#1d2c24;font:14px/1.5 Arial,sans-serif;background:#f3f7f4}.sheet{max-width:1180px;margin:auto;padding:28px;background:#fff;border:1px solid #dfe8e1;border-radius:12px}.brand{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #04301f;padding-bottom:16px;margin-bottom:20px}.brand img{height:42px}.brand h1{margin:0;color:#04301f;font-size:23px}.muted{color:#66776d}.actions{display:flex;gap:10px;margin-bottom:18px}.actions a,.actions button{min-height:40px;padding:8px 14px;border:0;border-radius:7px;color:#fff;background:#04301f;text-decoration:none;font:inherit;cursor:pointer}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:9px;border:1px solid #dce5de;text-align:left;overflow-wrap:anywhere}th{color:#fff;background:#0c5136}.error{padding:14px;border:1px solid #e8b6b6;border-radius:8px;color:#8d2929;background:#fff0f0}
@media print{body{padding:0;background:#fff}.sheet{max-width:none;padding:0;border:0;border-radius:0}.actions{display:none}thead{display:table-header-group}tr{break-inside:avoid}th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body><main class="sheet">
<header class="brand"><div><h1>TripLink · <?= isset($report) ? report_escape($report['title']) : 'Report' ?></h1><p class="muted"><?= isset($report['subtitle']) ? report_escape($report['subtitle']) : 'Date range: ' . report_escape($input['from'] ?? '') . ' – ' . report_escape($input['to'] ?? '') ?></p><small class="muted">Generated <?= date('Y-m-d H:i:s') ?> · Asia/Colombo</small></div><img src="../assets/img/logo.svg" alt="TripLink"></header>
<div class="actions"><button type="button" onclick="window.print()">Print / Save as PDF</button><a href="reports.php">Back to reports</a></div>
<?php if (isset($reportError)): ?><div class="error" role="alert"><?= report_escape($reportError) ?></div><?php else: ?>
<table><thead><tr><?php foreach ($report['headers'] as $header): ?><th><?= report_escape($header) ?></th><?php endforeach; ?></tr></thead><tbody>
<?php foreach ($report['rows'] as $row): ?><tr><?php foreach ($row as $cell): ?><td><?= report_escape($cell ?? '') ?></td><?php endforeach; ?></tr><?php endforeach; ?>
<?php if (!$report['rows']): ?><tr><td colspan="<?= count($report['headers']) ?>">No records for this report.</td></tr><?php endif; ?>
</tbody></table><?php endif; ?></main></body></html>
