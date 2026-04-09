import { ModuleName } from "./utils.js";
import { applyTheme }  from "./themes.js";
import { makeMovementHud } from "./hud/movement.js";
import { makeWeaponButton, makeActionButton, makeTargetActionButton, pruneThrownModeState } from "./hud/buttons.js";
import { makePortraitPanel, makeDrawerPanel } from "./hud/portrait.js";
import { makeWeaponSets }                     from "./hud/weaponsets.js";
import { makePanels }                         from "./hud/panels.js";

Hooks.once("init", async () => {
    game.settings.register(ModuleName, "realisticRange", {
        name: "ECHIM.Settings.RealisticRangeName",
        hint: "ECHIM.Settings.RealisticRangeHint",
        scope: "world", config: true, type: Boolean, default: false,
    });

    game.settings.register(ModuleName, "movementDrain", {
        name: "ECHIM.Settings.MovementDrainName",
        hint: "ECHIM.Settings.MovementDrainHint",
        scope: "world", config: true, type: Boolean, default: true,
    });

    game.settings.register(ModuleName, "freeMovementAuto", {
        name: "ECHIM.Settings.FreeMovementAutoName",
        hint: "ECHIM.Settings.FreeMovementAutoHint",
        scope: "world", config: true, type: Boolean, default: false,
    });

    game.settings.register(ModuleName, "thrownTracking", {
        name: "ECHIM.Settings.ThrownTrackingName",
        hint: "ECHIM.Settings.ThrownTrackingHint",
        scope: "world", config: true, type: Boolean, default: true,
    });

    game.settings.register(ModuleName, "swapHandDisplay", {
        name: "ECHIM.Settings.SwapHandDisplayName",
        hint: "ECHIM.Settings.SwapHandDisplayHint",
        scope: "client", config: true, type: Boolean, default: false,
    });

    game.settings.register(ModuleName, "hudTheme", {
        name: "ECHIM.Settings.HudThemeName",
        hint: "ECHIM.Settings.HudThemeHint",
        scope: "client",
        config: true,
        type: String,
        choices: {
            "argon":      "ECHIM.Settings.ThemeArgon",
            "im-classic": "ECHIM.Settings.ThemeImClassic",
        },
        default: "argon",
        onChange: applyTheme,
    });

    const templatePath = `modules/${ModuleName}/templates/CritCorruptionBar.hbs`;
    await loadTemplates([templatePath]);
    const partialContent = await fetch(`/${templatePath}`).then(r => r.text());
    Handlebars.registerPartial("CritCorruptionBar", partialContent);
});

Hooks.once("ready", async () => {
    applyTheme(game.settings.get(ModuleName, "hudTheme"));

    // Self-heal any weapons left in a mutated state from a previous session
    // (page reload, crash, or HUD teardown mid-throw).  If a weapon has the
    // throwRestore flag it was never properly restored — fix it now.
    for (const actor of game.actors) {
        if (!actor.isOwner) continue;
        for (const item of actor.items) {
            const restore = item.getFlag(ModuleName, "throwRestore");
            if (!restore) continue;
            console.warn(`${ModuleName} | Restoring stuck thrown weapon: ${item.name} on ${actor.name}`);
            await item.update({
                ...restore,
                [`flags.${ModuleName}.throwRestore`]: null,
            });
        }
    }
});

Hooks.on("combatRound", () => { if (ui.ARGON?.components?.movement) ui.ARGON.components.movement._extraMovement = 0; });
Hooks.on("combatTurn",  () => { if (ui.ARGON?.components?.movement) ui.ARGON.components.movement._extraMovement = 0; });

Hooks.on("argonInit", (CoreHUD) => {
    const ARGON = CoreHUD.ARGON;

    const IMMovementHud        = makeMovementHud(ARGON);
    const IMWeaponButton       = makeWeaponButton(ARGON);
    const IMActionButton       = makeActionButton(ARGON);
    const IMTargetActionButton = makeTargetActionButton(ARGON);
    const IMPortraitPanel      = makePortraitPanel(ARGON);
    const IMDrawerPanel        = makeDrawerPanel(ARGON);
    const IMWeaponSets         = makeWeaponSets(ARGON);
    const panels               = makePanels(ARGON, IMWeaponButton, IMActionButton, IMTargetActionButton);

    class IMTooltip extends ARGON.CORE.Tooltip {
        get template() { return `/modules/${ModuleName}/templates/Tooltip.hbs`; }
        async _renderInner() {
            await super._renderInner();
            this.element.classList.add("im-tooltip");
        }
    }

    CoreHUD.definePortraitPanel(IMPortraitPanel);
    CoreHUD.defineDrawerPanel(IMDrawerPanel);
    CoreHUD.defineMainPanels([
        panels.IMOffensivePanel,
        panels.IMDefensivePanel,
        panels.IMMovementPanel,
        panels.IMUtilityPanel,
        panels.IMManifestPanel,
        panels.IMFreeActionPanel,
        panels.IMReactionPanel,
        panels.IMPassPanel,
    ]);
    CoreHUD.defineMovementHud(IMMovementHud);
    CoreHUD.defineWeaponSets(IMWeaponSets);
    CoreHUD.defineTooltip(IMTooltip);
    CoreHUD.defineSupportedActorTypes(["character", "npc"]);
});

Hooks.on("updateActor", (actor) => {
    if (ui.ARGON?.components?.portrait?.actor === actor) {
        ui.ARGON.components.portrait.render();
        // Skip intermediate button visibility passes while a weapon-set change is in
        // progress — the actor briefly has no weapons equipped between unequip and
        // re-equip, which would cause Aim/Reload to flash hidden then visible.
        const changingSet = ui.ARGON?.components?.weaponSets?._changingSet;
        if (!changingSet) {
            for (const panel of ui.ARGON.components.main ?? []) {
                if (!panel._buttons) continue;
                for (const btn of panel._buttons) {
                    if (btn.element) btn.element.classList.toggle("hidden", !btn.visible);
                    if (btn.button1?.element) btn.button1.element.classList.toggle("hidden", !btn.button1.visible);
                    if (btn.button2?.element) btn.button2.element.classList.toggle("hidden", !btn.button2.visible);
                }
            }
        }
        for (const panel of ui.ARGON.components.main ?? []) {
            if (panel.element?.classList.contains("im-manifest-panel")) panel.render();
        }
    }
    if (ui.ARGON?.components?.movement?.actor === actor)
        ui.ARGON.components.movement.render();
});
Hooks.on("updateItem", (item) => {
    if (!ui.ARGON || item.parent !== ui.ARGON?.components?.portrait?.actor) return;
    if (["weapon","power"].includes(item.type))
        for (const btn of ui.ARGON.itemButtons ?? [])
            if (btn.item?.id === item.id) btn.render();
    if (["condition","protection"].includes(item.type))
        ui.ARGON.components.portrait.render();
});

Hooks.on("deleteItem", (item) => {
    pruneThrownModeState(item.id);
});

Hooks.on("createCombatant", (combatant) => {
    if (ui.ARGON?._actor?.id === combatant?.actorId) ui.ARGON.render();
});
Hooks.on("deleteCombatant", (combatant) => {
    if (ui.ARGON?._actor?.id === combatant?.actorId) ui.ARGON.render();
});

/**
 * When a combat is deleted, offer to restore quantities of any thrown weapons that were
 * tracked during the combat via the "thrownTracker" actor flag.
 */
Hooks.on("deleteCombat", async (combat) => {
    if (!game.settings.get(ModuleName, "thrownTracking")) return;
    // Gather unique actor IDs from this combat.
    const actorIds = [...new Set(combat.combatants.map(c => c.actorId).filter(Boolean))];
    for (const actorId of actorIds) {
        const actor = game.actors.get(actorId);
        if (!actor?.isOwner) continue;

        const tracker = actor.getFlag(ModuleName, "thrownTracker");
        if (!tracker || foundry.utils.isEmpty(tracker)) continue;

        // Build a summary list of thrown items.
        const lines = [];
        for (const [itemId, count] of Object.entries(tracker)) {
            const item = actor.items.get(itemId);
            if (item && count > 0) lines.push(`${item.name}: ${count}`);
        }
        if (!lines.length) {
            await actor.unsetFlag(ModuleName, "thrownTracker");
            continue;
        }

        const listHtml = lines.map(l => `<li>${l}</li>`).join("");
        const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: { title: game.i18n.localize("ECHIM.ThrowToggle.RestoreTitle") },
            content: `<p>${game.i18n.localize("ECHIM.ThrowToggle.RestorePrompt")}</p><ul>${listHtml}</ul>`,
        });

        if (confirmed) {
            for (const [itemId, count] of Object.entries(tracker)) {
                const item = actor.items.get(itemId);
                if (item && count > 0) {
                    const current = item.system.quantity ?? 0;
                    await item.update({ "system.quantity": current + count });
                }
            }
        }

        await actor.unsetFlag(ModuleName, "thrownTracker");
    }
});