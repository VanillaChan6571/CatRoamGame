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
// Now accepts a multiplier to boost rarity odds
function getRandomTag(rarityMultiplier = 1) {
    const rarities = Object.keys(TAGS);

    // Apply the rarity multiplier to non-common weights
    // This effectively increases chance for better rarities
    const adjustedWeights = RARITY_WEIGHTS.map((weight, index) => {
        // First weight is COMMON, don't boost that
        return index === 0 ? weight : weight * rarityMultiplier;
    });

    const totalWeight = adjustedWeights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < adjustedWeights.length; i++) {
        if (random < adjustedWeights[i]) {
            return rarities[i];
        }
        random -= adjustedWeights[i];
    }

    return "COMMON"; // Fallback
}

// Helper function to get random luck multiplier
// Now accepts a multiplier to boost luck chance
function getRandomLuckTag(luckMultiplier = 1) {
    // Apply the luck multiplier to the base chance
    const adjustedChance = Math.min(1, LUCK_TAG_CHANCE * luckMultiplier);

    if (Math.random() < adjustedChance) {
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