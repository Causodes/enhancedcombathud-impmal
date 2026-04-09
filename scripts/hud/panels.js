import {
    ModuleName, PLACEHOLDER_ICON, MOVEMENT_MODE_KEY,
    splitButtons, imChoiceDialog, applyCoverEffect,
    hasTalent, talentTakenCount, rangeLabel, cap, isMetresMode,
    incrementSpeed, decrementSpeed,
} from "../utils.js";
import { getTalentFreeButtons, TALENT_PANEL_EXCLUSIONS } from "./talents.js";

const BALLISTIC_MECHA_NAME   = () => game.i18n.localize("ECHIM.Augmetic.BallisticMechadendrite");
const MANIPULATOR_MECHA_NAME = () => game.i18n.localize("ECHIM.Augmetic.ManipulatorMechadendrite");

export function makePanels(ARGON, IMWeaponButton, IMActionButton, IMTargetActionButton) {

    /**
     * Wraps an onClick handler so that performing the action also drains the
     * actor's base movement pips (non-movement actions consume your Move).
     */
    function withDrain(fn) {
        return async (actor) => {
            if (game.settings.get(ModuleName, "movementDrain")) {
                const hud = ui.ARGON?.components?.movement;
                hud?.drainBaseMovement();
            }
            return fn(actor);
        };
    }

    function getSlottedWeapons(actor, augmetic) {
        return actor.items.filter(i => {
            if (i.type !== "weapon") return false;
            if (!i.system.equipped?.value) return false;
            const slotSource = i.system.isSlotted;
            if (slotSource?.id === augmetic.id) return true;
            const slotList = augmetic.system?.slots?.list ?? [];
            return slotList.some(s => s.id === i.id);
        });
    }

    function hasNonGrenadeRanged(actor) {
        return actor.items.some(i =>
            i.type === "weapon" &&
            i.system.equipped?.value &&
            i.system.attackType === "ranged" &&
            i.system.category !== "grenadesExplosives"
        );
    }

    // -- Offensive ---------------------------------------------
    class IMOffensivePanel extends ARGON.MAIN.ActionPanel {
        get label()      { return game.i18n.localize("ECHIM.Panel.Offensive"); }
        get maxActions() { return 1; }
        async _getButtons() {
            const actor         = this.actor;
            let weaponButtons;
            if (actor.system.hands) {
                const primaryHand   = actor.system.handed ?? "right";
                const secondaryHand = primaryHand === "right" ? "left" : "right";
                const mainHand = actor.system.hands[primaryHand].document;
                const offHand  = actor.system.hands[secondaryHand].document;
                const mainIsTwoHanded = mainHand?.system?.traits?.has?.("twohanded");
                weaponButtons = [
                    new IMWeaponButton({ item: mainIsTwoHanded ? null : (offHand ?? null), isWeaponSet: true, isPrimary: true }),
                    new IMWeaponButton({ item: mainHand ?? null, isWeaponSet: true, isPrimary: false }),
                ];
            } else {
                // NPCs have no hand slots — show all equipped weapons
                const equipped = actor.items.filter(i => i.type === "weapon" && i.system.equipped?.value);
                weaponButtons = equipped.length
                    ? equipped.map(w => new IMWeaponButton({ item: w, isWeaponSet: false, isPrimary: false }))
                    : [new IMWeaponButton({ item: null, isWeaponSet: false, isPrimary: false })];
            }

            const ballisticMecha = actor.items.find(i =>
                i.type === "augmetic" && i.name === BALLISTIC_MECHA_NAME() && i.system.equipped?.value
            );
            if (ballisticMecha) {
                for (const w of getSlottedWeapons(actor, ballisticMecha))
                    weaponButtons.push(new IMWeaponButton({ item: w, isWeaponSet: false, isPrimary: false }));
            }

            const manipulatorMecha = actor.items.find(i =>
                i.type === "augmetic" && i.name === MANIPULATOR_MECHA_NAME() && i.system.equipped?.value
            );
            if (manipulatorMecha) {
                for (const w of getSlottedWeapons(actor, manipulatorMecha)) {
                    const btn = new IMWeaponButton({ item: w, isWeaponSet: false, isPrimary: false });
                    const augImg = manipulatorMecha.img;
                    Object.defineProperty(btn, "icon",  { get: () => augImg });
                    Object.defineProperty(btn, "label", { get: () => MANIPULATOR_MECHA_NAME() });
                    weaponButtons.push(btn);
                }
            }

            const smalls = [
                new IMTargetActionButton({
                    label:   game.i18n.localize("ECHIM.Button.Charge"),
                    targets: 1,
                    tooltip: game.i18n.localize("ECHIM.Tooltip.Charge"),
                    icon:    "modules/enhancedcombathud-impmal/icons/mounted-knight.svg",
                    onClick: withDrain((actor) => actor.setupSkillTest({ key: "melee" })),
                }),
                new IMTargetActionButton({
                    label:   game.i18n.localize("ECHIM.Button.Grapple"),
                    targets: 1,
                    tooltip: game.i18n.localize("ECHIM.Tooltip.Grapple"),
                    icon:    "modules/enhancedcombathud-impmal/icons/imprisoned.svg",
                    onClick: withDrain(async (actor) => {
                        const choice = await imChoiceDialog(
                            game.i18n.localize("ECHIM.Dialog.GrappleTitle"),
                            game.i18n.localize("ECHIM.Dialog.GrapplePrompt"),
                            [
                                { id:"athletics", label: game.i18n.localize("ECHIM.Dialog.GrappleAthletics") },
                                { id:"melee",     label: game.i18n.localize("ECHIM.Dialog.GrappleMelee")     },
                            ]
                        );
                        if (choice) actor.setupSkillTest({ key: choice });
                    }),
                }),
                new IMTargetActionButton({
                    label:   game.i18n.localize("ECHIM.Button.Shove"),
                    targets: 1,
                    tooltip: game.i18n.localize("ECHIM.Tooltip.Shove"),
                    icon:    "modules/enhancedcombathud-impmal/icons/push.svg",
                    onClick: withDrain((actor) => actor.setupSkillTest({ key: "athletics" })),
                }),
                new IMTargetActionButton({
                    label:   game.i18n.localize("ECHIM.Button.TargetLocation"),
                    targets: 1,
                    tooltip: game.i18n.localize("ECHIM.Tooltip.TargetLocation"),
                    icon:    "modules/enhancedcombathud-impmal/icons/police-target.svg",
                    onClick: withDrain(async (actor) => {
                        const weapons = actor.items.filter(i => i.type === "weapon" && i.system.equipped?.value);
                        if (!weapons.length) { ui.notifications.warn(game.i18n.localize("ECHIM.Notification.NoWeaponsEquipped")); return; }
                        let weaponId = weapons[0].id;
                        if (weapons.length > 1)
                            weaponId = await imChoiceDialog(
                                game.i18n.localize("ECHIM.Dialog.TargetLocTitle"),
                                game.i18n.localize("ECHIM.Dialog.TargetLocPrompt"),
                                weapons.map(w => ({ id: w.id, label: w.name }))
                            );
                        if (weaponId) actor.setupWeaponTest(weaponId, { fields: { disadvantage: true } });
                    }),
                }),
            ];

            return [...weaponButtons, ...splitButtons(ARGON, smalls)];
        }
        get template() { return `/modules/${ModuleName}/templates/ActionPanel.hbs`; }
    }

    // -- Defensive ---------------------------------------------
    class IMDefensivePanel extends ARGON.MAIN.ActionPanel {
        get label()      { return game.i18n.localize("ECHIM.Panel.Defensive"); }
        get maxActions() { return 1; }
        async _getButtons() {
            const actor = this.actor;
            const hasDefendTalent    = hasTalent(actor, TALENT_PANEL_EXCLUSIONS["dodge"]);
            const hasDisengageTalent = talentTakenCount(actor, TALENT_PANEL_EXCLUSIONS["disengage"]) >= 2;

            const buttons = [
                new IMActionButton({
                    label:   game.i18n.localize("ECHIM.Button.DefendAlly"),
                    tooltip: game.i18n.localize("ECHIM.Tooltip.DefendAlly"),
                    icon:    "modules/enhancedcombathud-impmal/icons/surrounded-shield.svg",
                    onClick: withDrain((actor) => ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: game.i18n.format("ECHIM.Chat.DefendAlly", { name: `<b>${actor.name}</b>` }) })),
                }),
                new IMActionButton({
                    label:   game.i18n.localize("ECHIM.Button.DefendZone"),
                    tooltip: game.i18n.localize("ECHIM.Tooltip.DefendZone"),
                    icon:    "modules/enhancedcombathud-impmal/icons/guards.svg",
                    onClick: withDrain((actor) => ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: game.i18n.format("ECHIM.Chat.DefendZone", { name: `<b>${actor.name}</b>` }) })),
                }),
                new IMActionButton({
                    label:   game.i18n.localize("ECHIM.Button.Disengage"),
                    tooltip: game.i18n.localize("ECHIM.Tooltip.Disengage"),
                    icon:    "modules/enhancedcombathud-impmal/icons/player-previous.svg",
                    onClick: withDrain((actor) => ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: game.i18n.format("ECHIM.Chat.Disengage", { name: `<b>${actor.name}</b>` }) })),
                }),
            ];

            // Disengage: hide if Slippery was taken twice (moves to Free Action)
            if (hasDisengageTalent) buttons.pop();

            buttons.push(new IMActionButton({
                label:   game.i18n.localize("ECHIM.Button.TakeCover"),
                tooltip: game.i18n.localize("ECHIM.Tooltip.TakeCover"),
                icon:    "modules/enhancedcombathud-impmal/icons/bell-shield.svg",
                onClick: withDrain(async (actor) => {
                    const choice = await imChoiceDialog(
                        game.i18n.localize("ECHIM.Dialog.TakeCoverTitle"),
                        game.i18n.localize("ECHIM.Dialog.TakeCoverPrompt"),
                        [
                            { id:"lightCover",  label: game.i18n.localize("ECHIM.Cover.LightChoice")  },
                            { id:"mediumCover", label: game.i18n.localize("ECHIM.Cover.MediumChoice") },
                            { id:"heavyCover",  label: game.i18n.localize("ECHIM.Cover.HeavyChoice")  },
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
                        content: game.i18n.format("ECHIM.Chat.TakeCover", { name: `<b>${actor.name}</b>`, cover: names[choice], armour: armours[choice] }),
                    });
                }),
            }));

            // Dodge: hide if Forewarning (moves to Free Action)
            if (!hasDefendTalent) {
                buttons.push(new IMActionButton({
                    label:   game.i18n.localize("ECHIM.Button.Dodge"),
                    tooltip: game.i18n.localize("ECHIM.Tooltip.Dodge"),
                    icon:    "modules/enhancedcombathud-impmal/icons/ghost-ally.svg",
                    onClick: withDrain((actor) => ChatMessage.create({
                        speaker: ChatMessage.getSpeaker({ actor }),
                        content: game.i18n.format("ECHIM.Chat.Dodge", { name: `<b>${actor.name}</b>` }),
                    })),
                }));
            }

            return splitButtons(ARGON, buttons);
        }
        get template() { return `/modules/${ModuleName}/templates/ActionPanel.hbs`; }
    }

    // -- Movement ----------------------------------------------
    class IMMovementPanel extends ARGON.MAIN.ActionPanel {
        get label()      { return game.i18n.localize("ECHIM.Panel.Movement"); }
        get maxActions() { return 1; }
        async _getButtons() {
            return splitButtons(ARGON, [
                new IMActionButton({
                    label:   game.i18n.localize("ECHIM.Button.Flee"),
                    tooltip: game.i18n.localize("ECHIM.Tooltip.Flee"),
                    icon:    "modules/enhancedcombathud-impmal/icons/tattered-banner.svg",
                    onClick: (actor) => ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: game.i18n.format("ECHIM.Chat.Flee", { name: `<b>${actor.name}</b>` }) }),
                }),
                new IMActionButton({
                    label:   game.i18n.localize("ECHIM.Button.Retreat"),
                    tooltip: game.i18n.localize("ECHIM.Tooltip.Retreat"),
                    icon:    "modules/enhancedcombathud-impmal/icons/exit-door.svg",
                    onClick: (actor) => ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: game.i18n.format("ECHIM.Chat.Retreat", { name: `<b>${actor.name}</b>` }) }),
                }),
                new IMActionButton({
                    label:   game.i18n.localize("ECHIM.Button.Run"),
                    tooltip: game.i18n.localize("ECHIM.Tooltip.Run"),
                    icon:    "modules/enhancedcombathud-impmal/icons/sprint.svg",
                    onClick: async (actor) => {
                        ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: game.i18n.format("ECHIM.Chat.Run", { name: `<b>${actor.name}</b>` }) });
                        const hud = ui.ARGON?.components?.movement;
                        if (!hud) return;
                        const increment = hud._movementMode === "zones" ? 1 : hud.movementMax;
                        hud._extraMovement = (hud._extraMovement ?? 0) + increment;
                        hud.updateMovement();
                    },
                }),
            ]);
        }
        get template() { return `/modules/${ModuleName}/templates/ActionPanel.hbs`; }
    }

    // -- Utility -----------------------------------------------
    class IMUtilityPanel extends ARGON.MAIN.ActionPanel {
        get label()      { return game.i18n.localize("ECHIM.Panel.Utility"); }
        get maxActions() { return 1; }
        async _getButtons() {
            const actor = this.actor;

            const coreButtons = [
                new IMActionButton({
                    label:   game.i18n.localize("ECHIM.Button.Overwatch"),
                    tooltip: game.i18n.localize("ECHIM.Tooltip.Overwatch"),
                    icon:    "modules/enhancedcombathud-impmal/icons/back-forth.svg",
                    onClick: withDrain((actor) => ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: game.i18n.format("ECHIM.Chat.Overwatch", { name: `<b>${actor.name}</b>` }) })),
                }),
                new IMActionButton({
                    label:   game.i18n.localize("ECHIM.Button.SeizeInitiative"),
                    tooltip: game.i18n.localize("ECHIM.Tooltip.SeizeInitiative"),
                    icon:    "modules/enhancedcombathud-impmal/icons/detour.svg",
                    onClick: withDrain((actor) => ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: game.i18n.format("ECHIM.Chat.SeizeInitiative", { name: `<b>${actor.name}</b>` }) })),
                }),
                new IMActionButton({
                    label:   game.i18n.localize("ECHIM.Button.Search"),
                    tooltip: game.i18n.localize("ECHIM.Tooltip.Search"),
                    icon:    "modules/enhancedcombathud-impmal/icons/magnifying-glass.svg",
                    onClick: withDrain(async (actor) => {
                        const choice = await imChoiceDialog(
                            game.i18n.localize("ECHIM.Dialog.SearchTitle"),
                            game.i18n.localize("ECHIM.Dialog.SearchPrompt"),
                            [
                                { id:"awareness", label: game.i18n.localize("ECHIM.Dialog.SearchSight")        },
                                { id:"awareness", label: game.i18n.localize("ECHIM.Dialog.SearchHearing")      },
                                { id:"awareness", label: game.i18n.localize("ECHIM.Dialog.SearchSmell")        },
                                { id:"awareness", label: game.i18n.localize("ECHIM.Dialog.SearchSurroundings") },
                                { id:"intuition", label: game.i18n.localize("ECHIM.Dialog.SearchIntuit")       },
                                { id:"athletics", label: game.i18n.localize("ECHIM.Dialog.SearchTrack")        },
                            ]
                        );
                        if (choice) actor.setupSkillTest({ key: choice });
                    }),
                }),
                new IMActionButton({
                    label:   game.i18n.localize("ECHIM.Button.Hide"),
                    tooltip: game.i18n.localize("ECHIM.Tooltip.Hide"),
                    icon:    "modules/enhancedcombathud-impmal/icons/invisible.svg",
                    onClick: withDrain(async (actor) => {
                        // Override speed to Slow while hiding
                        await actor.update({ "system.combat.speed.land.value": "slow" });
                        actor.setupSkillTest({ key: "stealth" });
                    }),
                }),
                new IMActionButton({
                    label:   game.i18n.localize("ECHIM.Button.Improvise"),
                    tooltip: game.i18n.localize("ECHIM.Tooltip.Improvise"),
                    icon:    "modules/enhancedcombathud-impmal/icons/light-bulb.svg",
                    onClick: withDrain((actor) => ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: game.i18n.format("ECHIM.Chat.Improvise", { name: `<b>${actor.name}</b>` }) })),
                }),
                new IMActionButton({
                    label:   game.i18n.localize("ECHIM.Button.UseObject"),
                    tooltip: game.i18n.localize("ECHIM.Tooltip.UseObject"),
                    icon:    "modules/enhancedcombathud-impmal/icons/click.svg",
                    onClick: withDrain((actor) => ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: game.i18n.format("ECHIM.Chat.UseObject", { name: `<b>${actor.name}</b>` }) })),
                }),
            ];

            // Aim: only visible when a non-grenade ranged weapon is equipped
            const aimButton = new (class extends IMActionButton {
                get visible()  { return hasNonGrenadeRanged(this.actor); }
                get template() { return `modules/enhancedcombathud-impmal/templates/ActionButton.hbs`; }
            })({
                label:   game.i18n.localize("ECHIM.Button.Aim"),
                tooltip: game.i18n.localize("ECHIM.Tooltip.Aim"),
                icon:    "modules/enhancedcombathud-impmal/icons/targeting.svg",
                onClick: withDrain((actor) => ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: game.i18n.format("ECHIM.Chat.Aims", { name: `<b>${actor.name}</b>` }) })),
            });

            // Reload: only visible when a non-grenade ranged weapon is equipped
            const reloadButton = new (class extends IMActionButton {
                get visible()  { return hasNonGrenadeRanged(this.actor); }
                get template() { return `modules/enhancedcombathud-impmal/templates/ActionButton.hbs`; }
            })({
                label:   game.i18n.localize("ECHIM.Button.Reload"),
                tooltip: game.i18n.localize("ECHIM.Tooltip.Reload"),
                icon:    "modules/enhancedcombathud-impmal/icons/reload-gun-barrel.svg",
                onClick: withDrain(async (actor) => {
                    const reloadable = actor.items.filter(i =>
                        i.type === "weapon" &&
                        i.system.equipped?.value &&
                        i.system.attackType === "ranged" &&
                        i.system.category !== "grenadesExplosives" &&
                        i.system.mag?.value
                    );
                    if (!reloadable.length) { ui.notifications.warn(game.i18n.localize("ECHIM.Notification.NoReloadableWeapons")); return; }
                    let weapon;
                    if (reloadable.length === 1) {
                        weapon = reloadable[0];
                    } else {
                        const choice = await imChoiceDialog(
                            game.i18n.localize("ECHIM.Dialog.ReloadTitle"),
                            game.i18n.localize("ECHIM.Dialog.ReloadPrompt"),
                            reloadable.map(w => ({ id: w.id, label: w.name }))
                        );
                        if (!choice) return;
                        weapon = actor.items.get(choice);
                    }
                    if (!weapon) return;
                    try {
                        await weapon.update(weapon.system.reload());
                        ui.notifications.notify(game.i18n.format("ECHIM.Notification.Reloaded", { weapon: weapon.name }));
                    } catch(e) { ui.notifications.error(e); }
                }),
            });

            // Heal: only available if the actor has medicae advances
            const healButton = (actor.system.skills?.medicae?.advances ?? 0) > 0
                ? new IMActionButton({
                    label:   game.i18n.localize("ECHIM.Button.Heal"),
                    tooltip: game.i18n.localize("ECHIM.Tooltip.Heal"),
                    icon:    "modules/enhancedcombathud-impmal/icons/health-increase.svg",
                    onClick: withDrain(async (actor) => {
                        const inCombat = !!game.combat?.started;
                        let difficulty = inCombat ? "challenging" : "routine";
                        if (!inCombat) {
                            const choice = await imChoiceDialog(
                                game.i18n.localize("ECHIM.Dialog.HealTitle"),
                                game.i18n.localize("ECHIM.Dialog.HealPrompt"),
                                [
                                    { id:"routine",     label: game.i18n.localize("ECHIM.Dialog.HealRoutine")     },
                                    { id:"challenging", label: game.i18n.localize("ECHIM.Dialog.HealChallenging") },
                                ]
                            );
                            if (!choice) return;
                            difficulty = choice;
                        }
                        actor.setupSkillTest({ key: "medicae" }, { fields: { difficulty } });
                    }),
                })
                : null;

            const helpButton = new IMActionButton({
                label:   game.i18n.localize("ECHIM.Button.Help"),
                tooltip: game.i18n.localize("ECHIM.Tooltip.Help"),
                icon:    "modules/enhancedcombathud-impmal/icons/shaking-hands.svg",
                onClick: withDrain((actor) => ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: game.i18n.format("ECHIM.Chat.Helps", { name: `<b>${actor.name}</b>` }) })),
            });

            const orderedButtons = [
                ...coreButtons,
                aimButton,
                reloadButton,
                ...(healButton ? [healButton] : []),
                helpButton,
            ];

            return splitButtons(ARGON, orderedButtons);
        }
        get template() { return `/modules/${ModuleName}/templates/ActionPanel.hbs`; }
    }

    // -- Manifest ----------------------------------------------

    async function pickAndAssignPower(actor, slotIndex) {
        const powers = actor.items
            .filter(i => i.type === "power")
            .sort((a, b) => a.name.localeCompare(b.name));
        const powerChoices = [
            { id: "__clear__", label: game.i18n.localize("ECHIM.ManifestSlot.Clear") },
            ...powers.map(p => ({ id: p.id, label: p.name })),
        ];
        const chosen = await imChoiceDialog(
            game.i18n.localize("ECHIM.ManifestSlot.PickTitle"),
            game.i18n.localize("ECHIM.ManifestSlot.PickPrompt"),
            powerChoices,
        );
        if (chosen == null) return;
        const updatedSlots = foundry.utils.deepClone(
            actor.getFlag(ModuleName, "manifestSlots") ?? [null, null]
        );
        updatedSlots[slotIndex] = chosen === "__clear__" ? null : chosen;
        await actor.setFlag(ModuleName, "manifestSlots", updatedSlots);
        ui.ARGON?.render();
    }

    class IMManifestSlotButton extends IMActionButton {
        constructor({ slotIndex, item }) {
            const emptyLabel = game.i18n.localize("ECHIM.ManifestSlot.Empty");
            super({
                label:   item?.name ?? emptyLabel,
                icon:    item?.img  ?? PLACEHOLDER_ICON,
                tooltip: "",
                onClick: item
                    ? withDrain(async (actor) => {
                        actor.setupPowerTest(item.id);
                    })
                    : null,
            });
            this._slotIndex = slotIndex;
            this._item      = item;
        }
        
        async getTooltipData() {
            if (!this._item) {
                return {
                    title:       game.i18n.localize("ECHIM.ManifestSlot.Empty"),
                    description: `<p>${game.i18n.localize("ECHIM.ManifestSlot.EmptyHint")}</p>`,
                    details:     [],
                };
            }
            const item = this._item;
            const sys  = item.system;
            const cfg  = game.impmal?.config ?? {};
            const details = [];

            // Minor powers show their specialisation name; others show their discipline
            const disciplineKey = sys.discipline ?? "";
            const specValue = disciplineKey === "minor"
                ? (sys.minorSpecialisation ? cap(sys.minorSpecialisation) : "")
                : (cfg.disciplines?.[disciplineKey] ?? cap(disciplineKey));
            if (specValue) details.push({ label: "ECHIM.TooltipLabel.Specialization", value: specValue });

            // Warp Rating
            if (sys.rating != null) details.push({ label: "ECHIM.TooltipLabel.WarpRating", value: sys.rating });

            // Difficulty
            const diffKey  = sys.difficulty ?? "";
            const diffName = game.i18n.localize(cfg.difficulties?.[diffKey]?.name ?? "") || cap(diffKey);
            if (diffName) details.push({ label: "ECHIM.TooltipLabel.Difficulty", value: diffName });

            // Range
            if (sys.range) details.push({ label: "ECHIM.TooltipLabel.Range", value: rangeLabel(sys.range) ?? cap(String(sys.range)) });

            // Target
            if (sys.target) {
                let targetDisplay = cap(String(sys.target));
                if (isMetresMode() && /zone/i.test(sys.target)) {
                    // Replace "X Zone(s)" with "X × 4m radius sphere"
                    targetDisplay = targetDisplay.replace(
                        /(\d+)\s+zones?/i,
                        (_, n) => `${n} × 4m radius sphere`
                    );
                    // If no number prefix, just append the note
                    if (!/×/.test(targetDisplay))
                        targetDisplay += " × 4m radius sphere";
                }
                details.push({ label: "ECHIM.TooltipLabel.Target", value: targetDisplay });
            }

            // Duration
            if (sys.duration) details.push({ label: "ECHIM.TooltipLabel.Duration", value: cap(sys.duration) });

            // Overt
            if (sys.overt) details.push({ label: "ECHIM.TooltipLabel.Overt", value: "Yes" });

            // Damage
            if (sys.damage?.value) details.push({ label: "ECHIM.TooltipLabel.Damage", value: sys.damage.value });

            // Ignore AP
            if (sys.damage?.ignoreAP) details.push({ label: "ECHIM.TooltipLabel.IgnoreAP", value: "Yes" });

            return { title: item.name, description: "", details };
        }

        async _onRightClick(event) {
            event.preventDefault();
            event.stopPropagation();
            if (this._item) {
                this._item.sheet.render(true);
            } else {
                await pickAndAssignPower(this.actor, this._slotIndex);
            }
        }
    }

    class IMManifestPanel extends ARGON.MAIN.ActionPanel {
        get label()      { return game.i18n.localize("ECHIM.Panel.Manifest"); }
        get maxActions() { return null; }

        // Hide the entire panel when the actor has no powers.
        updateVisibility() {
            const hasPowers = this.actor?.items?.some(i => i.type === "power") ?? false;
            if (!hasPowers) {
                this.element.classList.add("hidden");
                return;
            }
            super.updateVisibility();
        }

        async _getButtons() {
            const actor = this.actor;
            const slots = actor.getFlag(ModuleName, "manifestSlots") ?? [null, null];
            const slotButtons = slots.map((itemId, i) => {
                const item = itemId ? actor.items.get(itemId) ?? null : null;
                return new IMManifestSlotButton({ slotIndex: i, item });
            });

            const purgeButton = new IMActionButton({
                label:   game.i18n.localize("ECHIM.Button.Purge"),
                icon:    `modules/enhancedcombathud-impmal/icons/fire-silhouette.svg`,
                tooltip: game.i18n.localize("ECHIM.Tooltip.Purge"),
                onClick: withDrain((actor) => actor.purge()),
            });

            // Select Powers: 2-step dialog, choose slot then power
            const selectPowersButton = new IMActionButton({
                label:   game.i18n.localize("ECHIM.Button.SelectPowers"),
                icon:    `modules/enhancedcombathud-impmal/icons/rolling-energy.svg`,
                tooltip: game.i18n.localize("ECHIM.Tooltip.SelectPowers"),
                onClick: async (actor) => {
                    const slotStr = await imChoiceDialog(
                        game.i18n.localize("ECHIM.ManifestSlot.SlotSelect"),
                        game.i18n.localize("ECHIM.ManifestSlot.SlotPrompt"),
                        [
                            { id: "0", label: game.i18n.localize("ECHIM.ManifestSlot.Slot1") },
                            { id: "1", label: game.i18n.localize("ECHIM.ManifestSlot.Slot2") },
                        ],
                    );
                    if (slotStr == null) return;
                    await pickAndAssignPower(actor, parseInt(slotStr));
                },
            });

            return [...slotButtons, ...splitButtons(ARGON, [purgeButton, selectPowersButton])];
        }

        // Rebuild element as column: [sustained chips] / [warp pips] / [buttons row]
        async _renderInner() {
            await super._renderInner();

            const buttonsArea = document.createElement("div");
            buttonsArea.className = "im-manifest-buttons-area";
            while (this.element.firstChild) {
                buttonsArea.appendChild(this.element.firstChild);
            }

            this.element.appendChild(this._buildSustainedChips());
            this.element.appendChild(this._buildWarpPips());
            this.element.appendChild(buttonsArea);
            this.element.classList.add("im-manifest-panel");
        }

        _buildSustainedChips() {
            const actor = this.actor;
            const sustainedDocs = actor.system.warp?.sustaining?.documents ?? [];
            const row = document.createElement("div");
            row.className = "im-sustained-chips-row";

            if (!sustainedDocs.length) {
                // Empty row; still rendered for consistent layout
                row.classList.add("im-sustained-chips-row--empty");
                return row;
            }

            for (let i = 0; i < sustainedDocs.length; i++) {
                const doc    = sustainedDocs[i];
                const rating = doc?.system?.rating ?? 0;
                const chip   = document.createElement("span");
                chip.className  = "im-sustain-chip";
                chip.title      = game.i18n.localize("ECHIM.ManifestSlot.UnsustainHint");
                chip.textContent = `${doc.name} (${rating})`;
                chip.addEventListener("click", async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await actor.update(actor.system.warp.sustaining.remove(i));
                    ui.ARGON?.render();
                });
                row.appendChild(chip);
            }

            return row;
        }

        _buildWarpPips() {
            const actor     = this.actor;
            const charge    = actor.system.warp?.charge    ?? 0;
            const threshold = actor.system.warp?.threshold ?? 0;

            const row = document.createElement("div");
            row.className = "im-warp-pips-row";

            const pipCount = Math.max(threshold, 1);
            // Compute a single colour tier for the whole bar based on overall fill level
            const fillPct  = threshold > 0 ? charge / threshold : (charge > 0 ? 1 : 0);
            const fillTier = fillPct <= 0.35 ? "warp-safe"
                           : fillPct <= 0.60 ? "warp-warn"
                           : fillPct <= 0.85 ? "warp-danger"
                           : "warp-critical";
            for (let i = 0; i < pipCount; i++) {
                const pip = document.createElement("div");
                pip.className = "im-warp-pip";
                if (i < charge) {
                    if (charge > threshold) {
                        pip.classList.add("over");
                    } else {
                        pip.classList.add("filled", fillTier);
                    }
                }
                row.appendChild(pip);
            }

            return row;
        }

        get template() { return `/modules/${ModuleName}/templates/ActionPanel.hbs`; }
    }

    // -- Free Action -------------------------------------------
    class IMFreeActionPanel extends ARGON.MAIN.ActionPanel {
        get _isFreeActionPanel() { return true; }
        get label()      { return game.i18n.localize("ECHIM.Panel.FreeAction"); }
        get maxActions() { return null; }

        async _getButtons() {
            const actor = this.actor;
            const hud   = () => ui.ARGON?.components?.movement;

            const freeBtn = new IMActionButton({
                label:       game.i18n.localize("ECHIM.Button.FreeMovement"),
                tooltip:     game.i18n.localize("ECHIM.Tooltip.FreeMovement"),
                icon:        "modules/enhancedcombathud-impmal/icons/walk.svg",
                colorScheme: 2,
                onClick: () => { hud()?.activateFreeMovement(); },
            });

            const goProneBtn = new IMActionButton({
                label:       game.i18n.localize("ECHIM.Button.Prone"),
                tooltip:     game.i18n.localize("ECHIM.Tooltip.Prone"),
                icon:        "modules/enhancedcombathud-impmal/icons/save-arrow.svg",
                colorScheme: 2,
                onClick: async (actor) => {
                    await actor.addCondition("prone");
                    await decrementSpeed(actor);
                    ChatMessage.create({
                        speaker: ChatMessage.getSpeaker({ actor }),
                        content: game.i18n.format("ECHIM.Chat.Prone", { name: `<b>${actor.name}</b>` }),
                    });
                },
            });

            // Grayed out once any base movement is spent (_speedUsed excludes free-move pips)
            const standUpAvailable = () => (hud()?._speedUsed ?? 0) === 0;
            const standUpBtn = new IMActionButton({
                label:       game.i18n.localize("ECHIM.Button.StandUpAction"),
                tooltip:     game.i18n.localize("ECHIM.Tooltip.StandUpAction"),
                icon:        "modules/enhancedcombathud-impmal/icons/card-draw.svg",
                colorScheme: 2,
                onClick: async (actor) => {
                    if (!standUpAvailable()) return;
                    await actor.removeCondition("prone");
                    await incrementSpeed(actor);
                    hud()?.drainBaseMovement();
                    ChatMessage.create({
                        speaker: ChatMessage.getSpeaker({ actor }),
                        content: game.i18n.format("ECHIM.Chat.StandUp", { name: `<b>${actor.name}</b>` }),
                    });
                },
            });

            const onceEntries = []; // [{btn, stateKey}]
            const talentButtons = getTalentFreeButtons(actor, {
                IMActionButton, imChoiceDialog,
                registerOnce: (btn, stateKey) => onceEntries.push({ btn, stateKey }),
            });

            // Called from updateMovement() in movement.js
            this._updateFreeButton = () => {
                // Free Movement — hide entirely in zones mode, grey out if spent
                if (freeBtn.element) {
                    const isZones = (hud()?._movementMode ?? "zones") === "zones";
                    freeBtn.element.classList.toggle("hidden", isZones);
                    if (!isZones) {
                        const available = hud()?.freeMovementAvailable ?? true;
                        freeBtn.element.classList.toggle("action-used", !available);
                        freeBtn.element.style.opacity = available ? "" : "0.45";
                    }
                }
                // Stand Up (general): disabled when movement has been spent
                if (standUpBtn.element) {
                    const avail = standUpAvailable();
                    standUpBtn.element.classList.toggle("action-used", !avail);
                    standUpBtn.element.style.opacity = avail ? "" : "0.45";
                }
                // Once-use talent buttons
                for (const { btn, stateKey } of onceEntries) {
                    if (!btn.element) continue;
                    const used = hud()?.isUsedThisTurn(stateKey) ?? false;
                    btn.element.classList.toggle("action-used", used);
                    btn.element.style.opacity = used ? "0.45" : "";
                }
            };

            const autoFreeMove = game.settings.get(ModuleName, "freeMovementAuto");
            const isZonesOnLoad = (ui.ARGON?.components?.movement?._movementMode ?? localStorage.getItem(MOVEMENT_MODE_KEY) ?? "zones") === "zones";
            return [...splitButtons(ARGON, talentButtons), ...splitButtons(ARGON, [goProneBtn, standUpBtn]), ...(autoFreeMove || isZonesOnLoad ? [] : [freeBtn])];
        }

        get visible() { return isMetresMode(); }
        get template() { return `/modules/${ModuleName}/templates/ActionPanel.hbs`; }
    }

    // -- Reaction ----------------------------------------------
    class IMReactionPanel extends ARGON.MAIN.ActionPanel {
        get label()      { return game.i18n.localize("ECHIM.Panel.Reaction"); }
        get maxActions() { return 1; }
        async _getButtons() {
            const actor  = this.actor;
            const smalls = [
                new IMActionButton({
                    label:       game.i18n.localize("ECHIM.Button.DodgeRanged"),
                    icon:        "modules/enhancedcombathud/icons/dodging.webp",
                    tooltip:     game.i18n.localize("ECHIM.Tooltip.DodgeRanged"),
                    colorScheme: 3,
                    onClick: (actor) => actor.setupSkillTest({ key: "reflexes", name: game.i18n.localize("ECHIM.Button.Dodge") }),
                }),
            ];
            if (hasTalent(actor, game.i18n.localize("ECHIM.Talent.Psyker"))) {
                smalls.push(new IMActionButton({
                    label:       game.i18n.localize("ECHIM.Button.DenyTheWitch"),
                    icon:        "modules/enhancedcombathud-impmal/icons/magic-swirl.svg",
                    tooltip:     game.i18n.localize("ECHIM.Tooltip.DenyTheWitch"),
                    colorScheme: 3,
                    onClick: (actor) => actor.setupSkillTest({ key: "discipline", name: game.i18n.localize("ECHIM.Button.DenyTheWitch") }),
                }));
            }
            return splitButtons(ARGON, smalls);
        }
        get template() { return `/modules/${ModuleName}/templates/ActionPanel.hbs`; }
    }

    // -- Pass --------------------------------------------------
    class IMPassPanel extends ARGON.MAIN.ActionPanel {
        get label()      { return game.i18n.localize("ECHIM.Panel.Pass"); }
        get maxActions() { return null; }
        async _getButtons() {
            return [new IMActionButton({
                label:       game.i18n.localize("ECHIM.Button.EndTurn"),
                icon:        "modules/enhancedcombathud/icons/duration.webp",
                tooltip:     game.i18n.localize("ECHIM.Tooltip.EndTurn"),
                colorScheme: 4,
                onClick:     () => game.combat?.nextTurn(),
            })];
        }
        get template() { return `/modules/${ModuleName}/templates/ActionPanel.hbs`; }
    }

    return {
        IMOffensivePanel, IMDefensivePanel, IMMovementPanel,
        IMUtilityPanel, IMFreeActionPanel, IMManifestPanel, IMReactionPanel, IMPassPanel,
    };
}