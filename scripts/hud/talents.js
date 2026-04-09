// TALENT_PANEL_EXCLUSIONS maps buttonId -> talent name; buttons with that id
// are hidden from their original panel when the actor possesses the talent.

import { hasTalent, talentTakenCount, applyCoverEffect, incrementSpeed } from "../utils.js";

export const TALENT_PANEL_EXCLUSIONS = {
    "dodge":      "Forewarning",       // moved to Free Action
    "disengage":  "Slippery",          // moved to Free Action when taken twice
};

/**
 * Returns IMActionButton instances for the Free Action panel based on actor talents.
 *
 * @param {Actor}  actor
 * @param {object} deps  { IMActionButton, imChoiceDialog }
 * @returns {IMActionButton[]}
 */
export function getTalentFreeButtons(actor, { IMActionButton, imChoiceDialog, registerOnce }) {
    const buttons = [];
    const hud = () => ui.ARGON?.components?.movement;

    // Once-per-turn button; grays out after use.
    function makeOnceButton(opts, stateKey) {
        const isUsed = () => hud()?.isUsedThisTurn(stateKey) ?? false;
        const btn = new IMActionButton({
            colorScheme: 2,
            ...opts,
            onClick: async (actor) => {
                if (isUsed()) return;
                await opts.onClick(actor);
                hud()?.markUsed(stateKey);
            },
        });
        registerOnce?.(btn, stateKey);
        return btn;
    }

    // -- Tactical Movement: Take Cover as a Free Action (once per turn) ------
    if (hasTalent(actor, "Tactical Movement")) {
        buttons.push(makeOnceButton({
            label:   game.i18n.localize("ECHIM.Button.TacticalMovement"),
            tooltip: game.i18n.localize("ECHIM.Tooltip.TacticalMovementFree"),
            icon:    "modules/enhancedcombathud-impmal/icons/bunker-assault.svg",
            onClick: async (actor) => {
                const choice = await imChoiceDialog(
                    game.i18n.localize("ECHIM.Dialog.TakeCoverTitle"),
                    game.i18n.localize("ECHIM.Dialog.TakeCoverPrompt"),
                    [
                        { id: "lightCover",  label: game.i18n.localize("ECHIM.Cover.LightChoice")  },
                        { id: "mediumCover", label: game.i18n.localize("ECHIM.Cover.MediumChoice") },
                        { id: "heavyCover",  label: game.i18n.localize("ECHIM.Cover.HeavyChoice")  },
                    ]
                );
                if (!choice) return;
                const names   = {
                    lightCover:  game.i18n.localize("ECHIM.Cover.LightLabel"),
                    mediumCover: game.i18n.localize("ECHIM.Cover.MediumLabel"),
                    heavyCover:  game.i18n.localize("ECHIM.Cover.HeavyLabel"),
                };
                const armours = {
                    lightCover:  game.i18n.localize("ECHIM.Cover.LightArmour"),
                    mediumCover: game.i18n.localize("ECHIM.Cover.MediumArmour"),
                    heavyCover:  game.i18n.localize("ECHIM.Cover.HeavyArmour"),
                };
                await applyCoverEffect(actor, choice);
                ChatMessage.create({
                    speaker: ChatMessage.getSpeaker({ actor }),
                    content: game.i18n.format("ECHIM.Chat.TakeCover", {
                        name: `<b>${actor.name}</b>`, cover: names[choice], armour: armours[choice],
                    }),
                });
            },
        }, "tactical-movement"));
    }

    // -- Forewarning: Dodge as a Free Action (once per turn) -----------------
    if (hasTalent(actor, "Forewarning")) {
        buttons.push(makeOnceButton({
            label:   game.i18n.localize("ECHIM.Button.Dodge"),
            tooltip: game.i18n.localize("ECHIM.Tooltip.DodgeFree"),
            icon:    "modules/enhancedcombathud-impmal/icons/ghost-ally.svg",
            onClick: (actor) => ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor }),
                content: game.i18n.format("ECHIM.Chat.Dodge", { name: `<b>${actor.name}</b>` }),
            }),
        }, "dodge-free"));
    }

    // -- Sure-footed: Stand Up from Prone as a Free Action (once per turn) ---
    if (hasTalent(actor, "Sure-footed")) {
        buttons.push(makeOnceButton({
            label:   game.i18n.localize("ECHIM.Button.StandUp"),
            tooltip: game.i18n.localize("ECHIM.Tooltip.StandUp"),
            icon:    "modules/enhancedcombathud-impmal/icons/up-card.svg",
            onClick: async (actor) => {
                await actor.removeCondition("prone");
                await incrementSpeed(actor);
                ChatMessage.create({
                    speaker: ChatMessage.getSpeaker({ actor }),
                    content: game.i18n.format("ECHIM.Chat.StandUp", { name: `<b>${actor.name}</b>` }),
                });
            },
        }, "stand-up-surefooted"));
    }

    // -- Hit And Run: Reflexes (Acrobatics) test to Disengage + move --------
    if (hasTalent(actor, "Hit And Run")) {
        buttons.push(new IMActionButton({
            label:       game.i18n.localize("ECHIM.Button.HitAndRun"),
            tooltip:     game.i18n.localize("ECHIM.Tooltip.HitAndRun"),
            icon:        "modules/enhancedcombathud-impmal/icons/hooded-assassin.svg",
            colorScheme: 2,
            onClick: async (actor) => {
                await actor.setupSkillTest({ key: "reflexes", specialisation: "acrobatics" });
                hud()?.restoreMovement(8);
            },
        }));
    }

    // -- Slippery (x2): Disengage as a Free Action (once per turn) -----------
    if (talentTakenCount(actor, "Slippery") >= 2) {
        buttons.push(makeOnceButton({
            label:   game.i18n.localize("ECHIM.Button.Disengage"),
            tooltip: game.i18n.localize("ECHIM.Tooltip.DisengageFree"),
            icon:    "modules/enhancedcombathud-impmal/icons/player-previous.svg",
            onClick: (actor) => ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor }),
                content: game.i18n.format("ECHIM.Chat.Disengage", { name: `<b>${actor.name}</b>` }),
            }),
        }, "disengage-free"));
    }

    return buttons;
}
