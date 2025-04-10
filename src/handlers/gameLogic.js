// Core game mechanics
const { ITEMS, ROAM_TIME, COOLDOWN_TIME } = require('../config/constants');
const { client, CHANNELS } = require('../config/config');
const { getRandomItem, getRandomTag, getRandomLuckTag, calculateItemValue } = require('../utils/helpers');
const { saveCatch } = require('../db/gameQueries');

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

    currentBatch.forEach(user => {
        const userId = user.id;
        const username = user.name;

        // Choose a random tag (rarity tier)
        const tag = getRandomTag();

        // Choose a random item from that tier
        const item = getRandomItem(ITEMS[tag]);

        // Get luck tag and calculate final value
        const luckTag = getRandomLuckTag();
        const finalValue = calculateItemValue(tag, luckTag);

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

    // Reset processing flag
    processingActive = false;
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