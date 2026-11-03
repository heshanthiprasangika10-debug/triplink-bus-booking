<?php
require __DIR__ . '/_helpers.php';
admin_require_login();

try {
    $input = admin_report_input();
    $report = admin_report_data(db(), $input);
    $fileName = 'triplink-' . preg_replace('/[^a-z0-9-]+/i', '-', strtolower($report['title'])) . '-' . date('Ymd-His') . '.csv';
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $fileName . '"');
    header('Cache-Control: no-store');
    $output = fopen('php://output', 'wb');
    if ($output === false) throw new RuntimeException('Could not open CSV output stream.');
    fwrite($output, "\xEF\xBB\xBF");
    fputcsv($output, array_map('admin_csv_cell', $report['headers']));
    foreach ($report['rows'] as $row) {
        fputcsv($output, array_map('admin_csv_cell', $row));
    }
    fclose($output);
} catch (Throwable $error) {
    error_log('TripLink CSV export error: ' . $error->getMessage());
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo htmlspecialchars($error->getMessage(), ENT_QUOTES, 'UTF-8');
}
