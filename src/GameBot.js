// Add a .env file for environment variables
require('dotenv').config();

// Twitch Chat Game Bot
const tmi = require('tmi.js');
const COOLDOWN_TIME = 10000; // 10 seconds between messages
const ROAM_TIME = 120000; // 2 minutes (120 seconds) for item catching
const LUCK_TAG_CHANCE = 0.02; // 2% chance for luck multipliers

// Twitch Bot Configuration - Load from environment variables
const BOT_USERNAME = process.env.BOT_USERNAME;
const BOT_OAUTH_TOKEN = process.env.BOT_OAUTH_TOKEN;
const CHANNELS = process.env.CHANNELS ? process.env.CHANNELS.split(',') : ['your_channel'];

// Create Twitch client
const client = new tmi.Client({
    options: { debug: process.env.DEBUG === 'true' },
    identity: {
        username: BOT_USERNAME,
        password: BOT_OAUTH_TOKEN
    },
    channels: CHANNELS
});

// Item definitions by rarity
const ITEMS = {
    COMMON: ["Fish", "Mouse", "Rat", "Yarn Ball"],
    UNCOMMON: ["Shoe", "Bird", "Spider"],
    RARE: ["Yarn Ball", "String"],
    ULTRA: ["Can of Beans", "Bigger Fish"],
    LEGEND: ["Fluffy Pillow", "Chicken"],
    EXTREME: ["Cat Nip", "Lolipop"],
    LUCKY: ["Koi Fish", "Golden Yarn Ball"]
};

// Tag value ranges
const TAGS = {
    COMMON: { min: 25, max: 75 },
    UNCOMMON: { min: 100, max: 200 },
    RARE: { min: 300, max: 600 },
    ULTRA: { min: 900, max: 1200 },
    LEGEND: { min: 1200, max: 2000 },
    EXTREME: { min: 3000, max: 5000 },
    LUCKY: { min: 7500, max: 10000 }
};

// Luck multipliers
const LUCK_MULTIPLIERS = {
    "KITTEN LUCK": 2,
    "CAT LUCK": 3,
    "NEKO LUCK": 4,
    "GOD LUCK": 5,
    "GODDESS LUCK": 10
};

// Game state
let queue = [];
let inGame = new Set();
let lastMessageTime = 0;

// SQLite for database storage
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

        // Create index on username_history for efficient lookups
        db.run(`CREATE INDEX IF NOT EXISTS idx_username_history_user_id ON username_history(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_username_history_username ON username_history(username)`);

        console.log('Database initialized successfully');
    });
}

// Update player record and track username changes
function updatePlayerUsername(userId, username) {
    const currentTime = Date.now();

    // Check if this user already exists
    db.get(`SELECT current_username FROM players WHERE user_id = ?`, [userId], (err, row) => {
        if (err) {
            console.error('Error checking player:', err);
            return;
        }

        if (row) {
            // User exists, check if username changed
            if (row.current_username !== username) {
                // Update the player's current username
                db.run(`UPDATE players SET current_username = ?, last_updated = ? WHERE user_id = ?`,
                    [username, currentTime, userId]);

                // Update the end date for the previous username
                db.run(`UPDATE username_history 
                SET last_seen = ? 
                WHERE user_id = ? AND username = ? AND last_seen = 9999999999999`,
                    [currentTime, userId, row.current_username]);

                // Add the new username to history
                addUsernameToHistory(userId, username, currentTime);
            }
        } else {
            // New user, create player record
            db.run(`INSERT INTO players (user_id, current_username, best_value, total_catches, last_updated) 
              VALUES (?, ?, 0, 0, ?)`,
                [userId, username, currentTime]);

            // Add first username to history
            addUsernameToHistory(userId, username, currentTime);
        }
    });
}

// Add username to history
function addUsernameToHistory(userId, username, timestamp) {
    // Check if this username is already in history for this user
    db.get(`SELECT id FROM username_history WHERE user_id = ? AND username = ?`,
        [userId, username], (err, row) => {
            if (err) {
                console.error('Error checking username history:', err);
                return;
            }

            if (!row) {
                // Add new username to history with "current" marker (9999999999999 as last_seen)
                db.run(`INSERT INTO username_history (user_id, username, first_seen, last_seen) 
                VALUES (?, ?, ?, 9999999999999)`,
                    [userId, username, timestamp]);
            } else {
                // If it exists but was ended, create a new entry
                db.get(`SELECT id FROM username_history WHERE user_id = ? AND username = ? AND last_seen = 9999999999999`,
                    [userId, username], (err, activeRow) => {
                        if (err || activeRow) return; // Error or already active

                        // Create new active entry for this username
                        db.run(`INSERT INTO username_history (user_id, username, first_seen, last_seen) 
                    VALUES (?, ?, ?, 9999999999999)`,
                            [userId, username, timestamp]);
                    });
            }
        });
}

// Get username history for a user
function getUsernameHistory(userId, callback) {
    db.all(`SELECT username, first_seen, last_seen 
          FROM username_history 
          WHERE user_id = ? 
          ORDER BY first_seen DESC`,
        [userId], (err, rows) => {
            if (err) {
                console.error('Error fetching username history:', err);
                callback([]);
            } else {
                callback(rows);
            }
        });
}

// Get leaderboard from database
function getLeaderboard(callback) {
    db.all(`SELECT user_id, current_username, best_value 
          FROM players 
          ORDER BY best_value DESC 
          LIMIT 5`,
        (err, rows) => {
            if (err) {
                console.error('Error fetching leaderboard:', err);
                callback([]);
            } else {
                callback(rows);
            }
        }
    );
}

// Save catch to database
function saveCatch(userId, username, item, tag, luckTag, value) {
    const timestamp = Date.now();

    // Update player username first (handles new players and username changes)
    updatePlayerUsername(userId, username);

    // Begin transaction
    db.serialize(() => {
        // Update player stats
        db.run(`UPDATE players 
            SET best_value = MAX(best_value, ?),
                total_catches = total_catches + 1,
                last_updated = ?
            WHERE user_id = ?`,
            [value, timestamp, userId],
            function(err) {
                if (err) {
                    console.error('Error updating player stats:', err);
                }
            }
        );

        // Insert catch record
        db.run(`INSERT INTO catches (user_id, username, item, tag, luck_tag, value, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, username, item, tag, luckTag || null, value, timestamp],
            function(err) {
                if (err) {
                    console.error('Error saving catch:', err);
                }
            }
        );
    });
}

// Initialize database on startup
initDatabase();

// Helper function to get random item from array
function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// Helper function to get random number between min and max (inclusive)
function getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper function to get random tag (rarity)
function getRandomTag() {
    const rarities = Object.keys(TAGS);
    const rarityWeights = [45, 30, 15, 5, 3, 1.5, 0.5]; // Weights for each rarity tier

    const totalWeight = rarityWeights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < rarityWeights.length; i++) {
        if (random < rarityWeights[i]) {
            return rarities[i];
        }
        random -= rarityWeights[i];
    }

    return "COMMON"; // Fallback
}

// Helper function to get random luck multiplier
function getRandomLuckTag() {
    if (Math.random() < LUCK_TAG_CHANCE) {
        const luckTags = Object.keys(LUCK_MULTIPLIERS);
        return getRandomItem(luckTags);
    }
    return null;
}

// Process the roam queue
function processRoam() {
    if (queue.length === 0) return;

    const currentTime = Date.now();
    if (currentTime - lastMessageTime < COOLDOWN_TIME) return;

    // Process up to 3 users at once
    const batchSize = Math.min(3, queue.length);
    const currentBatch = queue.splice(0, batchSize);

    let message = "";

    currentBatch.forEach(user => {
        const userId = user.id;
        const username = user.name;

        // Choose a random tag (rarity tier)
        const tag = getRandomTag();

        // Choose a random item from that tier
        const item = getRandomItem(ITEMS[tag]);

        // Calculate value based on tag range
        const baseValue = getRandomNumber(TAGS[tag].min, TAGS[tag].max);

        // Check for luck multiplier
        const luckTag = getRandomLuckTag();
        let finalValue = baseValue;

        if (luckTag) {
            finalValue = Math.floor(baseValue * LUCK_MULTIPLIERS[luckTag]);
        }

        // Add user's catch to database
        saveCatch(userId, username, item, tag, luckTag, finalValue);

        // Create message part
        message += `@${username}'s cat returned! it found ${item} rarity of ${tag}`;
        if (luckTag) {
            message += ` x ${luckTag}`;
        }
        message += ` worth over ${finalValue} Vanilla Coins! `;

        // Remove user from in-game set
        inGame.delete(userId);
    });

    // Send the message to Twitch chat
    client.say(CHANNELS[0], message);

    // Update last message time
    lastMessageTime = currentTime;
}

// Handle user commands
function handleCommand(userId, username, command) {
    const currentTime = Date.now();

    switch (command.toLowerCase()) {
        case "!roam":
            if (inGame.has(userId)) {
                // User is already in queue
                if (currentTime - lastMessageTime >= COOLDOWN_TIME) {
                    client.say(CHANNELS[0], `Whoa! @${username}, you're cat is already roaming! please wait for it to come back!`);
                    lastMessageTime = currentTime;
                }
            } else {
                // Add user to queue
                queue.push({id: userId, name: username});
                inGame.add(userId);

                if (currentTime - lastMessageTime >= COOLDOWN_TIME) {
                    client.say(CHANNELS[0], `@${username}'s cat is now in purrsuit~!`);
                    lastMessageTime = currentTime;
                }
            }
            break;

        case "!roamboards":
            if (currentTime - lastMessageTime >= COOLDOWN_TIME) {
                // Display top 5 leaderboard from database
                getLeaderboard((topPlayers) => {
                    if (topPlayers.length === 0) {
                        client.say(CHANNELS[0], "Rare Error! @VanillaChanny something has gone wrong.");
                    } else {
                        let message = "Top Roamers: ";

                        topPlayers.forEach((player, index) => {
                            message += `#${index + 1} @${player.current_username} (${player.best_value} VC)${index < topPlayers.length - 1 ? ", " : ""}`;
                        });

                        client.say(CHANNELS[0], message);
                    }
                });

                lastMessageTime = currentTime;
            }
            break;

        case "!namehist":
            if (currentTime - lastMessageTime >= COOLDOWN_TIME) {
                // Check for mod status here if needed

                // Get username history for this user
                getUsernameHistory(userId, (history) => {
                    if (history.length === 0) {
                        client.say(CHANNELS[0], `@${username} has no recorded username changes when deployed on 04/07/2025`);
                    } else {
                        let message = `@${username} username history: `;

                        // Format dates nicely and build message
                        history.forEach((entry, index) => {
                            const firstSeen = new Date(entry.first_seen).toLocaleDateString();
                            const lastSeen = entry.last_seen === 9999999999999 ?
                                "Current" : new Date(entry.last_seen).toLocaleDateString();

                            message += `${entry.username} (${firstSeen} to ${lastSeen})${index < history.length - 1 ? ", " : ""}`;
                        });

                        client.say(CHANNELS[0], message);
                    }
                });

                lastMessageTime = currentTime;
            }
            break;
    }
}

// Set up interval to process roam queue every 2 minutes
setInterval(processRoam, ROAM_TIME);

// Clean up database connection on exit
process.on('exit', () => {
    db.close();
    console.log('Database connection closed');
});

// Connect to Twitch
client.connect().catch(console.error);
console.log('Bot is starting...');

// Listen for commands
client.on('message', (channel, tags, message, self) => {
    // Ignore messages from the bot itself
    if (self) return;

    // Extract user information
    const userId = tags['user-id'];
    const username = tags['display-name'];

    // Handle commands
    if (message.startsWith('!')) {
        handleCommand(userId, username, message.trim());
    }
});

// For debugging only - remove these in production
// Example usage (for demonstration)
/*
handleCommand("12345", "User1", "!roam");
handleCommand("67890", "User2", "!roam");
handleCommand("13579", "User3", "!roam");
handleCommand("24680", "User4", "!roam");
handleCommand("11111", "User5", "!roam");

// Simulate a username change for User1
setTimeout(() => {
  handleCommand("12345", "NewName1", "!roam");
}, 10000);

// This would show the leaderboard
setTimeout(() => {
  handleCommand("99999", "Someone", "!roamboards");
}, 150000);

// Example of checking username history
setTimeout(() => {
  handleCommand("12345", "NewName1", "!namehist");
}, 160000);
*/