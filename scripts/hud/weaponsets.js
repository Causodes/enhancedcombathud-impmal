import { buildUnequipUpdate, ModuleName } from "../utils.js";

export function makeWeaponSets(ARGON) {
    return class IMWeaponSets extends ARGON.WeaponSets {
        async getDefaultSets() {
            const hands = this.actor.system.hands;
            if (!hands) return {
                1: { primary: null, secondary: null },
                2: { primary: null, secondary: null },
                3: { primary: null, secondary: null },
            };
            const primaryHand   = this.actor.system.handed ?? "right";
            const secondaryHand = primaryHand === "right" ? "left" : "right";
            return {
                1: {
                    primary:   hands[secondaryHand].document?.uuid ?? null,
                    secondary: hands[primaryHand].document?.uuid   ?? null,
                },
                2: { primary: null, secondary: null },
                3: { primary: null, secondary: null },
            };
        }
        async _getSets() {
            const sets = foundry.utils.mergeObject(
                await this.getDefaultSets(),
                foundry.utils.deepClone(this.actor.getFlag("enhancedcombathud", "weaponSets") || {})
            );
            for (const [, slots] of Object.entries(sets)) {
                slots.primary   = slots.primary   ? await fromUuid(slots.primary)   : null;
                slots.secondary = slots.secondary ? await fromUuid(slots.secondary) : null;
            }
            return sets;
        }
        async _onDrop(event) {
            try {
                event.preventDefault(); event.stopPropagation();
                const data = JSON.parse(event.dataTransfer.getData("text/plain"));
                if (data?.type !== "Item") return;
                const item = await fromUuid(data.uuid);
                if (!item || item.type !== "weapon") return;
                const set  = event.currentTarget.dataset.set;
                const slot = event.currentTarget.dataset.slot;
                // Block dropping into the offhand slot when the set already holds a two-handed weapon
                if (slot === "primary") {
                    const currentSets = await this._getSets();
                    if (currentSets[set]?.secondary?.system?.traits?.has?.("twohanded")) return;
                }
                const isTwoHanded = item.system.traits?.has?.("twohanded");
                const sets = foundry.utils.deepClone(this.actor.getFlag("enhancedcombathud", "weaponSets") || {});
                sets[set] = sets[set] || {};
                sets[set][slot] = data.uuid;
                if (isTwoHanded) {
                    // Fill both slots with the same two-handed weapon
                    sets[set][slot === "primary" ? "secondary" : "primary"] = data.uuid;
                } else if (slot === "secondary") {
                    // Replacing the main-hand weapon: if the old secondary was two-handed,
                    // both slots held its UUID — clear the primary so it doesn't linger
                    const currentSets = await this._getSets();
                    if (currentSets[set]?.secondary?.system?.traits?.has?.("twohanded")) {
                        sets[set].primary = null;
                    }
                }
                await this.actor.setFlag("enhancedcombathud", "weaponSets", sets);
                await this.render();
            } catch(e) { console.error("IMWeaponSets._onDrop:", e); }
        }
        async _clearSlot(set, slot, sets) {
            const existingUuid = sets[set]?.[slot];
            sets[set] = sets[set] || {};
            sets[set][slot] = null;
            if (existingUuid) {
                const item = await fromUuid(existingUuid).catch(() => null);
                if (item?.system?.traits?.has?.("twohanded"))
                    sets[set][slot === "primary" ? "secondary" : "primary"] = null;
            }
        }
        async _mutateAndSaveSlot(set, slot) {
            const sets = foundry.utils.deepClone(this.actor.getFlag("enhancedcombathud", "weaponSets") || {});
            await this._clearSlot(set, slot, sets);
            await this.actor.setFlag("enhancedcombathud", "weaponSets", sets);
            await this.render();
        }
        async _onDragEnd(event) {
            event.preventDefault(); event.stopPropagation();
            await this._mutateAndSaveSlot(event.currentTarget.dataset.set, event.currentTarget.dataset.slot);
        }
        async _onContextMenu(event) {
            event.preventDefault(); event.stopPropagation();
            await this._mutateAndSaveSlot(event.currentTarget.dataset.set, event.currentTarget.dataset.slot);
        }
        async _onSetChange({ sets, active }) {
            this._changingSet = true;
            try {
                const activeSet     = sets[active];
                const primaryHand   = this.actor.system.handed ?? "right";
                const secondaryHand = primaryHand === "right" ? "left" : "right";
                const offHandItem  = activeSet?.primary   ?? null;
                const mainHandItem = activeSet?.secondary ?? null;
                const unequip = buildUnequipUpdate(this.actor);
                if (!foundry.utils.isEmpty(unequip)) await this.actor.update(unequip);
                if (mainHandItem) {
                    await this.actor.update(this.actor.system.hands.equip(mainHandItem, primaryHand));
                    const isTwoHanded = mainHandItem.system.traits?.has?.("twohanded");
                    if (!isTwoHanded && offHandItem && offHandItem.id !== mainHandItem.id)
                        await this.actor.update(this.actor.system.hands.equip(offHandItem, secondaryHand));
                } else if (offHandItem) {
                    await this.actor.update(this.actor.system.hands.equip(offHandItem, secondaryHand));
                }
            } finally {
                this._changingSet = false;
            }
        }
        _applyTwoHandedStyles(sets) {
            if (!this.element) return;
            for (const [setId, setData] of Object.entries(sets)) {
                const primarySlot = this.element.querySelector(`.set[data-set="${setId}"][data-slot="primary"]`);
                if (!primarySlot) continue;
                const isTwoHanded = setData?.secondary?.system?.traits?.has?.("twohanded");
                if (isTwoHanded) {
                    primarySlot.style.backgroundColor = "rgba(60, 60, 80, 0.55)";
                    primarySlot.style.outline         = "1px solid rgba(150, 160, 180, 0.4)";
                    primarySlot.style.filter          = "grayscale(0.6) brightness(0.7)";
                    primarySlot.setAttribute("data-tooltip", game.i18n.localize("ECHIM.Tooltip.TwoHandedSlot"));
                } else {
                    primarySlot.style.backgroundColor = "";
                    primarySlot.style.outline         = "";
                    primarySlot.style.filter          = "";
                    primarySlot.removeAttribute("data-tooltip");
                }
            }
        }
        async _renderInner() {
            await super._renderInner();
            const swapped = game.settings.get(ModuleName, "swapHandDisplay");
            this.element.classList.toggle("im-swapped-hands", swapped);
            try {
                const sets = await this._getSets();
                this._applyTwoHandedStyles(sets);
            } catch(e) {}
        }
    };
}