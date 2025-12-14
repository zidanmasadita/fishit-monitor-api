<?php
// ===========================
// Fishit Monitor API
// ===========================

// Enhanced CORS Headers
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept, User-Agent, Origin');
header('Access-Control-Allow-Credentials: true');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Data file path
$dataFile = __DIR__ . '/data/accounts.json';
$inventoryFile = __DIR__ . '/data/inventory.json';

// Ensure data directory exists
if (!file_exists(__DIR__ . '/data')) {
    mkdir(__DIR__ . '/data', 0777, true);
}

// ===========================
// Helper Functions
// ===========================

function loadAccounts() {
    global $dataFile;
    if (file_exists($dataFile)) {
        $data = file_get_contents($dataFile);
        return json_decode($data, true) ?: [];
    }
    return [];
}

function saveAccounts($accounts) {
    global $dataFile;
    file_put_contents($dataFile, json_encode($accounts, JSON_PRETTY_PRINT));
}

function loadInventory() {
    global $inventoryFile;
    if (file_exists($inventoryFile)) {
        $data = file_get_contents($inventoryFile);
        return json_decode($data, true) ?: [];
    }
    return [];
}

function saveInventory($inventory) {
    global $inventoryFile;
    file_put_contents($inventoryFile, json_encode($inventory, JSON_PRETTY_PRINT));
}

// ===========================
// API Endpoints
// ===========================

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'update':
        // Receive data from Lua script
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $input = file_get_contents('php://input');
            
            // Log raw input for debugging
            error_log("=== Fishit Monitor API ===");
            error_log("Time: " . date('Y-m-d H:i:s'));
            error_log("IP: " . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
            error_log("User-Agent: " . ($_SERVER['HTTP_USER_AGENT'] ?? 'unknown'));
            error_log("Raw Input Length: " . strlen($input));
            error_log("Raw Input: " . substr($input, 0, 500));
            
            $data = json_decode($input, true);
            
            if ($data && isset($data['player']) && isset($data['player']['username'])) {
                $accounts = loadAccounts();
                
                // Update or add account
                $username = $data['player']['username'];
                $accounts[$username] = [
                    'username' => $username,
                    'displayName' => $data['player']['displayName'] ?? $username,
                    'status' => 'active',
                    'level' => $data['player']['level'] ?? 1,
                    'levelProgress' => $data['player']['levelProgress'] ?? 0,
                    'rod' => $data['equipment']['rod'] ?? 'Unknown Rod',
                    'bobber' => $data['equipment']['bobber'] ?? 'Unknown Bobber',
                    'fishCaught' => $data['player']['fishCaught'] ?? 0,
                    'playtime' => $data['player']['playtime'] ?? 0,
                    'lastActive' => date('Y-m-d H:i:s'),
                    'timestamp' => time()
                ];
                
                saveAccounts($accounts);
                
                // Update inventory
                if (isset($data['inventory']) && is_array($data['inventory'])) {
                    $currentInventory = loadInventory();
                    $currentInventory[$username] = $data['inventory'];
                    saveInventory($currentInventory);
                }
                
                error_log("Success: Account $username updated");
                
                echo json_encode([
                    'success' => true,
                    'message' => 'Data updated successfully',
                    'username' => $username,
                    'timestamp' => date('Y-m-d H:i:s')
                ]);
            } else {
                error_log("Error: Invalid JSON or missing username");
                error_log("Parsed data: " . print_r($data, true));
                
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Invalid JSON data or missing username',
                    'received_keys' => $data ? array_keys($data) : []
                ]);
            }
        } else {
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        }
        break;
        
    case 'accounts':
        // Get all accounts
        $accounts = loadAccounts();
        
        // Mark accounts as disconnected if not updated in 60 seconds
        $currentTime = time();
        foreach ($accounts as $username => &$account) {
            if ($currentTime - $account['timestamp'] > 60) {
                $account['status'] = 'disconnected';
            }
        }
        
        echo json_encode([
            'success' => true,
            'accounts' => array_values($accounts)
        ]);
        break;
        
    case 'inventory':
        // Get combined inventory from all accounts
        $inventory = loadInventory();
        $combined = [];
        
        foreach ($inventory as $username => $userInventory) {
            foreach ($userInventory as $fish) {
                $fishName = $fish['name'];
                
                if (!isset($combined[$fishName])) {
                    $combined[$fishName] = [
                        'name' => $fishName,
                        'quantity' => 0,
                        'rarity' => $fish['rarity'] ?? 'common',
                        'value' => $fish['value'] ?? 10
                    ];
                }
                
                $combined[$fishName]['quantity'] += $fish['quantity'];
            }
        }
        
        echo json_encode([
            'success' => true,
            'inventory' => array_values($combined)
        ]);
        break;
        
    case 'stats':
        // Get dashboard statistics
        $accounts = loadAccounts();
        
        $activeCount = 0;
        $disconnectedCount = 0;
        $totalExecutions = 0;
        $totalFish = 0;
        
        $currentTime = time();
        foreach ($accounts as $account) {
            if ($currentTime - $account['timestamp'] <= 60) {
                $activeCount++;
            } else {
                $disconnectedCount++;
            }
            
            $totalFish += $account['fishCaught'] ?? 0;
        }
        
        echo json_encode([
            'success' => true,
            'stats' => [
                'totalAccounts' => count($accounts),
                'activeAccounts' => $activeCount,
                'disconnectedAccounts' => $disconnectedCount,
                'totalFish' => $totalFish,
                'executions' => $totalExecutions
            ]
        ]);
        break;
        
    case 'test':
        // Test endpoint
        echo json_encode([
            'success' => true,
            'message' => 'API is working!',
            'timestamp' => date('Y-m-d H:i:s'),
            'accounts_file' => file_exists($dataFile) ? 'exists' : 'not found',
            'inventory_file' => file_exists($inventoryFile) ? 'exists' : 'not found'
        ]);
        break;
        
    default:
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid action. Available actions: update, accounts, inventory, stats, test'
        ]);
        break;
}
?>
