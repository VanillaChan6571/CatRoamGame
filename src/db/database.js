// Database initialization and connection
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./gameData.db');

// Initialize database
function initDatabase() {
    db.serialize(() => {
        // Create players table if it doesn't exist (using user_id as primary key)
        db.run(`CREATE TABLE IF NOT EXISTS players (
            user_id TEXT PRIMARY KEY,
            current_username TEXT NOT NULL,
            best_value INTEGER,
            total_catches INTEGER DEFAULT 0,
            last_updated INTEGER
        )`);

        // Create username history table
        db.run(`CREATE TABLE IF NOT EXISTS username_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL,
            first_seen INTEGER NOT NULL,
            last_seen INTEGER NOT NULL,
            FOREIGN KEY(user_id) REFERENCES players(user_id)
        )`);

        // Create catches table for item history
        db.run(`CREATE TABLE IF NOT EXISTS catches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL,
            item TEXT,
            tag TEXT,
            luck_tag TEXT,
            value INTEGER,
            timestamp INTEGER,
            FOREIGN KEY(user_id) REFERENCES players(user_id)
        )`);

        // Create joined channels table for multi-channel support
        db.run(`CREATE TABLE IF NOT EXISTS joined_channels (
            channel_name TEXT PRIMARY KEY,
            broadcaster_id TEXT NOT NULL,
            joined_at INTEGER NOT NULL,
            is_main_channel BOOLEAN DEFAULT 0,
            last_seen_live BOOLEAN DEFAULT 0,
            last_checked INTEGER
        )`);

        // Create index on username_history for efficient lookups
        db.run(`CREATE INDEX IF NOT EXISTS idx_username_history_user_id ON username_history(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_username_history_username ON username_history(username)`);

        console.log('Database initialized successfully');

        // Initialize shop database tables
        initShopDatabase();
    });
}

// Initialize shop database tables - moved inside this file to avoid circular dependency
function initShopDatabase() {
    db.serialize(() => {
        // Create shop_items table to store available items
        db.run(`CREATE TABLE IF NOT EXISTS shop_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            display_name TEXT NOT NULL,
            description TEXT NOT NULL,
            price INTEGER NOT NULL,
            type TEXT NOT NULL,
            duration INTEGER,
            multiplier REAL,
            command TEXT NOT NULL
        )`);

        // Create user_inventory table to track owned items
        db.run(`CREATE TABLE IF NOT EXISTS user_inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            item_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            purchased_at INTEGER NOT NULL,
            FOREIGN KEY(user_id) REFERENCES players(user_id),
            FOREIGN KEY(item_id) REFERENCES shop_items(id)
        )`);

        // Create active_effects table to track currently active item effects
        db.run(`CREATE TABLE IF NOT EXISTS active_effects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            item_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            activated_at INTEGER NOT NULL,
            expires_at INTEGER,
            used BOOLEAN DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES players(user_id),
            FOREIGN KEY(item_id) REFERENCES shop_items(id)
        )`);

        // Create table for cat names
        db.run(`CREATE TABLE IF NOT EXISTS cat_names (
            user_id TEXT PRIMARY KEY,
            cat_name TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES players(user_id)
        )`);

        // Create indexes for efficient lookups
        db.run(`CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON user_inventory(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_active_effects_user_id ON active_effects(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_active_effects_expires_at ON active_effects(expires_at)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_cat_names_user_id ON cat_names(user_id)`);

        // Populate shop items if table is empty
        db.get(`SELECT COUNT(*) as count FROM shop_items`, [], (err, row) => {
            if (err) {
                console.error('Error checking shop items:', err);
                return;
            }

            if (row.count === 0) {
                populateShopItems();
            }
        });

        console.log('Shop database initialized successfully');
    });
}

// Populate shop with initial items
function populateShopItems() {
    const items = [
        {
            name: 'cat_namer',
            display_name: 'Cat Namer',
            description: 'Name your cat (up to 10 characters)',
            price: 20000,
            type: 'permanent',
            duration: null,
            multiplier: null,
            command: 'collar'
        },
        {
            name: 'lick_vanilla_cream',
            display_name: 'Lick Vanilla\'s Cream',
            description: 'Increases luck multiplier chance for 30 minutes',
            price: 7000,
            type: 'timed',
            duration: 30 * 60 * 1000, // 30 minutes in milliseconds
            multiplier: 2.0, // 2x chance for luck multiplier
            command: 'creamies'
        },
        {
            name: 'epic_coin_booster',
            display_name: 'Epic Vanilla Coin Booster',
            description: '2.50x coin multiplier for 30 minutes',
            price: 14250,
            type: 'timed',
            duration: 30 * 60 * 1000,
            multiplier: 2.5,
            command: 'epicboost'
        },
        {
            name: 'rare_coin_booster',
            display_name: 'Rare Vanilla Coin Booster',
            description: '1.75x coin multiplier for 30 minutes',
            price: 9500,
            type: 'timed',
            duration: 30 * 60 * 1000,
            multiplier: 1.75,
            command: 'rareboost'
        },
        {
            name: 'common_coin_booster',
            display_name: 'Common Vanilla Coin Booster',
            description: '1.25x coin multiplier for 30 minutes',
            price: 6500,
            type: 'timed',
            duration: 30 * 60 * 1000,
            multiplier: 1.25,
            command: 'boost'
        },
        {
            name: 'catnip_5x',
            display_name: 'Catnip 5x',
            description: 'Increases chance of better rarities for 5 roams',
            price: 1400,
            type: 'consumable',
            duration: null,
            multiplier: 1.5, // 50% better rarity odds
            command: 'catnip'
        },
        {
            name: 'catnip_1x',
            display_name: 'Catnip 1x',
            description: 'Increases chance of better rarities for 1 roam',
            price: 350,
            type: 'consumable',
            duration: null,
            multiplier: 1.5, // 50% better rarity odds
            command: 'catnip'
        }
    ];

    const stmt = db.prepare(`INSERT INTO shop_items 
        (name, display_name, description, price, type, duration, multiplier, command) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

    for (const item of items) {
        stmt.run([
            item.name,
            item.display_name,
            item.description,
            item.price,
            item.type,
            item.duration,
            item.multiplier,
            item.command
        ]);
    }

    stmt.finalize();
    console.log('Shop items populated successfully');
}

// Initialize bot session tracking
function initSessionTracking() {
    db.serialize(() => {
        // Create bot_sessions table to track bot startup and reconnects
        db.run(`CREATE TABLE IF NOT EXISTS bot_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            start_time INTEGER NOT NULL,
            is_restart BOOLEAN DEFAULT 0,
            session_info TEXT
        )`);

        // Create channel_connections table to track active connections
        db.run(`CREATE TABLE IF NOT EXISTS channel_connections (
            channel_name TEXT PRIMARY KEY,
            first_connected INTEGER NOT NULL,
            last_connected INTEGER NOT NULL,
            connection_count INTEGER DEFAULT 1
        )`);

        console.log('Session tracking initialized');
    });
}

// Record a new bot session
function recordBotSession(isRestart) {
    const startTime = Date.now();

    db.run(`INSERT INTO bot_sessions (start_time, is_restart, session_info) 
        VALUES (?, ?, ?)`,
        [startTime, isRestart ? 1 : 0, `Bot ${isRestart ? 'restarted' : 'started'} at ${new Date(startTime).toISOString()}`],
        function(err) {
            if (err) {
                console.error('Error recording bot session:', err);
            } else {
                console.log(`Bot session recorded: ${isRestart ? 'restart' : 'new session'}`);
            }
        }
    );
}

// Check if a channel has been connected before
function checkChannelPreviousConnection(channelName, callback) {
    // Normalize channel name
    const normalizedChannelName = channelName.replace(/^#/, '').toLowerCase();

    db.get(`SELECT * FROM channel_connections WHERE channel_name = ?`,
        [normalizedChannelName],
        (err, row) => {
            if (err) {
                console.error('Error checking channel connection history:', err);
                callback(false, 0);
            } else {
                const hadPriorConnection = !!row;
                const connectionCount = row ? row.connection_count : 0;
                callback(hadPriorConnection, connectionCount);
            }
        }
    );
}

// Update channel connection record
function updateChannelConnection(channelName) {
    // Normalize channel name
    const normalizedChannelName = channelName.replace(/^#/, '').toLowerCase();
    const currentTime = Date.now();

    db.get(`SELECT * FROM channel_connections WHERE channel_name = ?`,
        [normalizedChannelName],
        (err, row) => {
            if (err) {
                console.error('Error checking channel connection:', err);
                return;
            }

            if (row) {
                // Update existing connection
                db.run(`UPDATE channel_connections 
                    SET last_connected = ?, connection_count = connection_count + 1 
                    WHERE channel_name = ?`,
                    [currentTime, normalizedChannelName],
                    function(err) {
                        if (err) {
                            console.error('Error updating channel connection:', err);
                        } else {
                            console.log(`Updated connection for ${normalizedChannelName}`);
                        }
                    }
                );
            } else {
                // New connection
                db.run(`INSERT INTO channel_connections 
                    (channel_name, first_connected, last_connected) 
                    VALUES (?, ?, ?)`,
                    [normalizedChannelName, currentTime, currentTime],
                    function(err) {
                        if (err) {
                            console.error('Error recording channel connection:', err);
                        } else {
                            console.log(`Recorded first connection for ${normalizedChannelName}`);
                        }
                    }
                );
            }
        }
    );
}

// Check if bot has been running before
function checkPreviousBotSession(callback) {
    db.get(`SELECT COUNT(*) as sessionCount FROM bot_sessions`, [], (err, row) => {
        if (err) {
            console.error('Error checking previous bot sessions:', err);
            callback(false);
        } else {
            callback(row.sessionCount > 0);
        }
    });
}

// Initialize database on startup
initDatabase();

// Clean up database connection on exit
process.on('exit', () => {
    db.close();
    console.log('Database connection closed');
});

module.exports = {
    db,
    initDatabase,
    initSessionTracking,
    recordBotSession,
    checkChannelPreviousConnection,
    updateChannelConnection,
    checkPreviousBotSession
};