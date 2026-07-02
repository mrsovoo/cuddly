// ============================================
// 🐻 Cuddly AI v1.0 - Zero State
// ============================================

// ============================================
// BARCHA MA'LUMOTLARNI TOZALASH (BIRINCHI MARTA)
// ============================================

(function resetAllData() {
    try {
        var keys = [
            'cuddly-users',
            'cuddly-current-user', 
            'cuddly-chats',
            'cuddly-history',
            'cuddly-theme',
            'cuddly-deepseek-key',
            'cuddly-gemini-key',
            'cuddly-claude-key',
            'cuddly-openai-key'
        ];
        
        keys.forEach(function(key) {
            localStorage.removeItem(key);
        });
        
        console.log('🗑️ All Cuddly data cleared to ZERO state');
    } catch (e) {
        console.warn('Could not clear data:', e);
    }
})();

// ============================================
// API KEYS - BOSHLANG'ICH HOLAT
// ============================================

var API_KEYS = {
    deepseek: '',
    gemini: '',
    claude: '',
    openai: ''
};

var API_ENDPOINTS = {
    deepseek: 'https://api.deepseek.com/v1/chat/completions',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
    claude: 'https://api.anthropic.com/v1/messages',
    openai: 'https://api.openai.com/v1/chat/completions'
};

// ============================================
// DATA STORE - BOSHLANG'ICH HOLAT (0)
// ============================================

var currentUser = null;
var users = [];
var chats = [];
var chatHistory = {};
var currentChatId = null;
var currentTheme = 'light';

// ============================================
// DOM ELEMENTS
// ============================================

var chatsList = document.getElementById('chatsList');
var chatMessages = document.getElementById('chatMessages');
var promptInput = document.getElementById('promptInput');
var sendBtn = document.getElementById('sendBtn');
var charCount = document.getElementById('charCount');
var chatTitle = document.getElementById('chatTitle');
var chatStatus = document.getElementById('chatStatus');
var modelSelector = document.getElementById('modelSelector');
var searchInput = document.getElementById('searchInput');
var newChatBtn = document.getElementById('newChatBtn');
var clearBtn = document.getElementById('clearBtn');
var deleteBtn = document.getElementById('deleteBtn');
var shareBtn = document.getElementById('shareBtn');
var pinBtn = document.getElementById('pinBtn');
var attachBtn = document.getElementById('attachBtn');
var voiceBtn = document.getElementById('voiceBtn');
var settingsBtn = document.getElementById('settingsBtn');
var settingsModal = document.getElementById('settingsModal');
var closeSettings = document.getElementById('closeSettings');
var saveKeysBtn = document.getElementById('saveKeysBtn');
var themeToggle = document.getElementById('themeToggle');
var commandPalette = document.getElementById('commandPalette');
var commandInput = document.getElementById('commandInput');
var commandResults = document.getElementById('commandResults');
var statusDot = document.getElementById('statusDot');
var statusText = document.getElementById('statusText');

var deepseekKeyInput = document.getElementById('deepseekKey');
var geminiKeyInput = document.getElementById('geminiKey');
var claudeKeyInput = document.getElementById('claudeKey');
var openaiKeyInput = document.getElementById('openaiKey');

// ============================================
// THEME MANAGEMENT
// ============================================

function applyTheme(theme) {
    currentTheme = theme || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('cuddly-theme', currentTheme);
    
    var icon = themeToggle.querySelector('svg');
    if (currentTheme === 'dark') {
        icon.innerHTML = '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>';
    } else {
        icon.innerHTML = '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>';
    }
}

themeToggle.addEventListener('click', function() {
    applyTheme(currentTheme === 'light' ? 'dark' : 'light');
});

document.querySelectorAll('.theme-option').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.theme-option').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var theme = btn.dataset.theme;
        if (theme === 'system') {
            var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            applyTheme(prefersDark ? 'dark' : 'light');
        } else {
            applyTheme(theme);
        }
    });
});

// ============================================
// API STATUS
// ============================================

function updateAPIStatus() {
    var hasKey = false;
    for (var key in API_KEYS) {
        if (API_KEYS[key] && API_KEYS[key].length > 10) {
            hasKey = true;
            break;
        }
    }
    if (hasKey) {
        statusDot.className = 'status-dot online';
        statusText.textContent = 'API: Connected';
    } else {
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'API: Not configured';
    }
}

updateAPIStatus();

// ============================================
// AI CALL FUNCTIONS
// ============================================

async function callAI(model, messages) {
    var apiKey = API_KEYS[model];
    var endpoint = API_ENDPOINTS[model];
    
    if (!apiKey || apiKey.length < 10) {
        console.warn('No valid API key for ' + model + ', using simulation');
        return simulateAIResponse(messages);
    }
    
    try {
        var response;
        switch(model) {
            case 'deepseek':
                response = await callDeepSeek(endpoint, apiKey, messages);
                break;
            case 'gemini':
                response = await callGemini(endpoint, apiKey, messages);
                break;
            case 'claude':
                response = await callClaude(endpoint, apiKey, messages);
                break;
            case 'gpt':
            case 'openai':
                response = await callOpenAI(endpoint, apiKey, messages);
                break;
            default:
                return simulateAIResponse(messages);
        }
        return response;
    } catch (error) {
        console.error('API Error:', error);
        return 'Error: ' + error.message;
    }
}

async function callDeepSeek(endpoint, apiKey, messages) {
    var response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: messages,
            temperature: 0.7,
            max_tokens: 2000
        })
    });
    if (!response.ok) {
        var error = await response.json();
        throw new Error(error.error?.message || 'DeepSeek API error');
    }
    var data = await response.json();
    return data.choices[0].message.content;
}

async function callGemini(endpoint, apiKey, messages) {
    var contents = messages.map(function(msg) {
        return {
            parts: [{ text: msg.content }],
            role: msg.role === 'assistant' ? 'model' : 'user'
        };
    });
    var response = await fetch(endpoint + '?key=' + apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 2000 }
        })
    });
    if (!response.ok) {
        var error = await response.json();
        throw new Error(error.error?.message || 'Gemini API error');
    }
    var data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

async function callClaude(endpoint, apiKey, messages) {
    var system = messages.find(function(m) { return m.role === 'system'; })?.content || 'You are a helpful AI assistant.';
    var userMessages = messages.filter(function(m) { return m.role !== 'system'; });
    var response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 2000,
            system: system,
            messages: userMessages
        })
    });
    if (!response.ok) {
        var error = await response.json();
        throw new Error(error.error?.message || 'Claude API error');
    }
    var data = await response.json();
    return data.content[0].text;
}

async function callOpenAI(endpoint, apiKey, messages) {
    var response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
            model: 'gpt-4',
            messages: messages,
            temperature: 0.7,
            max_tokens: 2000
        })
    });
    if (!response.ok) {
        var error = await response.json();
        throw new Error(error.error?.message || 'OpenAI API error');
    }
    var data = await response.json();
    return data.choices[0].message.content;
}

function simulateAIResponse(messages) {
    var responses = [
        "That's a great question! Let me think about that. Based on what you've shared, I would suggest focusing on the key priorities first.",
        "I understand what you're asking. Here's my take on this: it really depends on the context and what you're trying to achieve.",
        "Thanks for reaching out! I'd be happy to help with that. From my perspective, the best approach would be to break this down into smaller steps.",
        "That's an interesting topic. Let me share my thoughts: I believe this requires careful consideration of all the factors involved.",
        "I appreciate your question. Here's a detailed response: the key is to find the right balance between what's ideal and what's practical."
    ];
    return new Promise(function(resolve) {
        setTimeout(function() {
            resolve(responses[Math.floor(Math.random() * responses.length)]);
        }, 1000 + Math.random() * 500);
    });
}

// ============================================
// CHAT NAME AUTO-GENERATION
// ============================================

function generateChatName(messages) {
    var userMessages = messages.filter(function(m) { return m.role === 'user'; });
    if (userMessages.length === 0) return 'New Chat';
    var firstMessage = userMessages[0].content;
    if (firstMessage.length < 3) return 'Quick Chat';
    var words = firstMessage.split(' ');
    if (words.length <= 5) return firstMessage;
    var shortName = words.slice(0, 5).join(' ');
    var lastChar = shortName[shortName.length - 1];
    if (lastChar !== '.' && lastChar !== '?' && lastChar !== '!') {
        return shortName + '...';
    }
    return shortName;
}

// ============================================
// USER AUTH FUNCTIONS
// ============================================

function loadUsers() {
    try {
        var saved = localStorage.getItem('cuddly-users');
        if (saved) {
            users = JSON.parse(saved);
            console.log('Users loaded:', users.length);
        } else {
            users = [];
            console.log('No users found, starting fresh');
        }
    } catch (e) {
        console.warn('Could not load users:', e);
        users = [];
    }
}

function saveUsers() {
    try {
        localStorage.setItem('cuddly-users', JSON.stringify(users));
    } catch (e) {
        console.warn('Could not save users:', e);
    }
}

function getCurrentUser() {
    try {
        var saved = localStorage.getItem('cuddly-current-user');
        if (saved) {
            return JSON.parse(saved);
        }
        return null;
    } catch (e) {
        return null;
    }
}

function setCurrentUser(user) {
    currentUser = user;
    localStorage.setItem('cuddly-current-user', JSON.stringify(user));
    updateUIForUser(user);
}

function findUserByEmail(email) {
    return users.find(function(u) { return u.email === email; });
}

function findUserById(id) {
    return users.find(function(u) { return u.id === id; });
}

function createUser(userData) {
    if (userData.email) {
        var existing = findUserByEmail(userData.email);
        if (existing) {
            console.log('User already exists:', existing.name);
            return existing;
        }
    }
    
    var newUser = {
        id: 'user_' + Date.now(),
        name: userData.name || 'User',
        email: userData.email || 'user@cuddly.ai',
        provider: userData.provider || 'guest',
        avatar: userData.avatar || '',
        role: userData.role || 'guest',
        created: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        chats: [],
        settings: {
            theme: 'light',
            model: 'deepseek'
        }
    };
    users.push(newUser);
    saveUsers();
    console.log('New user created:', newUser.name);
    return newUser;
}

function updateUserActivity(userId) {
    var user = findUserById(userId);
    if (user) {
        user.lastActive = new Date().toISOString();
        saveUsers();
    }
}

// ============================================
// AUTH FUNCTIONS
// ============================================

function signInWithGoogle() {
    return new Promise(function(resolve, reject) {
        try {
            var googleUser = {
                name: 'Alex Johnson',
                email: 'alex.johnson@gmail.com',
                provider: 'google',
                avatar: '',
                role: 'owner'
            };
            
            var user = findUserByEmail(googleUser.email);
            if (!user) {
                user = createUser(googleUser);
            }
            
            setCurrentUser(user);
            resolve(user);
        } catch (error) {
            console.error('Google auth error:', error);
            reject(error);
        }
    });
}

function signInAsGuest() {
    return new Promise(function(resolve, reject) {
        try {
            var guestEmail = 'guest@cuddly.ai';
            var guestName = 'Guest User';
            
            var existingGuest = findUserByEmail(guestEmail);
            
            if (existingGuest) {
                console.log('Existing guest found:', existingGuest.name);
                setCurrentUser(existingGuest);
                resolve(existingGuest);
                return;
            }
            
            var guestUser = {
                name: guestName,
                email: guestEmail,
                provider: 'guest',
                role: 'guest'
            };
            
            var user = createUser(guestUser);
            setCurrentUser(user);
            resolve(user);
        } catch (error) {
            console.error('Guest auth error:', error);
            reject(error);
        }
    });
}

function logout() {
    if (currentUser) {
        updateUserActivity(currentUser.id);
    }
    currentUser = null;
    localStorage.removeItem('cuddly-current-user');
    showAuthScreen();
}

// ============================================
// UI FUNCTIONS
// ============================================

function showAuthScreen() {
    var authScreen = document.getElementById('authScreen');
    var appMain = document.getElementById('appMain');
    if (authScreen) {
        authScreen.style.display = 'flex';
        authScreen.style.visibility = 'visible';
        authScreen.style.opacity = '1';
    }
    if (appMain) {
        appMain.style.display = 'none';
        appMain.style.visibility = 'hidden';
    }
    fixFullScreen();
}

function showAppMain() {
    var authScreen = document.getElementById('authScreen');
    var appMain = document.getElementById('appMain');
    if (authScreen) {
        authScreen.style.display = 'none';
        authScreen.style.visibility = 'hidden';
    }
    if (appMain) {
        appMain.style.display = 'flex';
        appMain.style.visibility = 'visible';
        appMain.style.opacity = '1';
    }
    fixFullScreen();
}

function updateUIForUser(user) {
    if (!user) return;
    
    var profileName = document.getElementById('profileName');
    var profileRole = document.getElementById('profileRole');
    var profileModalName = document.getElementById('profileModalName');
    var profileModalEmail = document.getElementById('profileModalEmail');
    var profileModalRole = document.getElementById('profileModalRole');
    
    if (profileName) profileName.textContent = user.name;
    if (profileRole) profileRole.textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    if (profileModalName) profileModalName.textContent = user.name;
    if (profileModalEmail) profileModalEmail.textContent = user.email;
    if (profileModalRole) profileModalRole.textContent = 'Role: ' + user.role.charAt(0).toUpperCase() + user.role.slice(1);
    
    var userChats = user.chats || [];
    var statChats = document.getElementById('statChats');
    var statMessages = document.getElementById('statMessages');
    var statModels = document.getElementById('statModels');
    var statPinned = document.getElementById('statPinned');
    
    if (statChats) statChats.textContent = userChats.length;
    
    var totalMessages = 0;
    var models = new Set();
    var pinned = 0;
    userChats.forEach(function(chat) {
        if (chat.messages) {
            totalMessages += chat.messages.length;
        }
        if (chat.model) {
            models.add(chat.model);
        }
        if (chat.pinned) {
            pinned++;
        }
    });
    if (statMessages) statMessages.textContent = totalMessages;
    if (statModels) statModels.textContent = models.size || 0;
    if (statPinned) statPinned.textContent = pinned;
}

// ============================================
// FULL SCREEN FIX
// ============================================

function fixFullScreen() {
    var appMain = document.getElementById('appMain');
    var authScreen = document.getElementById('authScreen');
    
    document.documentElement.style.height = '100%';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.height = '100%';
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    
    if (appMain) {
        appMain.style.width = '100vw';
        appMain.style.height = '100vh';
        appMain.style.position = 'fixed';
        appMain.style.top = '0';
        appMain.style.left = '0';
        appMain.style.overflow = 'hidden';
        appMain.style.display = 'flex';
    }
    
    if (authScreen) {
        authScreen.style.width = '100vw';
        authScreen.style.height = '100vh';
        authScreen.style.position = 'fixed';
        authScreen.style.top = '0';
        authScreen.style.left = '0';
        authScreen.style.overflow = 'hidden';
        authScreen.style.display = 'flex';
    }
}

window.addEventListener('resize', function() {
    fixFullScreen();
});

// ============================================
// USER CHAT MANAGEMENT
// ============================================

function getUserChats() {
    if (!currentUser) return [];
    var user = findUserById(currentUser.id);
    return user ? user.chats || [] : [];
}

function addUserChat(chat) {
    if (!currentUser) return null;
    var user = findUserById(currentUser.id);
    if (user) {
        if (!user.chats) user.chats = [];
        user.chats.push(chat);
        saveUsers();
        setCurrentUser(user);
        return chat;
    }
    return null;
}

function updateUserChat(chatId, data) {
    if (!currentUser) return null;
    var user = findUserById(currentUser.id);
    if (user && user.chats) {
        var index = user.chats.findIndex(function(c) { return c.id === chatId; });
        if (index > -1) {
            user.chats[index] = Object.assign({}, user.chats[index], data);
            saveUsers();
            setCurrentUser(user);
            return user.chats[index];
        }
    }
    return null;
}

function deleteUserChat(chatId) {
    if (!currentUser) return false;
    var user = findUserById(currentUser.id);
    if (user && user.chats) {
        user.chats = user.chats.filter(function(c) { return c.id !== chatId; });
        saveUsers();
        setCurrentUser(user);
        return true;
    }
    return false;
}

function updateUserChatHistory(chatId, messages) {
    if (!currentUser) return false;
    var user = findUserById(currentUser.id);
    if (user && user.chats) {
        var chat = user.chats.find(function(c) { return c.id === chatId; });
        if (chat) {
            chat.messages = messages;
            chat.updated = new Date().toISOString();
            saveUsers();
            setCurrentUser(user);
            return true;
        }
    }
    return false;
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderChats() {
    chatsList.innerHTML = '';
    if (chats.length === 0) {
        chatsList.innerHTML = '<div style="padding: 20px 12px; text-align: center; color: var(--text-muted); font-size: 13px;">No chats yet.<br>Start a new conversation!</div>';
        return;
    }
    chats.forEach(function(chat) {
        var div = document.createElement('div');
        div.className = 'chat-item' + (chat.id === currentChatId ? ' active' : '');
        div.dataset.id = chat.id;
        var lastMsg = chatHistory[chat.id] && chatHistory[chat.id].length > 0 ? chatHistory[chat.id][chatHistory[chat.id].length - 1] : null;
        div.innerHTML = '<div><span class="chat-item-title">' + chat.name + '</span><span class="chat-item-time">' + (lastMsg ? lastMsg.time : 'New') + '</span><span class="chat-item-preview">' + (lastMsg ? lastMsg.content.substring(0, 40) + '...' : 'No messages') + '</span></div>';
        div.addEventListener('click', function() { loadChat(chat.id); });
        chatsList.appendChild(div);
    });
}

function loadChat(chatId) {
    currentChatId = chatId;
    renderChats();
    var chat = chats.find(function(c) { return c.id === chatId; });
    if (chat) {
        chatTitle.textContent = chat.name;
        chatStatus.textContent = 'Active';
        chatStatus.className = 'status-badge active';
        modelSelector.value = chat.model || 'deepseek';
        var history = chatHistory[chatId] || [];
        renderMessages(history);
    }
}

function renderMessages(history) {
    chatMessages.innerHTML = '';
    if (!history || history.length === 0) {
        chatMessages.innerHTML = '<div class="message-center"><div class="ai-orb"><svg width="80" height="80" viewBox="0 0 80 80" fill="none"><rect x="10" y="10" width="60" height="60" rx="20" fill="currentColor" opacity="0.04"/><rect x="20" y="20" width="40" height="40" rx="12" fill="currentColor" opacity="0.06"/><path d="M36 32L44 40L36 48" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M44 32L36 40L44 48" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg><div class="orb-glow"></div></div><h3>Start a conversation</h3><p>Ask anything</p></div>';
        return;
    }
    history.forEach(function(msg) {
        var div = document.createElement('div');
        div.className = 'message ' + msg.role;
        div.innerHTML = '<div class="message-content">' + msg.content + '</div><div class="message-time">' + msg.time + '</div>';
        chatMessages.appendChild(div);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    var div = document.createElement('div');
    div.className = 'typing-indicator';
    div.id = 'typingIndicator';
    div.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
    var indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
}

function autoGrowTextarea() {
    promptInput.style.height = 'auto';
    promptInput.style.height = Math.min(promptInput.scrollHeight, 200) + 'px';
}

// ============================================
// SEND MESSAGE
// ============================================

async function sendMessage() {
    var text = promptInput.value.trim();
    if (!text) return;
    if (!currentChatId) {
        createNewChat();
        if (!currentChatId) return;
    }
    var time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    if (!chatHistory[currentChatId]) {
        chatHistory[currentChatId] = [];
    }
    chatHistory[currentChatId].push({ role: 'user', content: text, time: time });
    updateUserChatHistory(currentChatId, chatHistory[currentChatId]);
    renderMessages(chatHistory[currentChatId]);
    promptInput.value = '';
    charCount.textContent = '0';
    promptInput.style.height = 'auto';
    sendBtn.disabled = true;
    showTypingIndicator();
    try {
        var model = modelSelector.value;
        var apiMessages = chatHistory[currentChatId].map(function(msg) { return { role: msg.role, content: msg.content }; });
        var response = await callAI(model, apiMessages);
        var respTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        removeTypingIndicator();
        chatHistory[currentChatId].push({ role: 'assistant', content: response, time: respTime });
        updateUserChatHistory(currentChatId, chatHistory[currentChatId]);
        renderMessages(chatHistory[currentChatId]);
        updateUIForUser(currentUser);
        var chat = chats.find(function(c) { return c.id === currentChatId; });
        if (chat && (chat.name === 'New Chat' || chat.name === 'Welcome Chat' || chat.name.startsWith('Chat'))) {
            var newName = generateChatName(chatHistory[currentChatId]);
            if (newName && newName.length > 2) {
                chat.name = newName;
                updateUserChat(currentChatId, { name: newName });
                renderChats();
                chatTitle.textContent = newName;
            }
        }
    } catch (error) {
        removeTypingIndicator();
        var errorTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        chatHistory[currentChatId].push({ role: 'assistant', content: 'Error: ' + error.message, time: errorTime });
        updateUserChatHistory(currentChatId, chatHistory[currentChatId]);
        renderMessages(chatHistory[currentChatId]);
    }
    sendBtn.disabled = false;
    saveChats();
}

// ============================================
// CREATE NEW CHAT
// ============================================

function createNewChat() {
    var newChat = {
        id: Date.now(),
        name: 'New Chat',
        model: modelSelector.value,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        pinned: false,
        messages: [{ role: 'assistant', content: 'Welcome to your new chat! How can I help you?', time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) }]
    };
    addUserChat(newChat);
    chats.push(newChat);
    chatHistory[newChat.id] = newChat.messages;
    renderChats();
    loadChat(newChat.id);
    saveChats();
}

// ============================================
// DELETE CHAT
// ============================================

function deleteChat() {
    if (currentChatId) {
        if (confirm('Delete this chat?')) {
            deleteUserChat(currentChatId);
            var index = chats.findIndex(function(c) { return c.id === currentChatId; });
            if (index > -1) {
                chats.splice(index, 1);
                delete chatHistory[currentChatId];
                currentChatId = null;
                renderChats();
                saveChats();
                chatMessages.innerHTML = '<div class="message-center"><div class="ai-orb"><svg width="80" height="80" viewBox="0 0 80 80" fill="none"><rect x="10" y="10" width="60" height="60" rx="20" fill="currentColor" opacity="0.04"/><rect x="20" y="20" width="40" height="40" rx="12" fill="currentColor" opacity="0.06"/><path d="M36 32L44 40L36 48" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M44 32L36 40L44 48" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg><div class="orb-glow"></div></div><h3>Chat deleted</h3><p>Start a new conversation</p></div>';
                chatTitle.textContent = 'Cuddly AI';
                chatStatus.textContent = 'Ready';
                chatStatus.className = 'status-badge';
                updateUIForUser(currentUser);
            }
        }
    }
}

// ============================================
// SAVE CHATS
// ============================================

function saveChats() {
    try {
        localStorage.setItem('cuddly-chats', JSON.stringify(chats));
        localStorage.setItem('cuddly-history', JSON.stringify(chatHistory));
        if (currentUser) {
            var user = findUserById(currentUser.id);
            if (user) {
                user.chats = chats.map(function(chat) {
                    return Object.assign({}, chat, { messages: chatHistory[chat.id] || [] });
                });
                saveUsers();
                setCurrentUser(user);
            }
        }
    } catch (e) {
        console.warn('Could not save chats:', e);
    }
}

function loadSavedChats() {
    try {
        if (currentUser) {
            var user = findUserById(currentUser.id);
            if (user && user.chats && user.chats.length > 0) {
                chats = user.chats;
                user.chats.forEach(function(chat) {
                    chatHistory[chat.id] = chat.messages || [];
                });
                return;
            }
        }
        var savedChats = localStorage.getItem('cuddly-chats');
        var savedHistory = localStorage.getItem('cuddly-history');
        if (savedChats) {
            chats = JSON.parse(savedChats);
        }
        if (savedHistory) {
            chatHistory = JSON.parse(savedHistory);
        }
    } catch (e) {
        console.warn('Could not load saved chats:', e);
        chats = [];
        chatHistory = {};
    }
}

// ============================================
// SETTINGS / API KEYS
// ============================================

function openSettings() {
    deepseekKeyInput.value = API_KEYS.deepseek || '';
    geminiKeyInput.value = API_KEYS.gemini || '';
    claudeKeyInput.value = API_KEYS.claude || '';
    openaiKeyInput.value = API_KEYS.openai || '';
    settingsModal.classList.add('active');
}

function closeSettingsModal() {
    settingsModal.classList.remove('active');
}

function saveAPIKeys() {
    var deepseek = deepseekKeyInput.value.trim();
    var gemini = geminiKeyInput.value.trim();
    var claude = claudeKeyInput.value.trim();
    var openai = openaiKeyInput.value.trim();
    API_KEYS.deepseek = deepseek;
    API_KEYS.gemini = gemini;
    API_KEYS.claude = claude;
    API_KEYS.openai = openai;
    localStorage.setItem('cuddly-deepseek-key', deepseek);
    localStorage.setItem('cuddly-gemini-key', gemini);
    localStorage.setItem('cuddly-claude-key', claude);
    localStorage.setItem('cuddly-openai-key', openai);
    updateAPIStatus();
    closeSettingsModal();
    var saved = [];
    if (deepseek) saved.push('DeepSeek');
    if (gemini) saved.push('Gemini');
    if (claude) saved.push('Claude');
    if (openai) saved.push('OpenAI');
    if (saved.length > 0) {
        alert('API keys saved successfully!\n\nEnabled: ' + saved.join(', '));
    } else {
        alert('No API keys provided. The app will use simulation mode.');
    }
}

// ============================================
// COMMAND PALETTE
// ============================================

function openCommandPalette() {
    commandPalette.classList.add('active');
    commandInput.value = '';
    commandInput.focus();
    document.querySelectorAll('.command-item').forEach(function(item) {
        item.style.display = '';
    });
}

function closeCommandPalette() {
    commandPalette.classList.remove('active');
}

// ============================================
// AUTH EVENT LISTENERS
// ============================================

document.getElementById('googleAuthBtn').addEventListener('click', function() {
    console.log('Google auth button clicked');
    signInWithGoogle()
        .then(function(user) {
            console.log('Google auth success:', user);
            showAppMain();
            updateUIForUser(user);
            loadSavedChats();
            renderChats();
            if (chats.length > 0) {
                loadChat(chats[0].id);
            }
        })
        .catch(function(error) {
            console.error('Google auth failed:', error);
            alert('Google authentication failed: ' + error.message);
        });
});

document.getElementById('guestAuthBtn').addEventListener('click', function() {
    console.log('Guest auth button clicked');
    signInAsGuest()
        .then(function(user) {
            console.log('Guest auth success:', user);
            showAppMain();
            updateUIForUser(user);
            loadSavedChats();
            renderChats();
            if (chats.length > 0) {
                loadChat(chats[0].id);
            }
        })
        .catch(function(error) {
            console.error('Guest auth failed:', error);
            alert('Guest authentication failed: ' + error.message);
        });
});

document.getElementById('logoutBtn').addEventListener('click', function() {
    if (confirm('Are you sure you want to logout?')) {
        logout();
    }
});

// ============================================
// OTHER EVENT LISTENERS
// ============================================

sendBtn.addEventListener('click', sendMessage);

promptInput.addEventListener('input', function() {
    var count = promptInput.value.length;
    charCount.textContent = count > 0 ? count + '/1000' : '0';
    autoGrowTextarea();
});

promptInput.addEventListener('keydown', function(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
    }
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
    if (e.key === 'Enter' && e.shiftKey) {
        setTimeout(autoGrowTextarea, 0);
    }
});

newChatBtn.addEventListener('click', createNewChat);

clearBtn.addEventListener('click', function() {
    if (currentChatId && chatHistory[currentChatId]) {
        if (confirm('Clear all messages?')) {
            chatHistory[currentChatId] = [];
            updateUserChatHistory(currentChatId, []);
            renderMessages([]);
            saveChats();
        }
    }
});

deleteBtn.addEventListener('click', deleteChat);

shareBtn.addEventListener('click', function() {
    if (currentChatId && chatHistory[currentChatId]) {
        var text = chatHistory[currentChatId].map(function(m) { return m.role + ': ' + m.content; }).join('\n\n');
        navigator.clipboard.writeText(text).then(function() {
            alert('Chat copied to clipboard!');
        }).catch(function() {
            alert('Could not copy chat');
        });
    }
});

pinBtn.addEventListener('click', function() {
    if (currentChatId) {
        var chat = chats.find(function(c) { return c.id === currentChatId; });
        if (chat) {
            chat.pinned = !chat.pinned;
            updateUserChat(currentChatId, { pinned: chat.pinned });
            alert(chat.pinned ? 'Chat pinned!' : 'Chat unpinned!');
            saveChats();
        }
    }
});

attachBtn.addEventListener('click', function() { alert('File attachment (demo)'); });
voiceBtn.addEventListener('click', function() { alert('Voice input (demo)'); });

settingsBtn.addEventListener('click', openSettings);
closeSettings.addEventListener('click', closeSettingsModal);
settingsModal.addEventListener('click', function(e) {
    if (e.target === settingsModal) closeSettingsModal();
});
saveKeysBtn.addEventListener('click', saveAPIKeys);

document.querySelectorAll('.form-group input').forEach(function(input) {
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            saveAPIKeys();
        }
    });
});

modelSelector.addEventListener('change', function() {
    if (currentChatId) {
        var chat = chats.find(function(c) { return c.id === currentChatId; });
        if (chat) {
            chat.model = modelSelector.value;
            updateUserChat(currentChatId, { model: modelSelector.value });
            saveChats();
        }
    }
});

searchInput.addEventListener('input', function(e) {
    var query = e.target.value.toLowerCase();
    document.querySelectorAll('.chat-item').forEach(function(item) {
        var title = item.querySelector('.chat-item-title')?.textContent?.toLowerCase() || '';
        item.style.display = title.includes(query) ? '' : 'none';
    });
});

document.addEventListener('keydown', function(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (commandPalette.classList.contains('active')) {
            closeCommandPalette();
        } else {
            openCommandPalette();
        }
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        createNewChat();
    }
    if (e.key === 'Escape') {
        if (commandPalette.classList.contains('active')) closeCommandPalette();
        if (settingsModal.classList.contains('active')) closeSettingsModal();
    }
});

commandInput.addEventListener('input', function() {
    var query = commandInput.value.toLowerCase();
    document.querySelectorAll('.command-item').forEach(function(item) {
        var text = item.textContent?.toLowerCase() || '';
        item.style.display = text.includes(query) ? '' : 'none';
    });
});

commandResults.querySelectorAll('.command-item').forEach(function(item) {
    item.addEventListener('click', function() {
        var action = item.dataset.action;
        closeCommandPalette();
        if (action === 'newChat') {
            createNewChat();
        } else if (action === 'settings') {
            openSettings();
        }
    });
});

commandPalette.querySelector('.command-overlay').addEventListener('click', closeCommandPalette);

// ============================================
// INITIALIZATION - ZERO STATE
// ============================================

function initApp() {
    console.log('🔄 Initializing app...');
    
    loadUsers();
    
    var savedUser = getCurrentUser();
    if (savedUser) {
        console.log('Saved user found:', savedUser.name);
        currentUser = savedUser;
        showAppMain();
        updateUIForUser(savedUser);
        loadSavedChats();
        renderChats();
        if (chats.length > 0) {
            loadChat(chats[0].id);
        }
    } else {
        console.log('No saved user, showing auth screen');
        showAuthScreen();
    }
    
    applyTheme(currentTheme);
    updateAPIStatus();
    fixFullScreen();
    
    console.log('🐻 Cuddly AI v1.0 - Zero State');
    console.log('Users in system:', users.length);
    console.log('Chats:', chats.length);
    console.log('Cmd+K - Command Palette');
    console.log('Cmd+Shift+N - New Chat');
}

// ============================================
// START APP - ZERO STATE
// ============================================

console.log('🚀 Starting Cuddly AI v1.0 - Zero State...');

// Boshlang'ich holat - 0
users = [];
chats = [];
chatHistory = {};
currentUser = null;
currentChatId = null;

initApp();

console.log('✅ Cuddly AI is ready!');
console.log('📌 Use "Guest" or "Google" to sign in');