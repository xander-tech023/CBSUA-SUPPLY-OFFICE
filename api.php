<?php
declare(strict_types=1);

require_once __DIR__ . '/db_config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
ini_set('session.use_strict_mode', '1');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'httponly' => true,
    'samesite' => 'Lax'
]);
session_start();

function respond(array $body, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function requestBody(): array
{
    $body = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($body)) {
        respond(['ok' => false, 'error' => 'A valid JSON request body is required.'], 400);
    }
    return $body;
}

function requireUser(): array
{
    if (!isset($_SESSION['user']) || !is_array($_SESSION['user'])) {
        respond(['ok' => false, 'error' => 'Please sign in again.'], 401);
    }
    return $_SESSION['user'];
}

function logLogin(mysqli $db, ?int $userId, string $username, string $role, bool $success, ?string $reason): void
{
    $ipAddress = substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
    $attemptedUsername = substr($username, 0, 100);
    $successValue = $success ? 1 : 0;
    $statement = $db->prepare(
        'INSERT INTO login_logs (user_id, username_attempted, role_attempted, success, failure_reason, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $statement->bind_param('ississ', $userId, $attemptedUsername, $role, $successValue, $reason, $ipAddress);
    $statement->execute();
}

function quantityFrom($value): int
{
    if (is_int($value) && $value > 0) {
        return $value;
    }
    if (is_string($value) && preg_match('/^\s*(\d+)/', $value, $match)) {
        $quantity = (int) $match[1];
        return $quantity > 0 ? $quantity : 0;
    }
    return 0;
}

function positiveInteger($value): int
{
    if (is_int($value) && $value > 0) {
        return $value;
    }
    if (is_string($value) && preg_match('/^\d+$/D', trim($value))) {
        $quantity = (int) trim($value);
        return $quantity > 0 ? $quantity : 0;
    }
    return 0;
}

function requiredText(array $record, string $field, string $label): string
{
    $value = trim((string) ($record[$field] ?? ''));
    if ($value === '') {
        throw new InvalidArgumentException($label . ' is required.');
    }
    return $value;
}

function cleanDate($value, string $label, bool $allowEmpty = true): ?string
{
    $value = trim((string) $value);
    if ($value === '' && $allowEmpty) {
        return null;
    }
    $date = DateTime::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) {
        throw new InvalidArgumentException('Enter a valid ' . $label . '.');
    }
    return $value;
}

function itemRow(mysqli $db, string $id, bool $lock = false): ?array
{
    $sql = 'SELECT i.*, i.expiry_date AS expiry, s.name AS supplier_name FROM inventory_items i
            LEFT JOIN suppliers s ON s.id = i.supplier_id WHERE i.id = ?'
        . ($lock ? ' FOR UPDATE' : '');
    $statement = $db->prepare($sql);
    $statement->bind_param('s', $id);
    $statement->execute();
    return $statement->get_result()->fetch_assoc() ?: null;
}

function supplierIdByName(mysqli $db, string $name): ?string
{
    if ($name === '') {
        return null;
    }
    $statement = $db->prepare('SELECT id FROM suppliers WHERE name = ?');
    $statement->bind_param('s', $name);
    $statement->execute();
    $row = $statement->get_result()->fetch_assoc();
    if (!$row) {
        throw new InvalidArgumentException('Choose a supplier that exists in the Suppliers list.');
    }
    return $row['id'];
}

function itemStatus(array $item): string
{
    $quantity = (int) $item['quantity'];
    if ($quantity <= 0) {
        return 'Out of stock';
    }
    if (!empty($item['expiry'])) {
        $expiry = strtotime($item['expiry']);
        if ($expiry !== false && $expiry - strtotime(date('Y-m-d')) <= 45 * 86400) {
            return 'Expiring soon';
        }
    }
    return $quantity <= (int) $item['minimum'] ? 'Low stock' : 'In stock';
}

function readRecords(mysqli $db): array
{
    $records = ['items' => [], 'requests' => [], 'suppliers' => [], 'receipts' => [], 'issuances' => []];
    $result = $db->query(
        'SELECT i.*, i.expiry_date AS expiry, s.name AS supplier_name FROM inventory_items i
         LEFT JOIN suppliers s ON s.id = i.supplier_id ORDER BY i.id'
    );
    while ($row = $result->fetch_assoc()) {
        $records['items'][] = [
            'id' => $row['id'], 'name' => $row['name'], 'description' => $row['description'] ?? '',
            'category' => $row['category'] ?? '', 'quantity' => (int) $row['quantity'], 'unit' => $row['unit'],
            'supplier' => $row['supplier_name'] ?? '', 'minimum' => (int) $row['minimum'],
            'expiry' => $row['expiry'], 'status' => itemStatus($row),
            'createdAt' => $row['created_at'], 'updatedAt' => $row['updated_at']
        ];
    }
    $result = $db->query(
        'SELECT r.*, i.name AS item_name, i.unit AS item_unit, u.full_name AS reviewer_name
         FROM stock_requests r JOIN inventory_items i ON i.id = r.item_id
         LEFT JOIN users u ON u.id = r.reviewed_by ORDER BY r.created_at, r.id'
    );
    while ($row = $result->fetch_assoc()) {
        $records['requests'][] = [
            'id' => $row['id'], 'date' => $row['requested_date'], 'office' => $row['office'],
            'recipient' => $row['recipient'], 'employeeId' => $row['employee_id'] ?? '',
            'item' => $row['item_name'] . ' (' . $row['item_id'] . ')', 'itemId' => $row['item_id'],
            'quantity' => $row['quantity'] . ' ' . $row['item_unit'], 'status' => $row['status'],
            'reviewedBy' => $row['reviewer_name'] ?? '', 'reviewedAt' => $row['reviewed_at'],
            'remarks' => $row['remarks'] ?? '', 'createdAt' => $row['created_at']
        ];
    }
    $result = $db->query(
        'SELECT s.*,
          (SELECT COUNT(*) FROM inventory_items i WHERE i.supplier_id = s.id) AS item_count,
          (SELECT COUNT(*) FROM stock_receipts r WHERE r.supplier_id = s.id) AS delivery_count
         FROM suppliers s ORDER BY s.id'
    );
    while ($row = $result->fetch_assoc()) {
        $records['suppliers'][] = [
            'id' => $row['id'], 'name' => $row['name'], 'category' => $row['category'] ?? '',
            'contact' => $row['contact'] ?? '', 'phone' => $row['phone'] ?? '',
            'email' => $row['email'] ?? '', 'address' => $row['address'] ?? '',
            'items' => (int) $row['item_count'], 'deliveries' => (int) $row['delivery_count'],
            'createdAt' => $row['created_at']
        ];
    }
    $result = $db->query(
        'SELECT r.*, i.name AS item_name, i.unit AS item_unit, s.name AS supplier_name,
                u.full_name AS receiver_name
         FROM stock_receipts r JOIN inventory_items i ON i.id = r.item_id
         LEFT JOIN suppliers s ON s.id = r.supplier_id
         LEFT JOIN users u ON u.id = r.received_by ORDER BY r.created_at, r.id'
    );
    while ($row = $result->fetch_assoc()) {
        $records['receipts'][] = [
            'id' => $row['id'], 'itemId' => $row['item_id'], 'itemName' => $row['item_name'],
            'quantity' => (int) $row['quantity'], 'unit' => $row['item_unit'],
            'supplier' => $row['supplier_name'] ?? '', 'supplierId' => $row['supplier_id'],
            'receivedBy' => $row['receiver_name'] ?? '', 'receivedDate' => $row['received_date'],
            'deliveryReference' => $row['delivery_reference'] ?? '', 'batchNumber' => $row['batch_number'] ?? '',
            'expiryDate' => $row['expiry_date'] ?? null, 'remarks' => $row['remarks'] ?? '',
            'attachmentName' => $row['attachment_name'] ?? '', 'createdAt' => $row['created_at']
        ];
    }
    $result = $db->query(
        'SELECT x.*, i.name AS item_name, i.unit AS item_unit,
                r.employee_id AS request_employee_id, u.full_name AS handler_name,
                COALESCE(x.issuance_date, DATE(x.created_at)) AS issue_date
         FROM stock_issuances x JOIN inventory_items i ON i.id = x.item_id
         JOIN stock_requests r ON r.id = x.request_id
         LEFT JOIN users u ON u.id = x.handled_by ORDER BY x.created_at, x.id'
    );
    while ($row = $result->fetch_assoc()) {
        $records['issuances'][] = [
            'id' => $row['id'], 'requestId' => $row['request_id'], 'itemId' => $row['item_id'],
            'itemName' => $row['item_name'], 'quantity' => (int) $row['quantity'], 'unit' => $row['item_unit'],
            'office' => $row['office'] ?? '', 'recipient' => $row['recipient'] ?? '',
            'recipientEmployeeId' => $row['recipient_employee_id'] ?? $row['request_employee_id'] ?? '',
            'handledBy' => $row['handler_name'] ?? '', 'date' => $row['issue_date'],
            'remarks' => $row['remarks'] ?? '', 'createdAt' => $row['created_at']
        ];
    }
    return $records;
}

function outputRecord(mysqli $db, string $resource, string $id): ?array
{
    $records = readRecords($db);
    foreach ($records[$resource] as $record) {
        if ($record['id'] === $id) {
            return $record;
        }
    }
    return null;
}

function saveOperation(mysqli $db, array $user, array $body): array
{
    $resource = $body['resource'] ?? '';
    $record = $body['record'] ?? null;
    if (!in_array($resource, ['items', 'requests', 'suppliers', 'receipts', 'issuances'], true)
        || !is_array($record) || !isset($record['id']) || !is_string($record['id'])) {
        throw new InvalidArgumentException('A valid record type and ID are required.');
    }
    $id = trim($record['id']);
    if ($id === '' || strlen($id) > 100) {
        throw new InvalidArgumentException('The record ID is invalid.');
    }

    $db->begin_transaction();
    try {
        if ($resource === 'items') {
            $name = requiredText($record, 'name', 'Item name');
            $category = trim((string) ($record['category'] ?? ''));
            $unit = requiredText($record, 'unit', 'Unit');
            $quantity = filter_var($record['quantity'] ?? null, FILTER_VALIDATE_INT);
            $minimum = filter_var($record['minimum'] ?? null, FILTER_VALIDATE_INT);
            if ($quantity === false || $minimum === false || $quantity < 0 || $minimum < 0) {
                throw new InvalidArgumentException('Stock quantities must be whole numbers greater than or equal to zero.');
            }
            $supplierId = supplierIdByName($db, trim((string) ($record['supplier'] ?? '')));
            $expiry = cleanDate($record['expiry'] ?? '', 'expiry date');
            $description = (string) ($record['description'] ?? '');
            $statement = $db->prepare(
                'INSERT INTO inventory_items (id, name, description, category, quantity, unit, minimum, supplier_id, expiry_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $statement->bind_param('ssssisiss', $id, $name, $description, $category, $quantity, $unit, $minimum, $supplierId, $expiry);
            $statement->execute();
        } elseif ($resource === 'suppliers') {
            $name = requiredText($record, 'name', 'Supplier name');
            $category = trim((string) ($record['category'] ?? ''));
            $contact = trim((string) ($record['contact'] ?? ''));
            $phone = trim((string) ($record['phone'] ?? ''));
            $email = trim((string) ($record['email'] ?? ''));
            $address = trim((string) ($record['address'] ?? ''));
            $statement = $db->prepare(
                'INSERT INTO suppliers (id, name, category, contact, phone, email, address) VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            $statement->bind_param('sssssss', $id, $name, $category, $contact, $phone, $email, $address);
            $statement->execute();
        } elseif ($resource === 'requests') {
            $itemId = (string) ($record['itemId'] ?? '');
            $item = itemRow($db, $itemId, true);
            $quantity = quantityFrom($record['quantity'] ?? '');
            if (!$item || $quantity < 1) {
                throw new InvalidArgumentException('Choose an inventory item and a valid request quantity.');
            }
            $requestedDate = cleanDate($record['date'] ?? '', 'request date', false);
            $office = requiredText($record, 'office', 'Requesting office');
            $recipient = requiredText($record, 'recipient', 'Recipient name');
            $employeeId = trim((string) ($record['employeeId'] ?? ''));
            $remarks = trim((string) ($record['remarks'] ?? ''));
            $statement = $db->prepare(
                'INSERT INTO stock_requests (id, requested_date, office, recipient, employee_id, item_id, quantity, status, remarks)
                 VALUES (?, ?, ?, ?, ?, ?, ?, "Pending", ?)'
            );
            $statement->bind_param('ssssssis', $id, $requestedDate, $office, $recipient, $employeeId, $itemId, $quantity, $remarks);
            $statement->execute();
        } elseif ($resource === 'receipts') {
            $itemId = (string) ($record['itemId'] ?? '');
            $item = itemRow($db, $itemId, true);
            $quantity = positiveInteger($record['quantity'] ?? null);
            if (!$item || $quantity < 1) {
                throw new InvalidArgumentException('Choose an inventory item and enter a valid received quantity.');
            }
            $supplierId = supplierIdByName($db, trim((string) ($record['supplier'] ?? '')));
            $deliveryReference = requiredText($record, 'deliveryReference', 'Delivery reference');
            $statement = $db->prepare('SELECT id FROM stock_receipts WHERE delivery_reference = ?');
            $statement->bind_param('s', $deliveryReference);
            $statement->execute();
            if ($statement->get_result()->fetch_assoc()) {
                throw new InvalidArgumentException('This delivery reference has already been recorded.');
            }
            $receivedDate = cleanDate($record['receivedDate'] ?? '', 'received date', false);
            $receivedBy = trim((string) ($record['receivedBy'] ?? $user['name']));
            $batchNumber = trim((string) ($record['batchNumber'] ?? ''));
            $expiryDate = cleanDate($record['expiryDate'] ?? '', 'expiry date');
            $remarks = trim((string) ($record['remarks'] ?? ''));
            $attachmentName = trim((string) ($record['attachmentName'] ?? ''));
            $userId = (int) $user['id'];
            $statement = $db->prepare(
                'INSERT INTO stock_receipts
                 (id, item_id, quantity, supplier_id, received_by, received_date, delivery_reference, batch_number, expiry_date, remarks, attachment_name)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $statement->bind_param(
                'ssisissssss',
                $id, $itemId, $quantity, $supplierId, $userId, $receivedDate,
                $deliveryReference, $batchNumber, $expiryDate, $remarks, $attachmentName
            );
            $statement->execute();
            $newQuantity = (int) $item['quantity'] + $quantity;
            if ($expiryDate !== null) {
                $update = $db->prepare('UPDATE inventory_items SET quantity = ?, expiry_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
                $update->bind_param('iss', $newQuantity, $expiryDate, $itemId);
            } else {
                $update = $db->prepare('UPDATE inventory_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
                $update->bind_param('is', $newQuantity, $itemId);
            }
            $update->execute();
        } else {
            $requestId = (string) ($record['requestId'] ?? '');
            $statement = $db->prepare('SELECT * FROM stock_requests WHERE id = ? FOR UPDATE');
            $statement->bind_param('s', $requestId);
            $statement->execute();
            $request = $statement->get_result()->fetch_assoc();
            $itemId = (string) ($record['itemId'] ?? '');
            $item = itemRow($db, $itemId, true);
            $quantity = positiveInteger($record['quantity'] ?? null);
            if (!$request || $request['status'] !== 'Approved' || !$item || $request['item_id'] !== $itemId || $quantity < 1) {
                throw new InvalidArgumentException('Only approved requests for the selected item can be issued.');
            }
            $statement = $db->prepare('SELECT COALESCE(SUM(quantity), 0) AS issued FROM stock_issuances WHERE request_id = ?');
            $statement->bind_param('s', $requestId);
            $statement->execute();
            $issued = (int) $statement->get_result()->fetch_assoc()['issued'];
            $remaining = max(0, (int) $request['quantity'] - $issued);
            if ($quantity > $remaining || $quantity > (int) $item['quantity']) {
                throw new InvalidArgumentException('The issue quantity exceeds the remaining request or available stock.');
            }
            $issueDate = cleanDate($record['date'] ?? '', 'issuance date', false);
            $office = $request['office'];
            $recipient = $request['recipient'];
            $handledBy = (int) $user['id'];
            $recipientEmployeeId = $request['employee_id'] ?? '';
            $remarks = trim((string) ($record['remarks'] ?? ''));
            $statement = $db->prepare(
                'INSERT INTO stock_issuances
                 (id, request_id, item_id, quantity, office, recipient, handled_by, issuance_date, recipient_employee_id, remarks)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $statement->bind_param(
                'sssississs',
                $id, $requestId, $itemId, $quantity, $office, $recipient,
                $handledBy, $issueDate, $recipientEmployeeId, $remarks
            );
            $statement->execute();
            $newQuantity = (int) $item['quantity'] - $quantity;
            $update = $db->prepare('UPDATE inventory_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
            $update->bind_param('is', $newQuantity, $itemId);
            $update->execute();
            if ($issued + $quantity >= (int) $request['quantity']) {
                $update = $db->prepare('UPDATE stock_requests SET status = "Issued" WHERE id = ?');
                $update->bind_param('s', $requestId);
                $update->execute();
            }
        }
        $db->commit();
    } catch (Throwable $error) {
        $db->rollback();
        throw $error;
    }

    $saved = outputRecord($db, $resource, $id);
    if (!$saved) {
        throw new RuntimeException('The saved record could not be reloaded.');
    }
    return $saved;
}

function updateOperation(mysqli $db, array $body): array
{
    $resource = $body['resource'] ?? '';
    $id = trim((string) ($body['recordId'] ?? ''));
    $changes = $body['changes'] ?? null;
    if (!in_array($resource, ['items', 'suppliers'], true) || $id === '' || !is_array($changes)) {
        throw new InvalidArgumentException('The record update is invalid.');
    }
    if ($resource === 'items') {
        $item = itemRow($db, $id, true);
        if (!$item) {
            throw new InvalidArgumentException('The inventory item could not be found.');
        }
        $name = trim((string) ($changes['name'] ?? $item['name']));
        $description = (string) ($changes['description'] ?? $item['description'] ?? '');
        $category = trim((string) ($changes['category'] ?? $item['category'] ?? ''));
        $unit = trim((string) ($changes['unit'] ?? $item['unit']));
        $minimum = filter_var($changes['minimum'] ?? $item['minimum'], FILTER_VALIDATE_INT);
        if ($name === '' || $unit === '' || $minimum === false || $minimum < 0) {
            throw new InvalidArgumentException('Enter a valid item name, unit, and minimum stock.');
        }
        $supplierName = trim((string) ($changes['supplier'] ?? $item['supplier_name'] ?? ''));
        $supplierId = supplierIdByName($db, $supplierName);
        $expiry = cleanDate($changes['expiry'] ?? $item['expiry'] ?? '', 'expiry date');
        $statement = $db->prepare(
            'UPDATE inventory_items SET name = ?, description = ?, category = ?, unit = ?, minimum = ?, supplier_id = ?, expiry_date = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?'
        );
        $statement->bind_param('ssssisss', $name, $description, $category, $unit, $minimum, $supplierId, $expiry, $id);
        $statement->execute();
    } else {
        $statement = $db->prepare(
            'UPDATE suppliers SET name = ?, category = ?, contact = ?, phone = ?, email = ?, address = ? WHERE id = ?'
        );
        $existing = $db->prepare('SELECT * FROM suppliers WHERE id = ?');
        $existing->bind_param('s', $id);
        $existing->execute();
        $supplier = $existing->get_result()->fetch_assoc();
        if (!$supplier) {
            throw new InvalidArgumentException('The supplier could not be found.');
        }
        $name = trim((string) ($changes['name'] ?? $supplier['name']));
        if ($name === '') {
            throw new InvalidArgumentException('A supplier name is required.');
        }
        $category = trim((string) ($changes['category'] ?? $supplier['category'] ?? ''));
        $contact = trim((string) ($changes['contact'] ?? $supplier['contact'] ?? ''));
        $phone = trim((string) ($changes['phone'] ?? $supplier['phone'] ?? ''));
        $email = trim((string) ($changes['email'] ?? $supplier['email'] ?? ''));
        $address = trim((string) ($changes['address'] ?? $supplier['address'] ?? ''));
        $statement->bind_param('sssssss', $name, $category, $contact, $phone, $email, $address, $id);
        $statement->execute();
    }

    $saved = outputRecord($db, $resource, $id);
    if (!$saved) {
        throw new RuntimeException('The updated record could not be reloaded.');
    }
    return $saved;
}

function updateRequestStatusOperation(mysqli $db, array $user, array $body): bool
{
    if ($user['role'] !== 'admin') {
        throw new InvalidArgumentException('Only the Supply Office head can review requests.');
    }
    $id = trim((string) ($body['requestId'] ?? ''));
    $status = $body['status'] ?? '';
    if (!in_array($status, ['Approved', 'Rejected'], true)) {
        throw new InvalidArgumentException('Choose a valid request status.');
    }
    $db->begin_transaction();
    try {
        $statement = $db->prepare('SELECT * FROM stock_requests WHERE id = ? FOR UPDATE');
        $statement->bind_param('s', $id);
        $statement->execute();
        $request = $statement->get_result()->fetch_assoc();
        if (!$request || $request['status'] !== 'Pending') {
            throw new InvalidArgumentException('This request is no longer awaiting review.');
        }
        if ($status === 'Approved') {
            $item = itemRow($db, $request['item_id'], true);
            if (!$item || (int) $request['quantity'] > (int) $item['quantity']) {
                throw new InvalidArgumentException('There is not enough stock to approve this request.');
            }
        }
        $statement = $db->prepare(
            'UPDATE stock_requests SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?'
        );
        $reviewerId = (int) $user['id'];
        $statement->bind_param('sis', $status, $reviewerId, $id);
        $statement->execute();
        $db->commit();
        return true;
    } catch (Throwable $error) {
        $db->rollback();
        throw $error;
    }
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['action'] ?? '') === 'session') {
        if (!isset($_SESSION['user'])) {
            respond(['ok' => false, 'error' => 'Not signed in.'], 401);
        }
        respond(['ok' => true, 'user' => $_SESSION['user']]);
    }
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['action'] ?? '') === 'records') {
        requireUser();
        respond(['ok' => true, 'records' => readRecords(database())]);
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(['ok' => false, 'error' => 'Unsupported request method.'], 405);
    }
    $body = requestBody();
    $action = $body['action'] ?? '';

    if ($action === 'login') {
        $role = $body['role'] ?? '';
        $username = trim((string) ($body['username'] ?? ''));
        $password = (string) ($body['password'] ?? '');
        if (!in_array($role, ['admin', 'staff'], true) || $username === '' || $password === '') {
            respond(['ok' => false, 'error' => 'Enter a valid workspace, username, and password.'], 400);
        }
        $db = database();
        $statement = $db->prepare(
            'SELECT id, role, username, password_hash, full_name, title, is_active
             FROM users WHERE role = ? AND LOWER(username) = LOWER(?)'
        );
        $statement->bind_param('ss', $role, $username);
        $statement->execute();
        $account = $statement->get_result()->fetch_assoc();
        $passwordValid = $account && password_verify($password, $account['password_hash']);
        if (!$passwordValid || !(int) $account['is_active']) {
            $userId = $passwordValid ? (int) $account['id'] : null;
            logLogin($db, $userId, $username, $role, false, $passwordValid ? 'Account is inactive.' : 'Invalid credentials.');
            respond(['ok' => false, 'error' => 'Username or password is incorrect for the selected workspace.'], 401);
        }
        logLogin($db, (int) $account['id'], $username, $role, true, null);
        session_regenerate_id(true);
        $_SESSION['user'] = [
            'id' => (int) $account['id'], 'username' => $account['username'],
            'name' => $account['full_name'], 'title' => $account['title'] ?? '', 'role' => $account['role']
        ];
        if (!empty($body['remember'])) {
            setcookie(session_name(), session_id(), [
                'expires' => time() + 60 * 60 * 24 * 30, 'path' => '/',
                'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
                'httponly' => true, 'samesite' => 'Lax'
            ]);
        }
        respond(['ok' => true, 'user' => $_SESSION['user']]);
    }
    if ($action === 'logout') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 42000, 'path' => $params['path'],
                'domain' => $params['domain'], 'secure' => $params['secure'],
                'httponly' => $params['httponly'], 'samesite' => 'Lax'
            ]);
        }
        session_destroy();
        respond(['ok' => true]);
    }

    $user = requireUser();
    $db = database();
    if ($action === 'save-record') {
        respond(['ok' => true, 'record' => saveOperation($db, $user, $body)]);
    }
    if ($action === 'update-record') {
        respond(['ok' => true, 'record' => updateOperation($db, $body)]);
    }
    if ($action === 'update-request-status') {
        respond(['ok' => updateRequestStatusOperation($db, $user, $body)]);
    }
    respond(['ok' => false, 'error' => 'Unknown action.'], 400);
} catch (InvalidArgumentException $error) {
    respond(['ok' => false, 'error' => $error->getMessage()], 400);
} catch (Throwable $error) {
    error_log('CBSUA API error: ' . $error->getMessage());
    respond(['ok' => false, 'error' => 'The database request failed. Check that MySQL is running and the database is set up.'], 500);
}
