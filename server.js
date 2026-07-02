// ============================================
// 🐻 Cuddly AI v1.0 - Server (Vercel uchun)
// ============================================

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

app.use(express.json());
app.use(express.static(__dirname));

// ============================================
// DATA DIRECTORY
// ============================================

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'cuddly-data.json');

// Papkani yaratish
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Boshlang'ich data
function getDefaultData() {
    return {
        users: [],
        currentUser: null,
        chats: [],
        chatHistory: {},
        theme: 'light',
        apiKeys: {}
    };
}

// ============================================
// DATA READ/WRITE
// ============================================

function readData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
        return getDefaultData();
    } catch (error) {
        console.error('Error reading data:', error);
        return getDefaultData();
    }
}

function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing data:', error);
        return false;
    }
}

// ============================================
// API ROUTES
// ============================================

// --- Get all data ---
app.get('/api/data', (req, res) => {
    try {
        const data = readData();
        res.json(data);
    } catch (error) {
        console.error('Error getting data:', error);
        res.status(500).json({ error: 'Failed to get data' });
    }
});

// --- Save all data ---
app.post('/api/data', (req, res) => {
    try {
        const data = req.body;
        if (writeData(data)) {
            res.json({ success: true, message: 'Data saved successfully' });
        } else {
            res.status(500).json({ error: 'Failed to save data' });
        }
    } catch (error) {
        console.error('Error saving data:', error);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// --- Reset all data (ZERO state) ---
app.post('/api/reset', (req, res) => {
    try {
        const defaultData = getDefaultData();
        if (writeData(defaultData)) {
            res.json({ success: true, message: 'Data reset to zero state' });
        } else {
            res.status(500).json({ error: 'Failed to reset data' });
        }
    } catch (error) {
        console.error('Error resetting data:', error);
        res.status(500).json({ error: 'Failed to reset data' });
    }
});

// --- Get users ---
app.get('/api/users', (req, res) => {
    try {
        const data = readData();
        res.json(data.users || []);
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
});

// --- Get current user ---
app.get('/api/user/current', (req, res) => {
    try {
        const data = readData();
        res.json(data.currentUser || null);
    } catch (error) {
        console.error('Error getting current user:', error);
        res.status(500).json({ error: 'Failed to get current user' });
    }
});

// --- Get user by email ---
app.get('/api/users/email/:email', (req, res) => {
    try {
        const email = req.params.email;
        const data = readData();
        const user = (data.users || []).find(u => u.email === email);
        res.json(user || null);
    } catch (error) {
        console.error('Error getting user by email:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// --- Create/Update user ---
app.post('/api/users', (req, res) => {
    try {
        const userData = req.body;
        let data = readData();
        
        if (!data.users) data.users = [];
        
        // User mavjudligini tekshirish
        const existingIndex = data.users.findIndex(u => u.email === userData.email);
        
        if (existingIndex > -1) {
            // Yangilash
            data.users[existingIndex] = { ...data.users[existingIndex], ...userData };
        } else {
            // Yaratish
            const newUser = {
                id: 'user_' + Date.now(),
                name: userData.name || 'User',
                email: userData.email || 'user@cuddly.ai',
                provider: userData.provider || 'guest',
                avatar: userData.avatar || '',
                role: userData.role || 'guest',
                created: new Date().toISOString(),
                lastActive: new Date().toISOString(),
                chats: [],
                settings: { theme: 'light', model: 'deepseek' }
            };
            data.users.push(newUser);
        }
        
        if (writeData(data)) {
            const savedUser = data.users.find(u => u.email === userData.email);
            res.json(savedUser);
        } else {
            res.status(500).json({ error: 'Failed to save user' });
        }
    } catch (error) {
        console.error('Error creating/updating user:', error);
        res.status(500).json({ error: 'Failed to save user' });
    }
});

// --- Set current user ---
app.post('/api/user/current', (req, res) => {
    try {
        const user = req.body;
        let data = readData();
        data.currentUser = user;
        
        if (writeData(data)) {
            res.json({ success: true });
        } else {
            res.status(500).json({ error: 'Failed to set current user' });
        }
    } catch (error) {
        console.error('Error setting current user:', error);
        res.status(500).json({ error: 'Failed to set current user' });
    }
});

// --- Get user chats ---
app.get('/api/users/:userId/chats', (req, res) => {
    try {
        const userId = req.params.userId;
        const data = readData();
        
        // User ni topish
        const user = (data.users || []).find(u => u.id === userId);
        const chats = user ? user.chats || [] : [];
        
        res.json({
            chats: chats,
            chatHistory: data.chatHistory || {}
        });
    } catch (error) {
        console.error('Error getting user chats:', error);
        res.status(500).json({ error: 'Failed to get user chats' });
    }
});

// --- Save chats ---
app.post('/api/chats', (req, res) => {
    try {
        const { userId, chats, chatHistory } = req.body;
        let data = readData();
        
        // User chats ni yangilash
        const userIndex = (data.users || []).findIndex(u => u.id === userId);
        if (userIndex > -1) {
            data.users[userIndex].chats = chats || [];
        }
        
        // Chat history ni saqlash
        data.chatHistory = chatHistory || {};
        
        if (writeData(data)) {
            res.json({ success: true });
        } else {
            res.status(500).json({ error: 'Failed to save chats' });
        }
    } catch (error) {
        console.error('Error saving chats:', error);
        res.status(500).json({ error: 'Failed to save chats' });
    }
});

// --- Save API keys ---
app.post('/api/keys', (req, res) => {
    try {
        const { userId, provider, apiKey } = req.body;
        let data = readData();
        
        if (!data.apiKeys) data.apiKeys = {};
        if (!data.apiKeys[userId]) data.apiKeys[userId] = {};
        data.apiKeys[userId][provider] = apiKey;
        
        if (writeData(data)) {
            res.json({ success: true });
        } else {
            res.status(500).json({ error: 'Failed to save API key' });
        }
    } catch (error) {
        console.error('Error saving API key:', error);
        res.status(500).json({ error: 'Failed to save API key' });
    }
});

// --- Get API keys ---
app.get('/api/users/:userId/keys', (req, res) => {
    try {
        const userId = req.params.userId;
        const data = readData();
        const keys = data.apiKeys && data.apiKeys[userId] ? data.apiKeys[userId] : {};
        res.json(keys);
    } catch (error) {
        console.error('Error getting API keys:', error);
        res.status(500).json({ error: 'Failed to get API keys' });
    }
});

// --- Get user stats ---
app.get('/api/users/:userId/stats', (req, res) => {
    try {
        const userId = req.params.userId;
        const data = readData();
        const user = (data.users || []).find(u => u.id === userId);
        
        if (!user) {
            res.json({ total_chats: 0, total_messages: 0, total_models: 0, total_pinned: 0 });
            return;
        }
        
        const chats = user.chats || [];
        const totalChats = chats.length;
        let totalMessages = 0;
        const models = new Set();
        let totalPinned = 0;
        
        chats.forEach(chat => {
            if (chat.messages) {
                totalMessages += chat.messages.length;
            }
            if (chat.model) {
                models.add(chat.model);
            }
            if (chat.pinned) {
                totalPinned++;
            }
        });
        
        res.json({
            total_chats: totalChats,
            total_messages: totalMessages,
            total_models: models.size,
            total_pinned: totalPinned
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// ============================================
// FRONTEND ROUTE
// ============================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/style.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'style.css'));
});

app.get('/script.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'script.js'));
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log('🐻 Cuddly AI v1.0 Server running on http://localhost:' + PORT);
    console.log('📁 Data directory:', DATA_DIR);
    console.log('📄 Data file:', DATA_FILE);
    console.log('');
    console.log('📊 API Endpoints:');
    console.log('   GET    /api/data');
    console.log('   POST   /api/data');
    console.log('   POST   /api/reset');
    console.log('   GET    /api/users');
    console.log('   POST   /api/users');
    console.log('   GET    /api/user/current');
    console.log('   POST   /api/user/current');
    console.log('   GET    /api/users/:userId/chats');
    console.log('   POST   /api/chats');
    console.log('   GET    /api/users/:userId/keys');
    console.log('   POST   /api/keys');
    console.log('   GET    /api/users/:userId/stats');
});