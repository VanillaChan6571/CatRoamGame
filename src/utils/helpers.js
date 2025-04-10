// Utility helper functions
const { ITEMS, TAGS, LUCK_MULTIPLIERS, LUCK_TAG_CHANCE, RARITY_WEIGHTS } = require('../config/constants');

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

    const totalWeight = RARITY_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < RARITY_WEIGHTS.length; i++) {
        if (random < RARITY_WEIGHTS[i]) {
            return rarities[i];
        }
        random -= RARITY_WEIGHTS[i];
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

// Calculate item value based on tag and luck
function calculateItemValue(tag, luckTag) {
    // Calculate value based on tag range
    const baseValue = getRandomNumber(TAGS[tag].min, TAGS[tag].max);

    // Apply luck multiplier if exists
    if (luckTag) {
        return Math.floor(baseValue * LUCK_MULTIPLIERS[luckTag]);
    }

    return baseValue;
}

module.exports = {
    getRandomItem,
    getRandomNumber,
    getRandomTag,
    getRandomLuckTag,
    calculateItemValue
};