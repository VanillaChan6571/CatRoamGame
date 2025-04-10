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

        // Create index on username_history for efficient lookups
        db.run(`CREATE INDEX IF NOT EXISTS idx_username_history_user_id ON username_history(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_username_history_username ON username_history(username)`);

        console.log('Database initialized successfully');
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
    initDatabase
};