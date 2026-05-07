const ModuleName = "enhancedcombathud-impmal";

// Base speed metres (excludes the 2 free metres everyone gets)
const SPEED_METRES = { slow:4, normal:8, fast:12, swift:16 };
const FREE_METRES  = 2;

const MOVEMENT_MODE_KEY = `${ModuleName}_movementMode`;
function isMetresMode() { return localStorage.getItem(MOVEMENT_MODE_KEY) === "metres"; }
const SPEED_TIERS  = ["slow","normal","fast","swift"];
const RANGE_METRES = { immediate:1, close:6, short:12, medium:24, long:36, extreme:72 };
const PLACEHOLDER_ICON = "modules/enhancedcombathud-impmal/icons/square.svg";

// Wound / HP colours
const HP_RED    = "rgba(255, 10, 10, 1.0)";
const HP_ORANGE = "rgba(255, 127, 0, 1.0)";
const HP_YELLOW = "rgba(255, 200, 0, 1.0)";
const HP_GREEN  = "rgba(0, 255, 100, 1.0)";

// Advance-tier colours (warm ramp shown in the abilities drawer)
const ADV_T1 = "rgba(255, 215, 64, 1.0)";   // tier 1: amber
const ADV_T2 = "rgba(255, 153, 0, 1.0)";    // tier 2: orange
const ADV_T3 = "rgba(255, 98, 0, 1.0)";     // tier 3: deep orange
const ADV_T4 = "rgba(229, 57, 53, 1.0)";    // tier 4: red

function advColor(pts) {
    if (pts <= 0)  return null;
    if (pts <= 5)  return ADV_T1;
    if (pts <= 10) return ADV_T2;
    if (pts <= 15) return ADV_T3;
    return ADV_T4;
}

// Game data constants
const CHARACTERISTICS = ["ws","bs","str","tgh","ag","int","per","wil","fel"];
const CHAR_LABELS = {
    ws:"IMPMAL.WS", bs:"IMPMAL.BS", str:"IMPMAL.Str",
    tgh:"IMPMAL.Tgh", ag:"IMPMAL.Ag", int:"IMPMAL.Int",
    per:"IMPMAL.Per", wil:"IMPMAL.Wil", fel:"IMPMAL.Fel"
};
const SKILLS = [
    "athletics","awareness","dexterity","discipline","fortitude",
    "intuition","linguistics","logic","lore","medicae","melee",
    "navigation","piloting","presence","psychic","ranged",
    "rapport","reflexes","stealth","tech"
];

// Weapon trait label overrides for keys the auto-split algorithm can't handle.
const TRAIT_LABEL_KEYS = {
    twohanded: "ECHIM.WeaponTrait.TwoHanded",
    twoHanded: "ECHIM.WeaponTrait.TwoHanded",
    oneHanded: "ECHIM.WeaponTrait.OneHanded",
    rapidFire: "ECHIM.WeaponTrait.RapidFire",
};
const TRAIT_LABEL_FALLBACKS = {
    twohanded: "Two Handed",
    onehanded: "One Handed",
};

function cap(s) {
    if (!s) return s;
    return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

function rangeLabel(rangeKey) {
    if (!rangeKey) return null;
    const key   = String(rangeKey).toLowerCase();
    const baseM = RANGE_METRES[key];
    if (baseM === undefined) return cap(rangeKey);
    const mult  = game.settings.get(ModuleName, "realisticRange") ? 10 : 1;
    return `${cap(rangeKey)} (${baseM * mult}m)`;
}

function traitLabel(key) {
    // Try our custom i18n override; fall through if the key isn't loaded yet
    const locKey = TRAIT_LABEL_KEYS[key];
    if (locKey) {
        const resolved = game.i18n.localize(locKey);
        if (resolved !== locKey) return resolved;
    }
    // Impmal system config (values are themselves i18n keys like "IMPMAL.TwoHanded")
    const cfg = game.impmal?.config;
    const cfgVal = cfg?.weaponTraits?.[key] ?? cfg?.traitLabels?.[key];
    if (cfgVal) return game.i18n.localize(cfgVal);
    // Hard-coded fallback for all-lowercase compound keys that camelCase split can't fix
    const lower = key.toLowerCase();
    if (TRAIT_LABEL_FALLBACKS[lower]) return TRAIT_LABEL_FALLBACKS[lower];
    // Fallback: split camelCase
    return key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
}

function charTotal(actor, key) {
    const ch = actor.system.characteristics[key];
    if (!ch) return 0;
    return ch.total ?? (ch.starting + ch.advances + (ch.modifier ?? 0));
}
function charBonus(actor, key) { return Math.floor(charTotal(actor, key) / 10); }

function skillTotal(actor, sk) {
    const s = actor.system.skills[sk];
    if (!s) return 0;
    return charTotal(actor, s.characteristic) + (s.advances * 5) + (s.modifier ?? 0);
}

function actorSpeedTier(actor) { return actor.system.combat?.speed?.land?.value ?? "normal"; }

function getMovementMax(actor, mode = "zones") {
    const tier = actorSpeedTier(actor);
    if (mode === "zones") {
        return Math.max(0, SPEED_TIERS.indexOf(tier));
    }
    // Base speed only; free 2m are tracked separately in the movement HUD
    const metres   = SPEED_METRES[tier] ?? 8;
    const distance = canvas.scene?.dimensions?.distance ?? 2;
    return Math.max(0, Math.round(metres / distance));
}

function hasTalent(actor, name) {
    return actor.items.some(i => i.type === "talent" && i.name.toLowerCase().includes(name.toLowerCase()));
}

/** Returns the total take-count for a repeatable talent (system.taken, not item count). */
function talentTakenCount(actor, name) {
    return actor.items
        .filter(i => i.type === "talent" && i.name.toLowerCase().includes(name.toLowerCase()))
        .reduce((sum, i) => sum + (i.system?.taken ?? 1), 0);
}

/** Increment actor's land speed by one tier (max Swift). */
async function incrementSpeed(actor) {
    const current = actorSpeedTier(actor);
    const idx = SPEED_TIERS.indexOf(current);
    const next = SPEED_TIERS[Math.min(SPEED_TIERS.length - 1, idx + 1)];
    if (next !== current) await actor.update({ "system.combat.speed.land.value": next });
}

/** Decrement actor's land speed by one tier (min Slow). */
async function decrementSpeed(actor) {
    const current = actorSpeedTier(actor);
    const idx = SPEED_TIERS.indexOf(current);
    const next = SPEED_TIERS[Math.max(0, idx - 1)];
    if (next !== current) await actor.update({ "system.combat.speed.land.value": next });
}

function buildUnequipUpdate(actor) {
    if (!actor.system.hands) return {};
    const update = {};
    for (const hand of ["left","right"]) {
        const doc = actor.system.hands[hand].document;
        if (doc) foundry.utils.mergeObject(update, actor.system.hands.unequip(doc));
    }
    return update;
}

function splitButtons(ARGON, arr) {
    const out = [];
    for (let i = 0; i < arr.length; i += 2)
        out.push(arr[i+1] ? new ARGON.MAIN.BUTTONS.SplitButton(arr[i], arr[i+1]) : arr[i]);
    return out;
}

async function imChoiceDialog(title, prompt, options) {
    return foundry.applications.api.Dialog.wait({
        window: { title: "" },
        content: `<p style="margin:0 0 8px">${prompt}</p>`,
        buttons: options.map(o => ({ action: o.id, label: o.label })),
    });
}

async function applyCoverEffect(actor, coverKey) {
    const toRemove = actor.effects.filter(e =>
        e.statuses?.has?.("lightCover") ||
        e.statuses?.has?.("mediumCover") ||
        e.statuses?.has?.("heavyCover")
    );
    if (toRemove.length)
        await actor.deleteEmbeddedDocuments("ActiveEffect", toRemove.map(e => e.id));
    const effectData = foundry.utils.deepClone(game.impmal.config.zoneEffects[coverKey]);
    if (!effectData) { ui.notifications.error(`Cover effect "${coverKey}" not found.`); return; }
    foundry.utils.setProperty(effectData, "system.transferData.enableConditionScript", "");
    await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
}

export {
    ModuleName, MOVEMENT_MODE_KEY, FREE_METRES, PLACEHOLDER_ICON,
    HP_RED, HP_ORANGE, HP_YELLOW, HP_GREEN,
    advColor,
    CHARACTERISTICS, CHAR_LABELS, SKILLS,
    cap, rangeLabel, traitLabel, isMetresMode,
    charBonus, skillTotal,
    actorSpeedTier, getMovementMax, hasTalent, talentTakenCount,
    incrementSpeed, decrementSpeed,
    buildUnequipUpdate, splitButtons,
    imChoiceDialog, applyCoverEffect,
};
