// Game constants

// Timing constants
const COOLDOWN_TIME = 10000; // 10 seconds between messages
const ROAM_TIME = 120000; // 2 minutes (120 seconds) for item catching
const LUCK_TAG_CHANCE = 0.02; // 2% chance for luck multipliers

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

// Rarity weights for tag generation
const RARITY_WEIGHTS = [45, 30, 15, 5, 3, 1.5, 0.5]; // Weights for each rarity tier

module.exports = {
    COOLDOWN_TIME,
    ROAM_TIME,
    LUCK_TAG_CHANCE,
    ITEMS,
    TAGS,
    LUCK_MULTIPLIERS,
    RARITY_WEIGHTS
};