<?php
require __DIR__ . '/_bootstrap.php';

admin_api_run(function (PDO $pdo): void {
    [$from, $to] = admin_api_range();
    $days = (int)(new DateTimeImmutable($from))->diff(new DateTimeImmutable($to))->days + 1;
    $previousTo = (new DateTimeImmutable($from))->modify('-1 day')->format('Y-m-d');
    $previousFrom = (new DateTimeImmutable($previousTo))->modify('-' . ($days - 1) . ' days')->format('Y-m-d');
    $current = admin_api_metrics($pdo, $from, $to);
    $previous = admin_api_metrics($pdo, $previousFrom, $previousTo);
    $changes = [];

    foreach ($current as $key => $value) {
        $before = (float)$previous[$key];
        $changes[$key] = $before === 0.0
            ? ($value === 0 || $value === 0.0 ? 0 : null)
            : (($value - $before) / abs($before)) * 100;
    }

    json_out([
        'from' => $from,
        'to' => $to,
        'previous_from' => $previousFrom,
        'previous_to' => $previousTo,
        'metrics' => $current,
        'changes' => $changes,
    ]);
});
