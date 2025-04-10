// Core game mechanics
const { ITEMS, ROAM_TIME, COOLDOWN_TIME } = require('../config/constants');
const { client, CHANNELS } = require('../config/config');
const { getRandomItem, getRandomTag, getRandomLuckTag, calculateItemValue } = require('../utils/helpers');
const { saveCatch } = require('../db/gameQueries');
const { getCatName, getActiveRoamEffects, markEffectsAsUsed } = require('../db/shopQueries');

// Game state
let queue = [];
let inGame = new Set();
let lastMessageTime = 0;
let processingActive = false; // Flag to prevent manual processing

// Process the roam queue - ONLY called by the interval
function processRoam() {
    // Don't process if flag is set or queue is empty
    if (processingActive || queue.length === 0) return;

    // Set processing flag
    processingActive = true;

    const currentTime = Date.now();

    // Check cooldown
    if (currentTime - lastMessageTime < COOLDOWN_TIME) {
        processingActive = false;
        return;
    }

    // Process up to 3 users at once
    const batchSize = Math.min(3, queue.length);
    const currentBatch = queue.splice(0, batchSize);

    let message = "";

    // Process each user
    const processBatch = async () => {
        for (const user of currentBatch) {
            const userId = user.id;
            const username = user.name;

            try {
                // Get user's active effects
                getActiveRoamEffects(userId, async (effects) => {
                    // Apply rarity boost for tag selection (catnip)
                    const rarityMultiplier = effects.rarityMultiplier || 1;

                    // Choose a random tag (rarity tier) with potential boost
                    const tag = getRandomTag(rarityMultiplier);

                    // Choose a random item from that tier
                    const item = getRandomItem(ITEMS[tag]);

                    // Get luck tag with potential boost (cream)
                    const luckMultiplier = effects.luckMultiplier || 1;
                    const luckTag = getRandomLuckTag(luckMultiplier);

                    // Calculate final value with coin boosters applied
                    const baseValue = calculateItemValue(tag, luckTag);
                    const coinMultiplier = effects.coinMultiplier || 1;
                    const finalValue = Math.floor(baseValue * coinMultiplier);

                    // Mark consumable effects as used
                    if (effects.effectsUsed && effects.effectsUsed.length > 0) {
                        markEffectsAsUsed(effects.effectsUsed, () => {});
                    }

                    // Add user's catch to database
                    saveCatch(userId, username, item, tag, luckTag, finalValue);

                    // Get cat name if available
                    getCatName(userId, (catName) => {
                        // Create message part
                        let userPart = `@${username}'s`;

                        // Add cat name if available
                        if (catName && catName.length > 0) {
                            userPart += ` "${catName}"`;
                        } else {
                            userPart += ` cat`;
                        }

                        message += `${userPart} returned! it found ${item} rarity of ${tag}`;

                        if (luckTag) {
                            message += ` x ${luckTag}`;
                        }

                        // Add info about coin booster if active
                        if (coinMultiplier > 1) {
                            const baseValueStr = baseValue.toString();
                            message += ` worth ${finalValue} Vanilla Coins! (Base: ${baseValueStr}) `;
                        } else {
                            message += ` worth over ${finalValue} Vanilla Coins! `;
                        }

                        // Remove user from in-game set
                        inGame.delete(userId);

                        // If this is the last user in batch, send the message
                        if (inGame.size === 0) {
                            // Send the message to Twitch chat
                            client.say(CHANNELS[0], message);

                            // Update last message time
                            lastMessageTime = currentTime;

                            // Reset processing flag
                            processingActive = false;
                        }
                    });
                });
            } catch (err) {
                console.error(`Error processing roam for user ${username}:`, err);

                // Add a basic message in case of error
                message += `@${username}'s cat returned! it found something... `;

                // Remove user from in-game set
                inGame.delete(userId);
            }
        }
    };

    // Handle batch processing
    processBatch().catch(err => {
        console.error('Error in batch processing:', err);

        // Send whatever message we have so far
        if (message) {
            client.say(CHANNELS[0], message);
        }

        // Clean up any remaining users
        currentBatch.forEach(user => inGame.delete(user.id));

        // Update last message time
        lastMessageTime = currentTime;

        // Reset processing flag
        processingActive = false;
    });
}

// Start the game for a user
function startRoam(userId, username) {
    if (inGame.has(userId)) {
        return false; // Already in game
    }

    // Add user to queue
    queue.push({id: userId, name: username});
    inGame.add(userId);
    return true;
}

// Check if user is in game
function isInGame(userId) {
    return inGame.has(userId);
}

// Get current game state
function getGameState() {
    return {
        queueSize: queue.length,
        activePlayers: Array.from(inGame),
        lastMessageTime,
        cooldownRemaining: Math.max(0, COOLDOWN_TIME - (Date.now() - lastMessageTime))
    };
}

// Set up interval to process roam queue every 2 minutes (ROAM_TIME)
function startGameLoop() {
    setInterval(processRoam, ROAM_TIME);
    console.log(`Game loop started with ${ROAM_TIME}ms interval`);
}

module.exports = {
    processRoam,
    startRoam,
    isInGame,
    getGameState,
    startGameLoop,
    lastMessageTime,
    setLastMessageTime: (time) => { lastMessageTime = time; }
};