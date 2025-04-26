// Core game mechanics
const { ITEMS, ROAM_TIME, COOLDOWN_TIME } = require('../config/constants');
const { client, MAIN_CHANNEL } = require('../config/config');
const { getRandomItem, getRandomTag, getRandomLuckTag, calculateItemValue } = require('../utils/helpers');
const { saveCatch } = require('../db/gameQueries');
const { getCatName, getActiveRoamEffects, markEffectsAsUsed } = require('../db/shopQueries');
const { getJoinedChannels } = require('../db/channelQueries');

// Game state
let queue = [];
let inGame = new Map(); // Changed from Set to Map to store channel info
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

    // Create a map to organize messages by channel
    const channelMessages = new Map();

    // Process each user
    const processBatch = async () => {
        for (const user of currentBatch) {
            const userId = user.id;
            const username = user.name;
            const channel = user.channel; // Get the channel where the command originated

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

                        // Assemble the message for this user
                        let userMessage = `${userPart} returned! it found ${item} rarity of ${tag}`;

                        if (luckTag) {
                            userMessage += ` x ${luckTag}`;
                        }

                        // Add info about coin booster if active
                        if (coinMultiplier > 1) {
                            const baseValueStr = baseValue.toString();
                            userMessage += ` worth ${finalValue} Vanilla Coins! (Base: ${baseValueStr}) `;
                        } else {
                            userMessage += ` worth over ${finalValue} Vanilla Coins! `;
                        }

                        // Add this message to the appropriate channel
                        if (!channelMessages.has(channel)) {
                            channelMessages.set(channel, userMessage);
                        } else {
                            channelMessages.set(channel, channelMessages.get(channel) + " " + userMessage);
                        }

                        // Remove user from in-game map
                        inGame.delete(userId);

                        // If this is the last user in batch, send the messages
                        if (inGame.size === 0) {
                            // Send each message to its appropriate channel
                            for (const [ch, msg] of channelMessages.entries()) {
                                client.say(ch, msg);
                            }

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
                let errorMessage = `@${username}'s cat returned! it found something... `;

                if (!channelMessages.has(channel)) {
                    channelMessages.set(channel, errorMessage);
                } else {
                    channelMessages.set(channel, channelMessages.get(channel) + " " + errorMessage);
                }

                // Remove user from in-game map
                inGame.delete(userId);
            }
        }
    };

    // Handle batch processing
    processBatch().catch(err => {
        console.error('Error in batch processing:', err);

        // Send whatever messages we have so far
        if (channelMessages.size > 0) {
            for (const [ch, msg] of channelMessages.entries()) {
                client.say(ch, msg);
            }
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
function startRoam(userId, username, channel) {
    if (inGame.has(userId)) {
        return false; // Already in game
    }

    // Add user to queue with channel information
    queue.push({id: userId, name: username, channel: channel});
    inGame.set(userId, channel); // Store the channel with the user ID
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
        activePlayers: Array.from(inGame.keys()),
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