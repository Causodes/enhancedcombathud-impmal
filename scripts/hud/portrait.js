import {
    ModuleName, CHARACTERISTICS, CHAR_LABELS, SKILLS,
    HP_RED, HP_ORANGE, HP_YELLOW, HP_GREEN,
    advColor,
    charBonus, skillTotal,
} from "../utils.js";
import { IM_GREEN, IM_GREEN_DIM, IM_DARK_BG, IM_WHITE } from "../themes.js";

function woundColor(pct) {
    if (pct >= 0.75) return HP_RED;
    if (pct >= 0.5)  return HP_ORANGE;
    if (pct >= 0.2)  return HP_YELLOW;
    return HP_GREEN;
}

function armourColor(val) {
    if (val === 0) return HP_RED;
    if (val === 1) return HP_ORANGE;
    if (val === 2) return HP_YELLOW;
    return HP_GREEN;
}

const LOC_KEYS   = ["head","rightArm","leftArm","body","rightLeg","leftLeg"];
const LOC_ABBREV = {
    head:     "IMPMAL.HeadAbbrev",
    rightArm: "IMPMAL.RightArmAbbrev",
    leftArm:  "IMPMAL.LeftArmAbbrev",
    body:     "IMPMAL.BodyAbbrev",
    rightLeg: "IMPMAL.RightLegAbbrev",
    leftLeg:  "IMPMAL.LeftLegAbbrev",
};
const LOC_LABEL = {
    head:     "IMPMAL.Head",
    rightArm: "IMPMAL.RightArm",
    leftArm:  "IMPMAL.LeftArm",
    body:     "IMPMAL.Body",
    rightLeg: "IMPMAL.RightLeg",
    leftLeg:  "IMPMAL.LeftLeg",
};

const SIDE_COL_WIDTH = 32;

const SIDE_COL_STYLE = (side) => `
    position: absolute;
    top: 0;
    bottom: 0;
    ${side}: 0;
    z-index: 3;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 4px;
    padding: 6px 2px;
    width: ${SIDE_COL_WIDTH}px;
    background: transparent;
    border: none;
`;

export function makePortraitPanel(ARGON) {
    return class IMPortraitPanel extends ARGON.PORTRAIT.PortraitPanel {
        async getEffects() {
            return this.actor.items.filter(i => i.type === "condition").map(item => ({
                img: item.img, name: item.name, tooltip: item.system?.description?.value ?? item.name,
            }));
        }
        get description() { return ""; }
        get isDead() {
            const { wounds } = this.actor.system.combat;
            return wounds.max > 0 && wounds.value >= wounds.max;
        }
        // Impmal has no "dying" state separate from dead; criticals are not death saves.
        get isDying() { return false; }

        async getData() {
            const data = await super.getData();
            const { criticals } = this.actor.system.combat;
            const corruption = this.actor.system.corruption ?? { value: 0, max: 0 };

            const showCriticals  = criticals.max > 0;
            const showCorruption = corruption.max > 0;
            const showBoth       = showCriticals && showCorruption;

            const critPct = criticals.max > 0 ? criticals.value / criticals.max : 0;
            const corrPct = corruption.max > 0 ? corruption.value / corruption.max : 0;

            return foundry.utils.mergeObject(data, {
                showCriticals, showCorruption, showBoth,
                criticalColor:   woundColor(critPct),
                criticalValue:   criticals.value,
                criticalMax:     criticals.max,
                corruptionColor: woundColor(corrPct),
                corruptionValue: corruption.value,
                corruptionMax:   corruption.max,
            });
        }

        async getStatBlocks() {
            const { wounds } = this.actor.system.combat;
            const wPct = wounds.max ? wounds.value / wounds.max : 0;
            return [
                [
                    { text:`${wounds.value}`, color:woundColor(wPct), id:"WoundsValue" },
                    { text:"/" },
                    { text:`${wounds.max}` },
                    { text:` ${game.i18n.localize("ECHIM.Portrait.Wounds")}`, id:"WoundsText" },
                ],
            ];
        }

        get template() { return `/modules/${ModuleName}/templates/PortraitPanel.hbs`; }

        _buildFateColumn() {
            const fate  = this.actor.system.fate;
            if (!fate) return;
            const max   = fate.max ?? 0;
            const value = fate.value ?? 0;
            if (max === 0) return;

            const nameFontPx = 16;
            const pipFontPx  = Math.round(nameFontPx * 1.1);

            const isImTheme = document.body.classList.contains("ech-impmal-theme-classic");
            const filledColor = isImTheme ? IM_GREEN : IM_WHITE;

            const col = document.createElement("div");
            col.style.cssText = SIDE_COL_STYLE("right") + "pointer-events: all;";
            col.setAttribute("data-tooltip", game.i18n.format("ECHIM.Portrait.FateTooltip", { value, max }));

            for (let i = 1; i <= max; i++) {
                const icon = document.createElement("i");
                if (i <= value) {
                    icon.classList.add("fa-solid", "fa-circle-f");
                    icon.style.color = filledColor;
                } else {
                    icon.classList.add("fa-regular", "fa-circle");
                    icon.style.color = "rgba(200, 215, 235, 0.45)";
                }
                icon.style.fontSize = `${pipFontPx}px`;
                col.appendChild(icon);
            }

            col.onclick = async (e) => {
                e.stopPropagation();
                const v = this.actor.system.fate.value;
                if (v > 0) await this.actor.update({ "system.fate.value": v - 1 });
            };
            col.ondblclick  = (e) => e.stopPropagation();
            col.oncontextmenu = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const v = this.actor.system.fate.value;
                const m = this.actor.system.fate.max;
                if (v < m) await this.actor.update({ "system.fate.value": v + 1 });
            };

            this.element.appendChild(col);
        }

        _buildProtectionColumn() {
            const locs = this.actor.system.combat?.hitLocations;
            if (!locs) return;

            // Constrain player-details to the centre strip between both side columns.
            const playerDetails = this.element.querySelector(".player-details");
            if (playerDetails) {
                playerDetails.style.left       = `${SIDE_COL_WIDTH}px`;
                playerDetails.style.right      = `${SIDE_COL_WIDTH}px`;
                playerDetails.style.width      = "auto";
                playerDetails.style.paddingLeft  = "4px";
                playerDetails.style.paddingRight = "4px";
                playerDetails.style.paddingTop   = "1rem";
                playerDetails.style.textAlign    = "center";
                playerDetails.style.boxSizing    = "border-box";

                const nameSpan = playerDetails.querySelector(".player-name");
                if (nameSpan) {
                    nameSpan.style.whiteSpace = "normal";
                    nameSpan.style.wordBreak  = "break-word";
                    nameSpan.style.textAlign  = "center";
                    nameSpan.style.width      = "100%";
                }
            }

            const col = document.createElement("div");
            col.style.cssText = SIDE_COL_STYLE("left") + "pointer-events: none;";

            for (const key of LOC_KEYS) {
                const loc    = locs[key];
                if (!loc) continue;
                const abbrev = game.i18n.localize(LOC_ABBREV[key]) ?? key.slice(0,2).toUpperCase();
                const label  = game.i18n.localize(LOC_LABEL[key])  ?? key;
                const armour = loc.armour ?? 0;

                const cell = document.createElement("div");
                cell.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    line-height: 1;
                    gap: 1px;
                `;
                cell.setAttribute("data-tooltip", `${label}: ${armour}`);

                const abbrevEl = document.createElement("span");
                abbrevEl.style.cssText = `
                    font-size: 1rem;
                    font-weight: 400;
                    color: rgba(200, 215, 235, 0.8);
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                `;
                abbrevEl.textContent = abbrev;

                const valEl = document.createElement("span");
                valEl.style.cssText = `
                    font-size: 1.25rem;
                    font-weight: 600;
                    color: ${armourColor(armour)};
                `;
                valEl.textContent = armour;

                cell.appendChild(abbrevEl);
                cell.appendChild(valEl);
                col.appendChild(cell);
            }

            this.element.appendChild(col);
        }

        async _renderInner() {
            await super._renderInner();

            if (document.body.classList.contains("ech-impmal-theme-classic")) {
                this.element.querySelectorAll(".player-button").forEach(btn => {
                    btn.style.color  = IM_GREEN;
                    btn.style.border = `1px solid ${IM_GREEN_DIM}`;
                    let bg = btn.querySelector(".im-btn-bg");
                    if (!bg) {
                        bg = document.createElement("div");
                        bg.className = "im-btn-bg";
                        bg.style.cssText = `position:absolute;inset:0;background:${IM_DARK_BG};z-index:-1;pointer-events:none;`;
                        btn.appendChild(bg);
                    }
                    // Property assignment replaces the handler on re-render rather than stacking listeners.
                    btn.onmouseenter = () => { btn.style.color = IM_WHITE; btn.style.borderColor = IM_GREEN; };
                    btn.onmouseleave = () => { btn.style.color = IM_GREEN; btn.style.borderColor = IM_GREEN_DIM; };
                });
            }

            this.element.ondblclick = () => {
                const t = canvas.tokens.placeables.find(t => t.actor === this.actor);
                if (t) canvas.animatePan(t.center);
            };
            this.element.oncontextmenu = (e) => {
                if (!e.target?.classList.contains("portrait-hud-image")) return;
                this.actor.sheet.rendered ? this.actor.sheet.close() : this.actor.sheet.render(true);
            };

            const woundsBlock   = this.element.querySelector("#WoundsText")?.parentElement;
            const woundsValueEl = this.element.querySelector("#WoundsValue");
            if (woundsBlock && woundsValueEl) {
                const inp = document.createElement("input");
                inp.type = "number"; inp.style.cssText = "width:35px;display:none;";
                inp.onfocus = () => inp.select();
                woundsBlock.prepend(inp);
                woundsBlock.onmouseenter = () => {
                    inp.value = this.actor.system.combat.wounds.value;
                    inp.style.display = ""; woundsValueEl.style.display = "none";
                };
                woundsBlock.onmouseleave = async () => {
                    inp.style.display = "none"; woundsValueEl.style.display = "";
                    const nv = Number(inp.value);
                    if (!isNaN(nv) && nv !== this.actor.system.combat.wounds.value)
                        await this.actor.update({ "system.combat.wounds.value": nv });
                };
            }

            this._buildProtectionColumn();
            this._buildFateColumn();
        }

        // Impmal has no death-save mechanic; suppress the Argon "not implemented" warning.
        async _onDeathSave() {}

        async _getButtons() {
            return [
                {
                    id: "roll-initiative", icon: "fas fa-dice-d20", label: game.i18n.localize("ECHIM.Button.RollInitiative"),
                    onClick: async () => {
                        const actor  = this.actor;
                        const tokens = actor.getActiveTokens();
                        if (!tokens.length) return;
                        if (actor.inCombat) {
                            await actor.rollInitiative?.({ rerollInitiative: true });
                        } else {
                            await tokens[0].toggleCombat();
                            await new Promise(r => setTimeout(r, 100));
                            const combatant = game.combat?.combatants.find(c => c.actorId === actor.id);
                            if (combatant) await combatant.update({
                                initiative: charBonus(actor,"per") + charBonus(actor,"ag") + (actor.system.combat.initiative ?? 0)
                            });
                        }
                    },
                },
                { id:"open-sheet",      icon:"fas fa-user",      label: game.i18n.localize("ECHIM.Button.OpenSheet"),    onClick:() => this.actor.sheet.render(true) },
                { id:"toggle-minimize", icon:"fas fa-caret-down", label: game.i18n.localize("ECHIM.Button.Minimize"),      onClick:() => ui.ARGON.toggleMinimize()     },
            ];
        }
    };
}

export function makeDrawerPanel(ARGON) {
    return class IMDrawerPanel extends ARGON.DRAWER.DrawerPanel {
        get title() { return game.i18n.localize("ECHIM.Portrait.DrawerTitle"); }

        get categories() {
            const actor = this.actor;

            // -- Characteristics --------------------------------------
            const charButtons = CHARACTERISTICS.map(key => {
                const ch        = actor.system.characteristics[key] ?? {};
                const modifier  = ch.modifier ?? 0;
                const base      = (ch.starting ?? 0) + (ch.advances ?? 0);
                const total     = base + modifier;
                const bonus     = Math.floor(total / 10);
                const bonusBase = Math.floor(base / 10);
                const bonusGold = modifier !== 0 && bonus !== bonusBase;
                const label     = game.i18n.localize(CHAR_LABELS[key]) ?? key.toUpperCase();
                const modSpan   = modifier !== 0
                    ? `<span style="min-width:2.5rem;text-align:right;font-size:0.9rem;color:var(--ech-movement-baseMovement-background);">${modifier > 0 ? "+" : ""}${modifier}</span>`
                    : `<span style="min-width:2.5rem;"></span>`;
                const bonusSpan = bonusGold
                    ? `<span style="min-width:2.5rem;text-align:right;font-size:1.0rem;color:var(--ech-movement-baseMovement-background);">(${bonus})</span>`
                    : `<span style="min-width:2.5rem;text-align:right;font-size:1.0rem;opacity:.65;">(${bonus})</span>`;
                return new ARGON.DRAWER.DrawerButton([{
                    label: `<span style="display:inline-flex;width:100%;align-items:baseline;gap:0.3rem;">
                              <span style="flex:1;min-width:3rem;font-size:1.1rem;">${label}</span>
                              <span style="min-width:2.5rem;text-align:right;color:var(--ech-movement-baseMovement-background);font-size:1.1rem;">${base}</span>
                              ${modSpan}
                              ${bonusSpan}
                            </span>`,
                    onClick: () => actor.setupCharacteristicTest(key),
                }]);
            });

            // -- Skills -----------------------------------------------
            const skillButtons = SKILLS.map(key => {
                const sk = actor.system.skills[key];
                if (!sk) return null;
                const total    = skillTotal(actor, key);
                const advPts   = sk.advances * 5;
                const chAbbr   = (game.i18n.localize(CHAR_LABELS[sk.characteristic]) ?? sk.characteristic).slice(0,3).toUpperCase();
                const skLocKey = `IMPMAL.HUD.Skill${key.charAt(0).toUpperCase()}${key.slice(1)}`;
                const label    = game.i18n.localize(skLocKey)
                              ?? game.i18n.localize(`IMPMAL.${key.charAt(0).toUpperCase()}${key.slice(1)}`)
                              ?? key.charAt(0).toUpperCase() + key.slice(1);
                const color    = advColor(advPts);
                const advSpan  = color
                    ? `<span style="min-width:2.5rem;text-align:right;font-size:0.9rem;color:${color};">+${advPts}</span>`
                    : `<span style="min-width:2.5rem;"></span>`;
                return new ARGON.DRAWER.DrawerButton([{
                    label: `<span style="display:inline-flex;width:100%;align-items:baseline;gap:0.3rem;">
                              <span style="flex:1;min-width:5rem;font-size:1.1rem;">${label}</span>
                              <span style="min-width:2.5rem;text-align:right;color:var(--ech-movement-baseMovement-background);font-size:1.1rem;">${total}</span>
                              ${advSpan}
                              <span style="min-width:2.5rem;text-align:right;opacity:.55;font-size:0.9rem;">${chAbbr}</span>
                            </span>`,
                    onClick: () => actor.setupSkillTest({ key }),
                }]);
            }).filter(Boolean);

            // -- Specialisations --------------------------------------
            const allSpecs = actor.items.filter(i => i.type === "specialisation");
            const specButtons = allSpecs.length
                ? allSpecs.map(s => {
                    const skillKey  = s.system?.skill ?? "";
                    const sk        = skillKey ? actor.system.skills[skillKey] : null;
                    // Show the parent skill name (first 4 chars), not characteristic
                    const skillLabel = skillKey
                        ? (game.i18n.localize(`IMPMAL.HUD.Skill${skillKey.charAt(0).toUpperCase()}${skillKey.slice(1)}`) ??
                           game.i18n.localize(`IMPMAL.${skillKey.charAt(0).toUpperCase()}${skillKey.slice(1)}`) ??
                           skillKey)
                        : "";
                    const chAbbr    = skillLabel.slice(0, 4).toUpperCase();
                    const specTotal = skillKey ? skillTotal(actor, skillKey) : null;
                    const advances  = s.system?.advances ?? 0;
                    const advPts    = advances * 5;
                    const color     = advColor(advPts);
                    const advSpan   = color
                        ? `<span style="min-width:2.5rem;text-align:right;font-size:0.9rem;color:${color};">+${advPts}</span>`
                        : `<span style="min-width:2.5rem;"></span>`;
                    const totalSpan = specTotal !== null
                        ? `<span style="min-width:2.5rem;text-align:right;color:var(--ech-movement-baseMovement-background);font-size:1.1rem;">${specTotal}</span>`
                        : `<span style="min-width:2.5rem;"></span>`;
                    return new ARGON.DRAWER.DrawerButton([{
                        label: `<span style="display:inline-flex;width:100%;align-items:baseline;gap:0.3rem;">
                                  <span style="flex:1;min-width:5rem;font-size:1.1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.name}</span>
                                  ${totalSpan}
                                  ${advSpan}
                                  <span style="min-width:2.5rem;text-align:right;opacity:.55;font-size:0.9rem;">${chAbbr}</span>
                                </span>`,
                        onClick: () => actor.setupSkillTest({ key: skillKey, name: s.name }),
                    }]);
                })
                : [new ARGON.DRAWER.DrawerButton([{
                    label: `<span style="opacity:0.5;font-size:1rem">${game.i18n.localize("ECHIM.Portrait.NoSpecs")}</span>`,
                    onClick: () => {},
                }])];

            return [
                { gridCols:"1fr", captions:[{ label: game.i18n.localize("ECHIM.Portrait.CategoryChars") }],  buttons:charButtons },
                { gridCols:"1fr", captions:[{ label: game.i18n.localize("ECHIM.Portrait.CategorySkills") }], buttons:skillButtons },
                { gridCols:"1fr", captions:[{ label: game.i18n.localize("ECHIM.Portrait.CategorySpecs") }],  buttons:specButtons },
            ];
        }

        get template() { return `/modules/${ModuleName}/templates/DrawerPanel.hbs`; }
    };
}