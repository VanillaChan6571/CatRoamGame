// Game-related database operations
const { db } = require('./database');
const { updatePlayerUsername } = require('./playerQueries');

// Get leaderboard from database
function getLeaderboard(callback) {
    // Calculate total coins for each player by summing all their catch values
    db.all(`SELECT p.user_id, p.current_username, SUM(c.value) as total_coins
        FROM players p
        JOIN catches c ON p.user_id = c.user_id
        GROUP BY p.user_id, p.current_username
        ORDER BY total_coins DESC
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

// Get best catches leaderboard from database
function getBestCatchesLeaderboard(callback) {
    db.all(`SELECT user_id, current_username, best_value 
        FROM players 
        ORDER BY best_value DESC 
        LIMIT 5`,
        (err, rows) => {
            if (err) {
                console.error('Error fetching best catches leaderboard:', err);
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

module.exports = {
    getLeaderboard,
    getBestCatchesLeaderboard,
    saveCatch
};