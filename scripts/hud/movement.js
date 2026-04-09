import {
    ModuleName, MOVEMENT_MODE_KEY, FREE_METRES, HP_YELLOW,
    actorSpeedTier, getMovementMax,
} from "../utils.js";
import { IM_PIP_USED } from "../themes.js";

export function makeMovementHud(ARGON) {
    return class IMMovementHud extends ARGON.MovementHud {
        constructor(...args) {
            super(...args);
            this._extraMovement        = 0;
            this._movementMode         = localStorage.getItem(MOVEMENT_MODE_KEY) || "zones";
            this._historyBaseline      = null;      // history length at turn start
            this._freeActivated        = false;     // whether Free Movement button was clicked this turn
            this._freeBaseline         = null;      // history length at moment Free Movement was activated
            this._preFreePips          = 0;         // speed pips already shown as drained at activation
            this._drainOffset          = 0;         // forced drain pips from non-movement actions
            this._restorationCredit    = 0;         // pips restored by talents (e.g. Hit & Run); offsets canvasUsed
            this._speedUsed            = 0;         // base-movement pips used this turn (excludes free pips)
            this._tierCloseHandler     = null;      // document-level click handler for closing tier dropdown
            this._usedThisTurn         = new Set(); // keys of once-per-turn talent actions already used
        }

        get movementMax() {
            try { return getMovementMax(this.actor, this._movementMode); } catch { return 0; }
        }

        get template() {
            return `/modules/${ModuleName}/templates/MovementHud.hbs`;
        }

        // Expose free-movement state for the Free Action panel button
        get freeMovementAvailable() {
            return this._movementMode !== "zones" && !this._freeActivated;
        }

        /** Called when any non-movement, non-free Action is taken. Fully drains speed pips. */
        drainBaseMovement() {
            if (this._movementMode === "zones") return;
            const speedTotal = this.movementMax + this._extraMovement;
            if (this._freeActivated) {
                // Free Movement has already been granted — drain everything including the free pips.
                const dist      = canvas.scene?.dimensions?.distance ?? 1;
                const isRunning = this._extraMovement > 0;
                const freePips  = Math.round((isRunning ? FREE_METRES * 2 : FREE_METRES) / dist);
                this._preFreePips = speedTotal;
                // _drainOffset drives `used` up to at least freePips so that freeUsed
                // fills completely in updateMovement() (freeUsed = Math.min(used, freePips)).
                this._drainOffset = freePips;
            } else {
                // Free Movement not yet taken — drain only the speed pips; leave free pips
                // available for the player to still trigger Free Movement afterward.
                this._drainOffset = speedTotal;
            }
            this.updateMovement();
        }

        activateFreeMovement() {
            if (!this.freeMovementAvailable) return;
            // Snapshot speed pips at activation; reset drain so free pips start clean.
            const wasUsed = this.movementUsed;
            this._freeActivated   = true;
            this._preFreePips     = wasUsed;
            this._drainOffset     = 0;
            const history = this.token?.document?.movementHistory ?? [];
            this._historyBaseline = history.length;
            this.updateMovement();
        }

        // Called by Argon on new turn; reset all state.
        _onNewTurn(combat, updates) {
            const history = this.token?.document?.movementHistory ?? [];
            this._historyBaseline  = history.length;
            this._freeBaseline        = null;
            this._freeActivated       = false;
            this._preFreePips         = 0;
            this._drainOffset         = 0;
            this._restorationCredit   = 0;
            this._speedUsed           = 0;
            this._extraMovement       = 0;
            this._usedThisTurn        = new Set();
            if (game.settings.get(ModuleName, "freeMovementAuto")) this.activateFreeMovement();
            else this.updateMovement();
        }

        /** Mark a once-per-turn action as used and update button visual states. */
        markUsed(key) {
            this._usedThisTurn.add(key);
            this.updateMovement();
        }

        /** Returns true if the given once-per-turn key has already been used. */
        isUsedThisTurn(key) {
            return this._usedThisTurn.has(key);
        }

        /**
         * Restore movement pips. Zones mode restores 1 zone; metres mode restores the given metres value.
         * @param {number} metres  metres to restore (metres mode only)
         */
        restoreMovement(metres) {
            const dist = canvas.scene?.dimensions?.distance ?? 1;
            const pipAmount = this._movementMode === "zones"
                ? 1
                : Math.round(metres / dist);
            // Reduce the drain offset (handles action-drained movement)
            this._drainOffset = Math.max(0, this._drainOffset - pipAmount);
            // Credit offsets canvas-tracked movement; capped in updateMovementUsed.
            this._restorationCredit += pipAmount;
            this.updateMovement();
        }

        updateMovementUsed() {
            const history  = this.token?.document?.movementHistory ?? [];
            const baseline = this._historyBaseline ?? 0;

            let canvasUsed;
            if (this._movementMode === "zones") {
                canvasUsed = Math.max(0, history.length - baseline);
            } else {
                const dist   = canvas.scene?.dimensions?.distance ?? 1;
                const recent = history.slice(baseline);
                canvasUsed = Math.round(
                    recent.reduce((acc, m) => acc + (m.cost ?? 0), 0) / dist
                );
            }
            // _restorationCredit reduces apparent canvasUsed (e.g. Hit & Run talent).
            canvasUsed = Math.max(0, canvasUsed - (this._restorationCredit ?? 0));
            // _drainOffset forces minimum usage when a non-movement action was taken
            this.movementUsed = Math.max(canvasUsed, this._drainOffset);
        }

        updateMovement() {
            this.updateMovementUsed();

            const dist       = canvas.scene?.dimensions?.distance ?? 1;
            const isRunning  = this._extraMovement > 0;
            const isZones    = this._movementMode === "zones";

            const freePips   = isZones ? 0 : Math.round((isRunning ? FREE_METRES * 2 : FREE_METRES) / dist);
            const baseMax    = this.movementMax;
            const speedPips  = baseMax;
            const totalMax   = speedPips + this._extraMovement + (this._freeActivated ? freePips : 0);

            const used       = this.movementUsed;
            // Speed and free pip drain calculations
            let freeUsed = 0, speedUsed = 0;
            if (this._freeActivated) {
                // Free pips drain first; overflow goes into speed pips
                freeUsed  = Math.min(used, freePips);
                speedUsed = Math.min(
                    speedPips + this._extraMovement,
                    this._preFreePips + Math.max(0, used - freePips)
                );
            } else {
                speedUsed = used;
            }
            // Cache for StandUp availability check (base movement used, excluding free pips)
            this._speedUsed = speedUsed;

            const displayUsed  = freeUsed + speedUsed;
            const remaining    = Math.max(0, totalMax - displayUsed);
            const speedRemain  = Math.max(0, speedPips + this._extraMovement - speedUsed);
            const remFrac     = (speedPips + this._extraMovement) > 0
                ? speedRemain / (speedPips + this._extraMovement) : 0;

            let baseBg, baseShadow, baseColor;
            if (remFrac >= 0.75) {
                baseBg     = "var(--ech-movement-baseMovement-background)";
                baseShadow = "0 0 6px var(--ech-movement-baseMovement-boxShadow)";
                baseColor  = "var(--ech-movement-baseMovement-background)";
            } else if (remFrac >= 0.5) {
                baseBg     = "var(--ech-movement-dashMovement-background)";
                baseShadow = "0 0 6px var(--ech-movement-dashMovement-boxShadow)";
                baseColor  = "var(--ech-movement-dashMovement-background)";
            } else {
                baseBg     = "var(--ech-movement-dangerMovement-background)";
                baseShadow = "0 0 6px var(--ech-movement-dangerMovement-boxShadow)";
                baseColor  = "var(--ech-movement-dangerMovement-background)";
            }

            const currentEl = this.element.querySelector(".movement-current");
            if (currentEl) {
                currentEl.innerText = remaining;
                currentEl.style.color = totalMax > 0 ? baseColor : "";
            }

            const maxEl = this.element.querySelector(".movement-max");
            if (maxEl) {
                maxEl.innerText = totalMax;
                maxEl.style.color = this._extraMovement > 0 ? HP_YELLOW : "";
            }

            // Update Free Movement + Stand Up button states in the Free Action panel
            for (const panel of ui.ARGON?.components?.main ?? []) {
                if (panel._isFreeActionPanel) panel._updateFreeButton?.();
            }

            const pipsArea      = this.element.querySelector(".im-movement-pips-area");
            const pipsContainer = this.element.querySelector(".im-movement-pips");
            if (!pipsContainer || !pipsArea) return;

            pipsContainer.innerHTML = "";
            if (totalMax === 0 && !this._freeActivated && freePips === 0) return;

            const areaH = pipsArea.clientHeight || 240;
            const areaW = pipsArea.clientWidth  || 80;

            if (isZones) {
                const pipSizeByHeight = Math.floor(areaH / (totalMax + (totalMax - 1) * 0.25));
                const pipSizeMax      = Math.floor(areaW * 0.5);
                const pipSize         = Math.min(pipSizeByHeight, pipSizeMax);
                const pipGap          = Math.max(1, Math.floor(pipSize * 0.25));

                pipsContainer.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: ${pipGap}px;
                    height: ${areaH}px;
                    width: 100%;
                `;

                for (let i = 0; i < totalMax; i++) {
                    const pip    = document.createElement("div");
                    const isUsed = i < used;
                    pip.style.cssText = `
                        width: ${pipSize}px;
                        height: ${pipSize}px;
                        border-radius: 4px;
                        background: ${isUsed ? IM_PIP_USED : baseBg};
                        box-shadow: ${isUsed ? "none" : baseShadow};
                        flex-shrink: 0;
                        transition: background 0.2s ease, box-shadow 0.2s ease;
                    `;
                    pipsContainer.appendChild(pip);
                }

            } else {
                // Fixed pip size from worst-case: 4 cols × 8 rows
                const GAP_R   = 0.25;
                const RESERVE = freePips > 0 ? 28 : 0;  // px for free-pips row (always reserve space)
                const pipByH  = Math.floor((areaH - RESERVE) / (8 + 7 * GAP_R));
                const pipByW  = Math.floor((areaW - 4)        / (4 + 3 * GAP_R));
                const pipSize = Math.max(6, Math.min(pipByH, pipByW));
                const pipGap  = Math.max(2, Math.floor(pipSize * GAP_R));

                // Number of columns: 2 normally, 4 when running
                const sCols = isRunning ? 4 : 2;
                const runPips = speedPips + this._extraMovement;

                pipsContainer.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: ${pipGap + 2}px;
                    height: ${areaH}px;
                    width: 100%;
                `;

                // Free pips: top row. Faded until activated, then full color.
                if (freePips > 0) {
                const isImTheme = document.body.classList.contains("ech-impmal-theme-classic");
                    const activated = this._freeActivated;
                    const freeSectionBg     = activated ? baseBg     : (isImTheme ? "rgba(60,180,80,0.18)"  : "rgba(90,190,245,0.18)");
                    const freeSectionShadow = activated ? baseShadow : (isImTheme ? "0 0 4px rgba(60,200,80,0.3)" : "0 0 4px rgba(110,210,255,0.3)");
                    const freeSection = document.createElement("div");
                    freeSection.style.cssText = `
                        display: flex;
                        flex-direction: row;
                        gap: ${pipGap}px;
                        align-items: center;
                        justify-content: center;
                        border-bottom: 1px solid rgba(255,255,255,0.1);
                        padding-bottom: ${pipGap}px;
                        width: 100%;
                    `;
                    for (let i = 0; i < freePips; i++) {
                        const p = document.createElement("div");
                        const isUsed = i < freeUsed;
                        p.style.cssText = `
                            width: ${pipSize}px; height: ${pipSize}px;
                            border-radius: 3px;
                            background: ${isUsed ? IM_PIP_USED : freeSectionBg};
                            box-shadow: ${isUsed ? "none" : freeSectionShadow};
                            transition: background 0.2s ease, box-shadow 0.2s ease;
                        `;
                        freeSection.appendChild(p);
                    }
                    pipsContainer.appendChild(freeSection);
                }

                // Speed pips: CSS grid, 2 or 4 columns
                if (runPips > 0) {
                    const sRows = Math.ceil(runPips / sCols);
                    const speedGrid = document.createElement("div");
                    speedGrid.style.cssText = `
                        display: grid;
                        grid-template-columns: repeat(${sCols}, ${pipSize}px);
                        grid-template-rows: repeat(${sRows}, ${pipSize}px);
                        grid-auto-flow: column;
                        gap: ${pipGap}px;
                    `;
                    for (let i = 0; i < runPips; i++) {
                        const p = document.createElement("div");
                        const isUsed = i < speedUsed;
                        p.style.cssText = `
                            width: ${pipSize}px; height: ${pipSize}px;
                            border-radius: 3px;
                            background: ${isUsed ? IM_PIP_USED : baseBg};
                            box-shadow: ${isUsed ? "none" : baseShadow};
                            transition: background 0.2s ease, box-shadow 0.2s ease;
                        `;
                        speedGrid.appendChild(p);
                    }
                    pipsContainer.appendChild(speedGrid);
                }
            }
        }

        async _renderInner() {
            await super._renderInner();

            if (this._historyBaseline === null) {
                const history = this.token?.document?.movementHistory ?? [];
                this._historyBaseline = history.length;
            }

            const tierSelect = this.element.querySelector(".movement-tier-select");
            if (tierSelect) {
                const tierLabels = {
                    slow:   game.i18n.localize("ECHIM.Movement.TierSlow"),
                    normal: game.i18n.localize("ECHIM.Movement.TierNormal"),
                    fast:   game.i18n.localize("ECHIM.Movement.TierFast"),
                    swift:  game.i18n.localize("ECHIM.Movement.TierSwift"),
                };
                const currentTier = actorSpeedTier(this.actor);
                const labelEl = tierSelect.querySelector(".movement-tier-label");
                const optList = tierSelect.querySelector(".movement-tier-options");

                if (labelEl) labelEl.textContent = tierLabels[currentTier] ?? game.i18n.localize("ECHIM.Movement.TierNormal");

                if (optList) {
                    optList.innerHTML = "";
                    for (const [k, v] of Object.entries(tierLabels)) {
                        const li = document.createElement("li");
                        li.textContent = v;
                        li.dataset.tier = k;
                        if (k === currentTier) li.classList.add("active");
                        li.addEventListener("click", async (e) => {
                            e.stopPropagation();
                            tierSelect.classList.remove("open");
                            if (labelEl) labelEl.textContent = v;
                            optList.querySelectorAll("li").forEach(el => el.classList.remove("active"));
                            li.classList.add("active");
                            // Rebase _extraMovement so running state carries over to the new tier.
                            const wasRunning = this._extraMovement > 0;
                            await this.actor.update({ "system.combat.speed.land.value": k });
                            if (wasRunning) {
                                // Re-apply one run's worth of NEW tier
                                const newMax = getMovementMax(this.actor, this._movementMode);
                                this._extraMovement = newMax;
                            } else {
                                this._extraMovement = 0;
                            }
                            this.updateMovement();
                        });
                        optList.appendChild(li);
                    }
                }

                tierSelect.onclick = (e) => {
                    e.stopPropagation();
                    tierSelect.classList.toggle("open");
                };
                // Remove prior close-handler to prevent listener accumulation on re-render.
                if (this._tierCloseHandler) {
                    document.removeEventListener("click", this._tierCloseHandler);
                }
                this._tierCloseHandler = () => {
                    tierSelect.classList.remove("open");
                    this._tierCloseHandler = null;
                };
                document.addEventListener("click", this._tierCloseHandler, { once: true });
            }

            const toggleBtn = this.element.querySelector(".movement-mode-toggle");
            if (toggleBtn) {
                const updateToggle = () => {
                    const isZones = this._movementMode === "zones";
                    toggleBtn.setAttribute("data-tooltip", isZones
                        ? game.i18n.localize("ECHIM.Movement.ToMetres")
                        : game.i18n.localize("ECHIM.Movement.ToZones"));
                    toggleBtn.innerHTML = isZones
                        ? `<i class="fa-solid fa-map-pin"></i>`
                        : `<i class="fa-solid fa-ruler"></i>`;
                };
                updateToggle();
                toggleBtn.onclick = (e) => {
                    e.stopPropagation();
                    const wasZones = this._movementMode === "zones";
                    if (wasZones) {
                        this._extraMovement = this._extraMovement * 10;
                        this._movementMode = "metres";
                    } else {
                        this._extraMovement = Math.round(this._extraMovement / 10);
                        this._movementMode = "zones";
                    }
                    localStorage.setItem(MOVEMENT_MODE_KEY, this._movementMode);
                    updateToggle();
                    this.updateMovement();
                    ui.ARGON?.render();
                };
            }
        }
    };
}

