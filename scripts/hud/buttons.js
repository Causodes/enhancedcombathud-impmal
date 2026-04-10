import { PLACEHOLDER_ICON, ModuleName, cap, rangeLabel, traitLabel, isMetresMode } from "../utils.js";
import { IM_TEAL_TINT } from "../themes.js";

// Module-level map tracking thrown mode state per actor+item across re-renders.
// Key: `${actorId}-${itemId}`, Value: boolean
const _thrownModeState = new Map();

/** Remove all thrown-mode entries for a deleted item to prevent unbounded map growth. */
export function pruneThrownModeState(itemId) {
    for (const key of _thrownModeState.keys()) {
        if (key.endsWith(`-${itemId}`)) _thrownModeState.delete(key);
    }
}

// SVG filter reference (filter injected by _injectSVGFilters in echImpMal.js)
export const IM_ICON_FILTER = "url(#im-icon-filter)";

// Injects IM theme background, icon, and tint divs into an action button element.
function injectThemeDecorations(element, iconUrl, filter = IM_ICON_FILTER) {
    element.querySelectorAll(".im-theme-bg, .im-theme-icon, .im-theme-tint").forEach(n => n.remove());

    const isImTheme = document.body.classList.contains("ech-impmal-theme-classic");
    if (!isImTheme) {
        element.style.backgroundColor = "";
        return;
    }

    // Small buttons (inside SplitButton wrapper) use a different background texture.
    const isSmall = Boolean(element.closest(".action-element-container"));
    const bgFile  = isSmall
        ? "modules/enhancedcombathud-impmal/styles/button_background_small.webp"
        : "modules/enhancedcombathud-impmal/styles/button_background_large.webp";

    element.style.backgroundImage = "none";
    element.style.backgroundColor = "rgba(65, 75, 85, 0.9)";

    const bg = document.createElement("div");
    bg.className = "im-theme-bg";
    bg.style.cssText = `
        position: absolute;
        inset: 0;
        background-image: url("${bgFile}");
        background-size: auto 100%;
        background-position: center center;
        background-repeat: no-repeat;
        z-index: 0;
        pointer-events: none;
    `;

    const iconDiv = document.createElement("div");
    iconDiv.className = "im-theme-icon";
    iconDiv.style.cssText = `
        position: absolute;
        inset: 0;
        background-image: url("${iconUrl}");
        background-size: contain;
        background-position: center;
        background-repeat: no-repeat;
        background-origin: content-box;
        padding: inherit;
        z-index: 1;
        pointer-events: none;
        filter: ${filter};
    `;

    const tint = document.createElement("div");
    tint.className = "im-theme-tint";
    tint.style.cssText = `
        position: absolute;
        inset: 0;
        background: ${IM_TEAL_TINT};
        z-index: 2;
        pointer-events: none;
    `;

    element.insertBefore(bg, element.firstChild);
    element.insertBefore(iconDiv, bg.nextSibling);
    element.insertBefore(tint, iconDiv.nextSibling);
}

export function makeWeaponButton(ARGON) {
    return class IMWeaponButton extends ARGON.MAIN.BUTTONS.ItemButton {
        constructor({ item, isWeaponSet=false, isPrimary=false }) {
            super({ item, isWeaponSet, isPrimary, inActionPanel: true });
        }
        get hasAction()  { return Boolean(this.item); }
        get label()      { return this.item?.name ?? ""; }
        get icon()       { return this.item?.img ?? PLACEHOLDER_ICON; }
        get hasTooltip() { return Boolean(this.item); }
        get isActive()   {
            if (this.item?.type === "trait") return this.item.system.attack?.enabled === true;
            return this.item?.system.equipped?.value === true;
        }
        get targets() {
            if (!this.item) return 0;
            const tr = this.item.system.traits;
            return (tr?.has?.("blast") || tr?.has?.("spray")) ? 0 : 1;
        }
        get quantity() {
            const sys = this.item?.system;
            // Throwable weapons always show remaining quantity as the counter.
            if (this._isThrowable) return sys?.quantity ?? null;
            if (sys?.attackType === "ranged" && sys.mag?.value) return sys.mag.current ?? 0;
            return null;
        }
        /** True if this is a melee weapon with the Thrown trait. */
        get _isThrowable() {
            return this.item?.system?.attackType === "melee"
                && Boolean(this.item?.system?.traits?.has?.("thrown"));
        }
        get _thrownMode() {
            const key = `${this.item?.actor?.id}-${this.item?.id}`;
            return _thrownModeState.get(key) ?? false;
        }
        set _thrownMode(value) {
            const key = `${this.item?.actor?.id}-${this.item?.id}`;
            _thrownModeState.set(key, value);
        }
        async _onSetChange({ sets, active }) {
            const activeSet = sets[active];
            if (this.isPrimary) {
                // Hide the offhand slot when the active set uses a two-handed weapon
                // (both slots carry the same item). Passing null collapses the button.
                const isTwoHanded = activeSet?.secondary?.system?.traits?.has?.("twohanded");
                this.setItem(isTwoHanded ? null : (activeSet?.primary ?? null));
            } else {
                this.setItem(activeSet?.secondary ?? null);
            }
        }
        async _renderInner() {
            await super._renderInner();
            // Argon only sets/clears style.filter when quantity is numeric.
            // If this item has no quantity (e.g. a melee weapon), a stale
            // grayscale filter from the previously-equipped ammo-depleted
            // two-handed weapon will persist. Clear it explicitly.
            if (!Number.isNumeric(this.quantity)) {
                this.element.style.filter = "";
            }
            if (!this._isThrowable) return;

            // The native quantity-1 badge is rendered by super (because our quantity
            // getter returns sys.quantity for throwable weapons).  We hijack it as
            // the toggle rather than injecting a separate element.
            const q1 = this.element.querySelector(".quantity-1");
            if (!q1) return;

            const isImTheme = document.body.classList.contains("ech-impmal-theme-classic");
            q1.classList.add("im-thrown-toggle");
            if (this._thrownMode) q1.classList.add("im-thrown-active");
            if (isImTheme) q1.classList.add("im-thrown-toggle--im");

            q1.title = game.i18n.localize(
                this._thrownMode
                    ? "ECHIM.ThrowToggle.SwitchToMelee"
                    : "ECHIM.ThrowToggle.SwitchToThrown"
            );

            // Melee mode: show "M" letter.  Thrown mode: show remaining quantity number.
            if (!this._thrownMode) {
                const span = q1.querySelector("span");
                if (span) span.textContent = "M";
            }

            q1.addEventListener("click", (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                this._thrownMode = !this._thrownMode;
                this.render();
            });
        }
        async _onLeftClick()  {
            if (!this.item) return;
            if (game.settings.get(ModuleName, "movementDrain"))
                ui.ARGON?.components?.movement?.drainBaseMovement();

            if (this._thrownMode && this._isThrowable) {
                // Capture everything we need into locals NOW, before any await point.
                // After HUD teardown this.item becomes null, but actor/itemId remain valid
                // as references into game.actors, so finally can always re-fetch the item.
                const actor  = this.item.actor;
                const itemId = this.item.id;
                const sys    = this.item.system;
                const qty    = sys.quantity ?? 0;

                if (qty <= 0) {
                    ui.notifications.warn(game.i18n.localize("ECHIM.ThrowToggle.NoQuantity"));
                    return;
                }

                // Remember originals so we can restore after the test.
                const restore = {
                    "system.attackType": sys.attackType,
                    "system.spec":       sys.spec ?? "",
                    "system.category":   sys.category,
                };

                // Capture the current target(s) now before the async test dialog opens.
                const throwTarget = [...game.user.targets][0] ?? null;

                // Idempotent restore helper — no-op if the dirty flag is already cleared.
                const doRestore = async () => {
                    const liveItem = actor.items.get(itemId);
                    if (!liveItem?.getFlag(ModuleName, "throwRestore")) return;
                    await liveItem.update({
                        ...restore,
                        [`flags.${ModuleName}.throwRestore`]: null,
                    });
                };

                // Restore the item the instant the dialog opens — setupData() has already
                // read the ranged data by then, so the weapon is only "ranged" for the
                // few ms it takes to build the dialog context.
                const renderHookId = Hooks.once("renderWeaponTestDialog", () => {
                    actor.items.get(itemId)?.update({
                        ...restore,
                        [`flags.${ModuleName}.throwRestore`]: null,
                    });
                });

                // Write the dirty flag + mutate to ranged in one DB round-trip.
                await actor.items.get(itemId)?.update({
                    [`flags.${ModuleName}.throwRestore`]: restore,
                    "system.attackType": "ranged",
                    "system.spec":       "thrown",
                    "system.category":   "grenadesExplosives",
                });

                let testRan = false;
                try {
                    const result = await actor.setupWeaponTest(itemId);
                    testRan = result != null;
                } catch(_) {
                    // setupWeaponTest doesn't reject, but guard anyway.
                } finally {
                    Hooks.off("renderWeaponTestDialog", renderHookId);
                    // doRestore is a no-op if the render hook already cleared the flag.
                    // It only does real work if setupData threw before the dialog rendered.
                    await doRestore();

                    if (testRan) {
                        // The render hook restored the item to melee before postRoll ran,
                        // so grenadesExplosives useAmmo() never fired.  Decrement manually.
                        const liveItem = actor.items.get(itemId);
                        if (liveItem) {
                            const currentQty = liveItem.system.quantity ?? 0;
                            if (currentQty > 0)
                                await liveItem.update({ "system.quantity": currentQty - 1 });
                        }

                        // Item Piles integration: drop the melee weapon at the target's feet.
                        if (game.modules.get("item-piles")?.active) {
                            const pileItem = actor.items.get(itemId);
                            if (pileItem) {
                                const pileItemData = foundry.utils.deepClone(pileItem.toObject());
                                pileItemData.system.quantity = 1;

                                const dropToken = throwTarget
                                    ?? canvas.tokens.placeables.find(t => t.actor?.id === actor.id);
                                const pos = dropToken?.center ?? { x: 0, y: 0 };

                                await game.itempiles.API.createItemPile({
                                    position: pos,
                                    items:    [pileItemData],
                                });
                            }
                        }

                        if (game.settings.get(ModuleName, "thrownTracking")) {
                            const tracker = foundry.utils.deepClone(actor.getFlag(ModuleName, "thrownTracker") ?? {});
                            tracker[itemId] = (tracker[itemId] ?? 0) + 1;
                            await actor.setFlag(ModuleName, "thrownTracker", tracker);
                        }
                    }
                }
                return;
            }

            if (this.item.type === "trait") return this.item.actor.setupTraitTest(this.item.id);
            return this.item.actor.setupWeaponTest(this.item.id);
        }
        async _onRightClick() { this.item?.sheet.render(true); }
        async _onSetChange({ sets, active }) {
            const activeSet = sets[active] || {};
            if (this.isPrimary) {
                // If secondary slot holds a two-handed weapon, the off-hand slot should be empty
                const secItem = activeSet.secondary ?? null;
                this.setItem(secItem?.system?.traits?.has?.("twohanded") ? null : (activeSet.primary ?? null));
            } else {
                this.setItem(activeSet.secondary ?? null);
            }
        }
        async getTooltipData() {
            if (!this.item) return null;
            const sys = this.item.system;
            const details = [];
            if (sys.category) {
                const catKey = "IMPMAL." + sys.category.charAt(0).toUpperCase() + sys.category.slice(1);
                details.push({ label:"ECHIM.TooltipLabel.Category", value: game.i18n.localize(catKey) ?? sys.category });
            }
            const spec = sys.specialisation ?? sys.spec;
            if (spec) details.push({ label:"ECHIM.TooltipLabel.Specialization", value: cap(spec) });
            if (sys.damage?.value) details.push({ label:"ECHIM.TooltipLabel.Damage", value: sys.damage.value });
            if (sys.range) details.push({ label:"ECHIM.TooltipLabel.Range", value: rangeLabel(sys.range) ?? cap(String(sys.range)) });
            let description = "";
            const traitList = sys.traits?.list ?? [];
            const hasIgnoreAP = sys.damage?.ignoreAP === true;
            if (traitList.length || hasIgnoreAP) {
                const traitsLabel = game.i18n.localize("ECHIM.TooltipLabel.Traits");
                const ignoreApLabel = game.i18n.localize("ECHIM.TooltipLabel.IgnoreAP");
                const badges = traitList.map(t => {
                    const label = traitLabel(t.key) ?? cap(t.key);
                    let display;
                    if (t.key === "spread" && isMetresMode()) {
                        display = `${label} (1m radius)`;
                    } else {
                        display = t.value ? `${label} (${t.value})` : label;
                    }
                    return `<span class="im-trait-badge">${display}</span>`;
                });
                if (hasIgnoreAP) badges.push(`<span class="im-trait-badge">${ignoreApLabel}</span>`);
                description = `<div class="im-trait-label">${traitsLabel}</div><div class="im-trait-list">${badges.join("")}</div>`;
            }
            return { title: this.item.name, description, details };
        }
        // Weapon buttons intentionally skip theme decorations
    };
}

export function makeActionButton(ARGON) {
    return class IMActionButton extends ARGON.MAIN.BUTTONS.ActionButton {
        constructor({ label, icon, tooltip, onClick, colorScheme=0 }) {
            super();
            this._rawLabel    = label ?? "";
            this._icon        = icon ?? PLACEHOLDER_ICON;
            this._tooltipText = tooltip ?? label ?? "";
            this._onClick     = onClick;
            this._colorScheme = colorScheme;
        }
        get label()       { return this._rawLabel.toUpperCase(); }
        get icon()        { return this._icon; }
        get colorScheme() { return this._colorScheme; }
        // Override: Argon walks the prototype chain for templates; pin all subclasses to the base ActionButton template.
        get template() {
            return `modules/enhancedcombathud/templates/partials/ActionButton.hbs`;
        }
        get hasTooltip()  { return true; }
        get _iconFilter()  { return IM_ICON_FILTER; }
        async getTooltipData() {
            return { title: this._rawLabel, description:`<p>${this._tooltipText}</p>`, details:[] };
        }
        async _onLeftClick(event) {
            if (this._onClick) return this._onClick(this.actor, event);
        }
        async _renderInner() {
            await super._renderInner();
            injectThemeDecorations(this.element, this._icon, this._iconFilter);
        }
    };
}

export function makeTargetActionButton(ARGON) {
    return class IMTargetActionButton extends ARGON.MAIN.BUTTONS.ItemButton {
        constructor({ label, icon, tooltip, onClick, targets=1 }) {
            super({ item: null, isWeaponSet: false, isPrimary: false, inActionPanel: true });
            this._rawLabel    = label ?? "";
            this._icon        = icon ?? PLACEHOLDER_ICON;
            this._tooltipText = tooltip ?? label ?? "";
            this._onClick     = onClick;
            this._targets     = targets;
        }
        get visible()    { return true; }
        get label()      { return this._rawLabel.toUpperCase(); }
        get icon()       { return this._icon; }
        get targets()    { return this._targets; }
        get quantity()   { return null; }
        get ranges()     { return { normal: null, long: null }; }
        get hasTooltip() { return true; }
        get template() {
            return `modules/enhancedcombathud-impmal/templates/ActionButton.hbs`;
        }
        async getTooltipData() {
            return { title: this._rawLabel, description:`<p>${this._tooltipText}</p>`, details:[] };
        }
        async _onLeftClick(event) {
            if (this._onClick) return this._onClick(this.actor, event);
        }
        async getData() {
            return { label: this.label, icon: this._icon };
        }
        async _renderInner() {
            await ARGON.CORE.ArgonComponent.prototype._renderInner.call(this);
            this.element.style.backgroundImage = `url("${this._icon}")`;
            this.element.classList.remove("feature-element");
            this.element.classList.add("action-element", "ech-blur");
            injectThemeDecorations(this.element, this._icon);
        }
    };
}