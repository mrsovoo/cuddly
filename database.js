// ============================================
// 🐻 Cuddly AI - SQLite Database Module
// ============================================

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database fayl yo'li
const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'cuddly.db');

// Database papkasini yaratish
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

// Database ulanish
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Database connection error:', err.message);
    } else {
        console.log('✅ Connected to Cuddly database');
        console.log('📁 Database path:', DB_PATH);
        initDatabase();
    }
});

// ============================================
// INIT DATABASE - Tablitsalarni yaratish
// ============================================

function initDatabase() {
    // 1. Users tablitsasi
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            provider TEXT DEFAULT 'guest',
            avatar TEXT,
            role TEXT DEFAULT 'guest',
            created DATETIME DEFAULT CURRENT_TIMESTAMP,
            lastActive DATETIME DEFAULT CURRENT_TIMESTAMP,
            settings TEXT DEFAULT '{}'
        )
    `);

    // 2. Chats tablitsasi
    db.run(`
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            model TEXT DEFAULT 'deepseek',
            created DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            pinned INTEGER DEFAULT 0,
            favorite INTEGER DEFAULT 0,
            archived INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // 3. Messages tablitsasi
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            time TEXT NOT NULL,
            created DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
        )
    `);

    // 4. API Keys tablitsasi
    db.run(`
        CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            provider TEXT NOT NULL,
            api_key TEXT NOT NULL,
            created DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, provider),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // 5. Settings tablitsasi
    db.run(`
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            created DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, key),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    console.log('✅ Database tables created successfully');
    
    // Indexes yaratish
    createIndexes();
}

function createIndexes() {
    db.run('CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id)');
    console.log('✅ Database indexes created');
}

// ============================================
// USER CRUD OPERATIONS
// ============================================

// --- Create user ---
function createUser(userData, callback) {
    const { id, name, email, provider, avatar, role, settings } = userData;
    db.run(`
        INSERT INTO users (id, name, email, provider, avatar, role, settings)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, name, email, provider, avatar || '', role || 'guest', JSON.stringify(settings || {})], function(err) {
        if (err) {
            console.error('Error creating user:', err);
            callback(err, null);
            return;
        }
        getUserById(id, callback);
    });
}

// --- Get user by ID ---
function getUserById(userId, callback) {
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) {
            console.error('Error getting user:', err);
            callback(err, null);
            return;
        }
        if (row) {
            row.settings = JSON.parse(row.settings || '{}');
        }
        callback(null, row);
    });
}

// --- Get user by email ---
function getUserByEmail(email, callback) {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
            console.error('Error getting user by email:', err);
            callback(err, null);
            return;
        }
        if (row) {
            row.settings = JSON.parse(row.settings || '{}');
        }
        callback(null, row);
    });
}

// --- Get all users ---
function getAllUsers(callback) {
    db.all('SELECT * FROM users ORDER BY created DESC', (err, rows) => {
        if (err) {
            console.error('Error getting all users:', err);
            callback(err, null);
            return;
        }
        rows.forEach(row => {
            row.settings = JSON.parse(row.settings || '{}');
        });
        callback(null, rows);
    });
}

// --- Update user ---
function updateUser(userId, data, callback) {
    const updates = [];
    const values = [];
    
    if (data.name !== undefined) {
        updates.push('name = ?');
        values.push(data.name);
    }
    if (data.avatar !== undefined) {
        updates.push('avatar = ?');
        values.push(data.avatar);
    }
    if (data.role !== undefined) {
        updates.push('role = ?');
        values.push(data.role);
    }
    if (data.settings !== undefined) {
        updates.push('settings = ?');
        values.push(JSON.stringify(data.settings));
    }
    if (data.lastActive !== undefined) {
        updates.push('lastActive = ?');
        values.push(data.lastActive);
    }
    
    updates.push('lastActive = CURRENT_TIMESTAMP');
    values.push(userId);
    
    db.run(`
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = ?
    `, values, function(err) {
        if (err) {
            console.error('Error updating user:', err);
            callback(err, null);
            return;
        }
        getUserById(userId, callback);
    });
}

// --- Delete user ---
function deleteUser(userId, callback) {
    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
        if (err) {
            console.error('Error deleting user:', err);
            callback(err);
            return;
        }
        callback(null);
    });
}

// ============================================
// CHAT CRUD OPERATIONS
// ============================================

// --- Get all chats for user ---
function getUserChats(userId, callback) {
    db.all(`
        SELECT 
            c.*,
            (SELECT COUNT(*) FROM messages WHERE chat_id = c.id) as message_count,
            (SELECT content FROM messages WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) as last_message,
            (SELECT time FROM messages WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) as last_time
        FROM chats c
        WHERE c.user_id = ? AND c.archived = 0
        ORDER BY c.pinned DESC, c.updated DESC
    `, [userId], (err, rows) => {
        if (err) {
            console.error('Error getting user chats:', err);
            callback(err, null);
            return;
        }
        callback(null, rows);
    });
}

// --- Get chat by ID ---
function getChatById(chatId, callback) {
    db.get(`
        SELECT 
            c.*,
            (SELECT COUNT(*) FROM messages WHERE chat_id = c.id) as message_count
        FROM chats c
        WHERE c.id = ?
    `, [chatId], (err, row) => {
        if (err) {
            console.error('Error getting chat:', err);
            callback(err, null);
            return;
        }
        callback(null, row);
    });
}

// --- Create chat ---
function createChat(userId, name, model, callback) {
    db.run(`
        INSERT INTO chats (user_id, name, model, created, updated)
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `, [userId, name || 'New Chat', model || 'deepseek'], function(err) {
        if (err) {
            console.error('Error creating chat:', err);
            callback(err, null);
            return;
        }
        getChatById(this.lastID, callback);
    });
}

// --- Update chat ---
function updateChat(chatId, data, callback) {
    const updates = [];
    const values = [];
    
    if (data.name !== undefined) {
        updates.push('name = ?');
        values.push(data.name);
    }
    if (data.model !== undefined) {
        updates.push('model = ?');
        values.push(data.model);
    }
    if (data.pinned !== undefined) {
        updates.push('pinned = ?');
        values.push(data.pinned ? 1 : 0);
    }
    if (data.favorite !== undefined) {
        updates.push('favorite = ?');
        values.push(data.favorite ? 1 : 0);
    }
    if (data.archived !== undefined) {
        updates.push('archived = ?');
        values.push(data.archived ? 1 : 0);
    }
    
    updates.push('updated = datetime("now")');
    values.push(chatId);
    
    db.run(`
        UPDATE chats
        SET ${updates.join(', ')}
        WHERE id = ?
    `, values, function(err) {
        if (err) {
            console.error('Error updating chat:', err);
            callback(err, null);
            return;
        }
        getChatById(chatId, callback);
    });
}

// --- Delete chat ---
function deleteChat(chatId, callback) {
    db.run('DELETE FROM chats WHERE id = ?', [chatId], function(err) {
        if (err) {
            console.error('Error deleting chat:', err);
            callback(err);
            return;
        }
        callback(null);
    });
}

// --- Toggle pin chat ---
function togglePinChat(chatId, callback) {
    db.run(`
        UPDATE chats 
        SET pinned = CASE WHEN pinned = 1 THEN 0 ELSE 1 END,
            updated = datetime("now")
        WHERE id = ?
    `, [chatId], function(err) {
        if (err) {
            console.error('Error toggling pin:', err);
            callback(err);
            return;
        }
        getChatById(chatId, callback);
    });
}

// ============================================
// MESSAGE CRUD OPERATIONS
// ============================================

// --- Get messages for chat ---
function getMessages(chatId, callback) {
    db.all(`
        SELECT * FROM messages
        WHERE chat_id = ?
        ORDER BY id ASC
    `, [chatId], (err, rows) => {
        if (err) {
            console.error('Error getting messages:', err);
            callback(err, null);
            return;
        }
        callback(null, rows);
    });
}

// --- Add message ---
function addMessage(chatId, role, content, time, callback) {
    db.run(`
        INSERT INTO messages (chat_id, role, content, time, created)
        VALUES (?, ?, ?, ?, datetime("now"))
    `, [chatId, role, content, time], function(err) {
        if (err) {
            console.error('Error adding message:', err);
            callback(err, null);
            return;
        }
        
        // Chat updated vaqtini yangilash
        db.run(`
            UPDATE chats SET updated = datetime("now")
            WHERE id = ?
        `, [chatId]);
        
        db.get('SELECT * FROM messages WHERE id = ?', [this.lastID], callback);
    });
}

// --- Clear all messages in chat ---
function clearMessages(chatId, callback) {
    db.run('DELETE FROM messages WHERE chat_id = ?', [chatId], function(err) {
        if (err) {
            console.error('Error clearing messages:', err);
            callback(err);
            return;
        }
        callback(null);
    });
}

// --- Delete single message ---
function deleteMessage(messageId, callback) {
    db.run('DELETE FROM messages WHERE id = ?', [messageId], function(err) {
        if (err) {
            console.error('Error deleting message:', err);
            callback(err);
            return;
        }
        callback(null);
    });
}

// ============================================
// API KEYS OPERATIONS
// ============================================

// --- Save API key ---
function saveAPIKey(userId, provider, apiKey, callback) {
    db.run(`
        INSERT INTO api_keys (user_id, provider, api_key, updated)
        VALUES (?, ?, ?, datetime("now"))
        ON CONFLICT(user_id, provider) DO UPDATE SET
            api_key = excluded.api_key,
            updated = datetime("now")
    `, [userId, provider, apiKey], function(err) {
        if (err) {
            console.error('Error saving API key:', err);
            callback(err);
            return;
        }
        callback(null);
    });
}

// --- Get all API keys for user ---
function getUserAPIKeys(userId, callback) {
    db.all('SELECT provider, api_key FROM api_keys WHERE user_id = ?', [userId], (err, rows) => {
        if (err) {
            console.error('Error getting API keys:', err);
            callback(err, null);
            return;
        }
        const keys = {};
        rows.forEach(row => {
            keys[row.provider] = row.api_key;
        });
        callback(null, keys);
    });
}

// --- Get single API key ---
function getAPIKey(userId, provider, callback) {
    db.get('SELECT api_key FROM api_keys WHERE user_id = ? AND provider = ?', [userId, provider], (err, row) => {
        if (err) {
            console.error('Error getting API key:', err);
            callback(err, null);
            return;
        }
        callback(null, row ? row.api_key : null);
    });
}

// --- Delete API key ---
function deleteAPIKey(userId, provider, callback) {
    db.run('DELETE FROM api_keys WHERE user_id = ? AND provider = ?', [userId, provider], function(err) {
        if (err) {
            console.error('Error deleting API key:', err);
            callback(err);
            return;
        }
        callback(null);
    });
}

// ============================================
// SETTINGS OPERATIONS
// ============================================

// --- Save setting ---
function saveSetting(userId, key, value, callback) {
    db.run(`
        INSERT INTO settings (user_id, key, value, updated)
        VALUES (?, ?, ?, datetime("now"))
        ON CONFLICT(user_id, key) DO UPDATE SET
            value = excluded.value,
            updated = datetime("now")
    `, [userId, key, value], function(err) {
        if (err) {
            console.error('Error saving setting:', err);
            callback(err);
            return;
        }
        callback(null);
    });
}

// --- Get setting ---
function getSetting(userId, key, callback) {
    db.get('SELECT value FROM settings WHERE user_id = ? AND key = ?', [userId, key], (err, row) => {
        if (err) {
            console.error('Error getting setting:', err);
            callback(err, null);
            return;
        }
        callback(null, row ? row.value : null);
    });
}

// --- Get all settings for user ---
function getUserSettings(userId, callback) {
    db.all('SELECT key, value FROM settings WHERE user_id = ?', [userId], (err, rows) => {
        if (err) {
            console.error('Error getting settings:', err);
            callback(err, null);
            return;
        }
        const settings = {};
        rows.forEach(row => {
            settings[row.key] = row.value;
        });
        callback(null, settings);
    });
}

// ============================================
// STATISTICS
// ============================================

// --- Get user statistics ---
function getUserStats(userId, callback) {
    db.get(`
        SELECT 
            (SELECT COUNT(*) FROM chats WHERE user_id = ? AND archived = 0) as total_chats,
            (SELECT COUNT(*) FROM messages WHERE chat_id IN (SELECT id FROM chats WHERE user_id = ?)) as total_messages,
            (SELECT COUNT(DISTINCT model) FROM chats WHERE user_id = ?) as total_models,
            (SELECT COUNT(*) FROM chats WHERE user_id = ? AND pinned = 1) as total_pinned
    `, [userId, userId, userId, userId], (err, row) => {
        if (err) {
            console.error('Error getting user stats:', err);
            callback(err, null);
            return;
        }
        callback(null, row);
    });
}

// ============================================
// EXPORT MODULES
// ============================================

module.exports = {
    // Users
    createUser,
    getUserById,
    getUserByEmail,
    getAllUsers,
    updateUser,
    deleteUser,
    
    // Chats
    getUserChats,
    getChatById,
    createChat,
    updateChat,
    deleteChat,
    togglePinChat,
    
    // Messages
    getMessages,
    addMessage,
    clearMessages,
    deleteMessage,
    
    // API Keys
    saveAPIKey,
    getUserAPIKeys,
    getAPIKey,
    deleteAPIKey,
    
    // Settings
    saveSetting,
    getSetting,
    getUserSettings,
    
    // Stats
    getUserStats,
    
    // Database
    db
};

console.log('📦 Database module loaded successfully');
console.log('📁 Database path:', DB_PATH);