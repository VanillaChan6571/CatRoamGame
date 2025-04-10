// Shop-related database operations
const { db } = require('./database');

// Get all shop items
function getShopItems(callback) {
    db.all(`SELECT * FROM shop_items ORDER BY price ASC`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching shop items:', err);
            callback([]);
        } else {
            callback(rows);
        }
    });
}

// Get user's coins (total value of catches)
function getUserCoins(userId, callback) {
    db.get(`SELECT SUM(value) as total_coins
        FROM catches
        WHERE user_id = ?`,
        [userId], (err, row) => {
            if (err) {
                console.error('Error fetching user coins:', err);
                callback(0);
            } else {
                callback(row ? row.total_coins || 0 : 0);
            }
        }
    );
}

// Get user's inventory
function getUserInventory(userId, callback) {
    db.all(`SELECT i.*, s.display_name, s.description, s.type, s.command
        FROM user_inventory i
        JOIN shop_items s ON i.item_id = s.id
        WHERE i.user_id = ?
        ORDER BY s.name`,
        [userId], (err, rows) => {
            if (err) {
                console.error('Error fetching user inventory:', err);
                callback([]);
            } else {
                callback(rows);
            }
        }
    );
}

// Get user's active effects
function getUserActiveEffects(userId, callback) {
    const currentTime = Date.now();

    db.all(`SELECT e.*, s.name, s.display_name, s.type, s.duration, s.multiplier, s.command
        FROM active_effects e
        JOIN shop_items s ON e.item_id = s.id
        WHERE e.user_id = ? AND (e.expires_at > ? OR e.used = 0)
        ORDER BY e.expires_at DESC`,
        [userId, currentTime], (err, rows) => {
            if (err) {
                console.error('Error fetching user active effects:', err);
                callback([]);
            } else {
                callback(rows);
            }
        }
    );
}

// Get shop item by command
function getShopItemByCommand(command, callback) {
    db.get(`SELECT * FROM shop_items WHERE command = ?`,
        [command], (err, item) => {
            if (err) {
                console.error('Error fetching shop item:', err);
                callback(null);
            } else {
                callback(item);
            }
        }
    );
}

// Buy shop item
function buyShopItem(userId, itemId, callback) {
    // Get item price
    db.get(`SELECT * FROM shop_items WHERE id = ?`, [itemId], (err, item) => {
        if (err || !item) {
            console.error('Error fetching shop item:', err);
            callback(false, 'Item not found');
            return;
        }

        // Get user coins
        getUserCoins(userId, (userCoins) => {
            if (userCoins < item.price) {
                callback(false, 'Not enough coins');
                return;
            }

            // Special handling for cat namer (replace existing)
            if (item.name === 'cat_namer') {
                db.run(`INSERT OR REPLACE INTO cat_names (user_id, cat_name) VALUES (?, ?)`,
                    [userId, ''], (err) => {
                        if (err) {
                            console.error('Error adding cat name placeholder:', err);
                            callback(false, 'Database error');
                            return;
                        }

                        // Add to inventory
                        const timestamp = Date.now();
                        db.run(`INSERT INTO user_inventory (user_id, item_id, quantity, purchased_at)
                            VALUES (?, ?, ?, ?)`,
                            [userId, itemId, 1, timestamp], (err) => {
                                if (err) {
                                    console.error('Error adding item to inventory:', err);
                                    callback(false, 'Database error');
                                } else {
                                    callback(true, `Successfully purchased ${item.display_name}`);
                                }
                            }
                        );
                    }
                );
                return;
            }

            // For other items, check if already in inventory and increment quantity
            db.get(`SELECT id, quantity FROM user_inventory 
                WHERE user_id = ? AND item_id = ?`,
                [userId, itemId], (err, existingItem) => {
                    if (err) {
                        console.error('Error checking inventory:', err);
                        callback(false, 'Database error');
                        return;
                    }

                    const timestamp = Date.now();

                    if (existingItem) {
                        // Update quantity
                        db.run(`UPDATE user_inventory SET quantity = quantity + 1, purchased_at = ?
                            WHERE id = ?`,
                            [timestamp, existingItem.id], (err) => {
                                if (err) {
                                    console.error('Error updating inventory:', err);
                                    callback(false, 'Database error');
                                } else {
                                    callback(true, `Successfully purchased ${item.display_name}`);
                                }
                            }
                        );
                    } else {
                        // Add new item
                        db.run(`INSERT INTO user_inventory (user_id, item_id, quantity, purchased_at)
                            VALUES (?, ?, ?, ?)`,
                            [userId, itemId, 1, timestamp], (err) => {
                                if (err) {
                                    console.error('Error adding item to inventory:', err);
                                    callback(false, 'Database error');
                                } else {
                                    callback(true, `Successfully purchased ${item.display_name}`);
                                }
                            }
                        );
                    }
                }
            );
        });
    });
}

// Apply item effect
function applyItemEffect(userId, command, param, isInRoam, callback) {
    // First get the item by command
    getShopItemByCommand(command, (item) => {
        if (!item) {
            callback(false, `Invalid item command: ${command}`);
            return;
        }

        // Check if user has the item in inventory
        db.get(`SELECT id, quantity FROM user_inventory 
            WHERE user_id = ? AND item_id = ?`,
            [userId, item.id], (err, inventoryItem) => {
                if (err) {
                    console.error('Error checking inventory:', err);
                    callback(false, 'Database error');
                    return;
                }

                if (!inventoryItem || inventoryItem.quantity <= 0) {
                    callback(false, `You don't have any ${item.display_name} in your inventory`);
                    return;
                }

                const currentTime = Date.now();

                // Handle special cases based on item type
                switch (item.name) {
                    case 'cat_namer':
                        // Ensure name parameter is valid
                        if (!param || param.length > 10) {
                            callback(false, 'Cat name must be between 1-10 characters');
                            return;
                        }

                        // Update cat name
                        db.run(`UPDATE cat_names SET cat_name = ? WHERE user_id = ?`,
                            [param, userId], (err) => {
                                if (err) {
                                    console.error('Error updating cat name:', err);
                                    callback(false, 'Database error');
                                } else {
                                    callback(true, `Your cat is now named "${param}"`);
                                }
                            }
                        );
                        break;

                    case 'catnip_1x':
                    case 'catnip_5x':
                        // Handle catnip application with quantity
                        let quantity = 1;

                        if (param && !isNaN(parseInt(param))) {
                            quantity = Math.min(parseInt(param), inventoryItem.quantity);
                        }

                        if (quantity <= 0) {
                            callback(false, 'Invalid quantity');
                            return;
                        }

                        // Check if user already has active catnip
                        db.get(`SELECT SUM(quantity) as activeAmount FROM active_effects 
                            WHERE user_id = ? AND item_id = ? AND used = 0`,
                            [userId, item.id], (err, activeData) => {
                                if (err) {
                                    console.error('Error checking active effects:', err);
                                    callback(false, 'Database error');
                                    return;
                                }

                                // Add to active effects
                                db.run(`INSERT INTO active_effects 
                                    (user_id, item_id, quantity, activated_at, expires_at, used) 
                                    VALUES (?, ?, ?, ?, NULL, 0)`,
                                    [userId, item.id, quantity, currentTime], (err) => {
                                        if (err) {
                                            console.error('Error adding effect:', err);
                                            callback(false, 'Database error');
                                            return;
                                        }

                                        // Reduce from inventory
                                        db.run(`UPDATE user_inventory SET quantity = quantity - ? 
                                            WHERE user_id = ? AND item_id = ?`,
                                            [quantity, userId, item.id], (err) => {
                                                if (err) {
                                                    console.error('Error updating inventory:', err);
                                                    callback(false, 'Database error');
                                                } else {
                                                    const existing = activeData ? activeData.activeAmount || 0 : 0;
                                                    callback(true, `Applied ${quantity}x ${item.display_name} (Total active: ${existing + quantity})`);
                                                }
                                            }
                                        );
                                    }
                                );
                            }
                        );
                        break;

                    case 'lick_vanilla_cream':
                    case 'epic_coin_booster':
                    case 'rare_coin_booster':
                    case 'common_coin_booster':
                        // Time-based effects
                        const expireTime = currentTime + item.duration;

                        // Check if user has active matching booster already
                        db.get(`SELECT MAX(expires_at) as maxExpiry FROM active_effects 
                            WHERE user_id = ? AND item_id = ? AND expires_at > ?`,
                            [userId, item.id, currentTime], (err, activeData) => {
                                if (err) {
                                    console.error('Error checking active effects:', err);
                                    callback(false, 'Database error');
                                    return;
                                }

                                // Calculate new expiry time (stack by adding duration)
                                const newExpiry = activeData && activeData.maxExpiry ?
                                    Math.max(expireTime, activeData.maxExpiry + item.duration) :
                                    expireTime;

                                // Add to active effects with calculated expiry
                                db.run(`INSERT INTO active_effects 
                                    (user_id, item_id, quantity, activated_at, expires_at, used) 
                                    VALUES (?, ?, 1, ?, ?, 0)`,
                                    [userId, item.id, currentTime, newExpiry], (err) => {
                                        if (err) {
                                            console.error('Error adding effect:', err);
                                            callback(false, 'Database error');
                                            return;
                                        }

                                        // Reduce from inventory
                                        db.run(`UPDATE user_inventory SET quantity = quantity - 1 
                                            WHERE user_id = ? AND item_id = ?`,
                                            [userId, item.id], (err) => {
                                                if (err) {
                                                    console.error('Error updating inventory:', err);
                                                    callback(false, 'Database error');
                                                } else {
                                                    const durationMinutes = Math.round((newExpiry - currentTime) / 60000);
                                                    callback(true, `Applied ${item.display_name} (Active for ${durationMinutes} minutes)`);
                                                }
                                            }
                                        );
                                    }
                                );
                            }
                        );
                        break;

                    default:
                        callback(false, 'Unknown item type');
                }
            }
        );
    });
}

// Get user's cat name
function getCatName(userId, callback) {
    db.get(`SELECT cat_name FROM cat_names WHERE user_id = ?`,
        [userId], (err, row) => {
            if (err) {
                console.error('Error fetching cat name:', err);
                callback(null);
            } else {
                callback(row ? row.cat_name : null);
            }
        }
    );
}

// Get active item effects for a user starting a roam
function getActiveRoamEffects(userId, callback) {
    const currentTime = Date.now();

    db.all(`SELECT e.*, s.name, s.type, s.multiplier 
        FROM active_effects e
        JOIN shop_items s ON e.item_id = s.id
        WHERE e.user_id = ? AND 
            ((e.expires_at > ? AND s.type = 'timed') OR 
             (e.used = 0 AND s.type = 'consumable'))
        ORDER BY s.type DESC`,
        [userId, currentTime], (err, effects) => {
            if (err) {
                console.error('Error fetching active effects:', err);
                callback({
                    luckMultiplier: 1,
                    coinMultiplier: 1,
                    rarityMultiplier: 1,
                    effectsUsed: []
                });
            } else {
                // Calculate combined effects
                let luckMultiplier = 1;
                let coinMultiplier = 1;
                let rarityMultiplier = 1;
                const effectsUsed = [];

                effects.forEach(effect => {
                    switch(effect.name) {
                        case 'lick_vanilla_cream':
                            luckMultiplier *= effect.multiplier;
                            break;
                        case 'epic_coin_booster':
                        case 'rare_coin_booster':
                        case 'common_coin_booster':
                            coinMultiplier *= effect.multiplier;
                            break;
                        case 'catnip_1x':
                        case 'catnip_5x':
                            rarityMultiplier *= effect.multiplier;

                            // For consumables, mark as used
                            if (effect.type === 'consumable' && effect.used === 0) {
                                effectsUsed.push(effect.id);
                            }
                            break;
                    }
                });

                callback({
                    luckMultiplier,
                    coinMultiplier,
                    rarityMultiplier,
                    effectsUsed
                });
            }
        }
    );
}

// Mark consumed item effects as used
function markEffectsAsUsed(effectIds, callback) {
    if (!effectIds || effectIds.length === 0) {
        callback(true);
        return;
    }

    const placeholders = effectIds.map(() => '?').join(',');

    db.run(`UPDATE active_effects SET used = 1 WHERE id IN (${placeholders})`,
        effectIds, (err) => {
            if (err) {
                console.error('Error marking effects as used:', err);
                callback(false);
            } else {
                callback(true);
            }
        }
    );
}

module.exports = {
    getShopItems,
    getUserCoins,
    getUserInventory,
    getUserActiveEffects,
    buyShopItem,
    applyItemEffect,
    getCatName,
    getActiveRoamEffects,
    markEffectsAsUsed
};