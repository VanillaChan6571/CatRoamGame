// Shop-related commands
const { client } = require('../config/config');
const { COOLDOWN_TIME } = require('../config/constants');
const { getShopItems, getUserCoins, getUserInventory, getUserActiveEffects, buyShopItem, applyItemEffect, getCatName } = require('../db/shopQueries');
const { isInGame, lastMessageTime, setLastMessageTime } = require('./gameLogic');

// Handle shop command
function handleShopCommand(userId, username, channel) {
    const currentTime = Date.now();

    if (currentTime - lastMessageTime >= COOLDOWN_TIME) {
        getShopItems((items) => {
            if (items.length === 0) {
                client.say(channel, "The shop is currently empty. Try again later!");
                return;
            }

            // Get user's coins
            getUserCoins(userId, (coins) => {
                const message = `@${username}, Welcome to the Vanilla Coin Shop! You have ${coins || 0} VC. View items with !roamshop 1-7 or buy with !roambuy <item_number> you can also view the shop at https://github.com/VanillaChan6571/CatRoamGame/wiki/RoamShopItemsList`;
                client.say(channel, message);
            });
        });

        setLastMessageTime(currentTime);
    }
}

// Handle shop detail command
function handleShopDetailCommand(userId, username, param, channel) {
    const currentTime = Date.now();

    if (currentTime - lastMessageTime >= COOLDOWN_TIME) {
        // Validate page parameter
        const itemNumber = parseInt(param);

        if (isNaN(itemNumber) || itemNumber < 1 || itemNumber > 7) {
            client.say(channel, `@${username}, Please specify a valid item number (1-7)`);
            setLastMessageTime(currentTime);
            return;
        }

        // Get shop items
        getShopItems((items) => {
            if (items.length === 0 || itemNumber > items.length) {
                client.say(channel, `@${username}, That item doesn't exist in the shop.`);
                return;
            }

            const item = items[itemNumber - 1];
            const message = `@${username}, ${item.display_name} (${item.price} VC): ${item.description}. Use !roambuy ${itemNumber} to purchase.`;
            client.say(channel, message);
        });

        setLastMessageTime(currentTime);
    }
}

// Handle buy command
function handleBuyCommand(userId, username, param, channel) {
    const currentTime = Date.now();

    if (currentTime - lastMessageTime >= COOLDOWN_TIME) {
        // Validate item parameter
        const itemNumber = parseInt(param);

        if (isNaN(itemNumber) || itemNumber < 1 || itemNumber > 7) {
            client.say(channel, `@${username}, Please specify a valid item number (1-7)`);
            setLastMessageTime(currentTime);
            return;
        }

        // Get shop items
        getShopItems((items) => {
            if (items.length === 0 || itemNumber > items.length) {
                client.say(channel, `@${username}, That item doesn't exist in the shop.`);
                return;
            }

            const item = items[itemNumber - 1];

            // Try to buy the item
            buyShopItem(userId, item.id, (success, message) => {
                if (success) {
                    client.say(channel, `@${username}, ${message}! Use !roaminv to view your inventory.`);
                } else {
                    client.say(channel, `@${username}, ${message}.`);
                }
            });
        });

        setLastMessageTime(currentTime);
    }
}

// Handle inventory command
function handleInventoryCommand(userId, username, channel) {
    const currentTime = Date.now();

    if (currentTime - lastMessageTime >= COOLDOWN_TIME) {
        // Get user's inventory
        getUserInventory(userId, (items) => {
            if (items.length === 0) {
                client.say(channel, `@${username}, Your inventory is empty. Use !roamshop to visit the shop.`);
                setLastMessageTime(currentTime);
                return;
            }

            // Format inventory message
            let message = `@${username}, Your inventory: `;
            items.forEach((item, index) => {
                message += `${item.display_name} (${item.quantity}x)${index < items.length - 1 ? ", " : ""}`;
            });
            message += ". Use !roamapply <type> to use an item.";

            client.say(channel, message);
        });

        // Also check active effects
        setTimeout(() => {
            getUserActiveEffects(userId, (effects) => {
                if (effects.length > 0) {
                    let activeMessage = `@${username}, Active effects: `;

                    effects.forEach((effect, index) => {
                        if (effect.type === 'timed') {
                            const minutesLeft = Math.max(0, Math.round((effect.expires_at - currentTime) / 60000));
                            activeMessage += `${effect.display_name} (${minutesLeft}m left)`;
                        } else if (effect.type === 'consumable') {
                            activeMessage += `${effect.display_name} (${effect.quantity}x)`;
                        } else {
                            activeMessage += effect.display_name;
                        }

                        if (index < effects.length - 1) {
                            activeMessage += ", ";
                        }
                    });

                    // Check for cat name
                    getCatName(userId, (catName) => {
                        if (catName) {
                            activeMessage += `. Your cat name: "${catName}"`;
                        }

                        client.say(channel, activeMessage);
                    });
                } else {
                    // Just check for cat name if no active effects
                    getCatName(userId, (catName) => {
                        if (catName) {
                            client.say(channel, `@${username}, Your cat is named "${catName}".`);
                        }
                    });
                }
            });
        }, 1500); // Small delay to avoid chat rate limits

        setLastMessageTime(currentTime);
    }
}

// Handle apply command
function handleApplyCommand(userId, username, commandArgs, channel) {
    const currentTime = Date.now();

    // Need at least one parameter (the item type)
    if (!commandArgs || !commandArgs.trim()) {
        if (currentTime - lastMessageTime >= COOLDOWN_TIME) {
            client.say(channel, `@${username}, Please specify which item to use (e.g., !roamapply catnip)`);
            setLastMessageTime(currentTime);
        }
        return;
    }

    // Parse command and parameters
    const args = commandArgs.trim().split(' ');
    const command = args[0].toLowerCase();
    const param = args.length > 1 ? args.slice(1).join(' ') : null;

    // Check if user is in a roam, as some items should be queued if so
    const userInRoam = isInGame(userId);

    // Apply the item effect
    applyItemEffect(userId, command, param, userInRoam, (success, message) => {
        if (currentTime - lastMessageTime >= COOLDOWN_TIME) {
            client.say(channel, `@${username}, ${message}`);
            setLastMessageTime(currentTime);
        }
    });
}

module.exports = {
    handleShopCommand,
    handleShopDetailCommand,
    handleBuyCommand,
    handleInventoryCommand,
    handleApplyCommand
};