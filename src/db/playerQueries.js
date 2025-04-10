// Player-related database operations
const { db } = require('./database');

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

module.exports = {
    updatePlayerUsername,
    addUsernameToHistory,
    getUsernameHistory
};