const THEME_BODY_CLASSES = ["ech-impmal-theme-classic"];

// IM theme palette
const IM_GREEN         = "rgba(66, 207, 125, 1.0)";     // solid green
const IM_GREEN_DIM     = "rgba(66, 207, 125, 0.55)";  // green border
const IM_GREEN_GLOW    = "rgba(66, 207, 125, 0.6)";   // green shadow
const IM_GREEN_GLOW_HI = "rgba(66, 207, 125, 0.8)";   // green shadow highlight
const IM_GREEN_HOVER   = "rgba(111, 255, 160, 1.0)";    // hover green
const IM_TEAL          = "rgba(6, 92, 99, 1.0)";        // solid teal border
const IM_TEAL_SHADOW   = "rgba(6, 92, 99, 0.8)";      // teal shadow
const IM_TEAL_TINT     = "rgba(6, 50, 40, 0.18)";     // button tint overlay
const IM_TEAL_HOVER    = "rgba(6, 50, 40, 0.92)";     // hover background
const IM_DARK_BG       = "rgba(6, 20, 25, 0.9)";      // dark panel background
const IM_PIP_USED      = "rgba(80, 80, 100, 0.3)";    // used movement pip
const IM_TEXT          = "rgba(200, 200, 200, 1.0)";    // body text (offwhite)
const IM_WHITE         = "rgba(255, 255, 255, 1.0)";    // pure white

const IM_THEME_VARS = {
    "--ech-font-family":                       '"Novarese", serif',
    "--im-green":                              IM_GREEN,
    "--im-green-dim":                          IM_GREEN_DIM,
    "--im-green-glow":                         IM_GREEN_GLOW,
    "--im-teal":                               IM_TEAL,
    "--ech-impmal-label-color":                IM_TEXT,
    "--ech-mainAction-base-background":        "rgba(6, 20, 25, 0.92)",
    "--ech-mainAction-base-border":            IM_GREEN,
    "--ech-mainAction-base-color":             IM_TEXT,
    "--ech-mainAction-background-color":       "rgba(6, 20, 25, 0.88)",
    "--ech-mainAction-hover-background":       "rgba(6, 50, 40, 0.92)",
    "--ech-mainAction-hover-border":           IM_GREEN_HOVER,
    "--ech-mainAction-hover-color":            IM_WHITE,
    "--ech-portrait-base-background":          "rgba(6, 20, 25, 0.85)",
    "--ech-portrait-base-border":              IM_TEAL,
    "--ech-portrait-base-color":               IM_TEXT,
    "--ech-abilityMenu-background":            "rgba(6, 20, 25, 0.96)",
    "--ech-abilityMenu-border":                IM_TEAL,
    "--ech-abilityMenu-color":                 IM_GREEN,
    "--ech-abilityMenu-base-color":            IM_GREEN,
    "--ech-abilityMenu-base-boxShadow":        IM_TEAL_SHADOW,
    "--ech-abilityMenu-hover-color":           IM_WHITE,
    "--ech-abilityMenu-hover-boxShadow":       IM_GREEN_GLOW_HI,
    "--ech-movement-baseMovement-background":  IM_GREEN,
    "--ech-movement-baseMovement-boxShadow":   IM_GREEN_GLOW,
    "--ech-tooltip-header-background":         IM_TEAL,
    "--ech-tooltip-header-color":              IM_WHITE,
    "--ech-tooltip-header-border":             IM_GREEN,
    "--ech-tooltip-body-background":           "rgba(6, 15, 18, 0.96)",
    "--ech-tooltip-body-color":                IM_TEXT,
    "--ech-tooltip-body-border":               IM_TEAL,
    "--ech-reaction-base-color":               IM_TEXT,
    "--ech-reaction-base-border":              IM_GREEN,
    "--ech-endTurn-base-color":                IM_TEXT,
    "--ech-endTurn-base-border":               IM_GREEN,
};

// Argon default CSS variable values, restored when switching back to Argon.
const ARGON_DEFAULT_VARS = {
    "--ech-font-family":                       '"Roboto", sans-serif',
    "--ech-mainAction-base-background":        "rgba(65, 75, 85, 0.90)",
    "--ech-mainAction-base-border":            "rgba(117, 127, 137, 1.0)",
    "--ech-mainAction-base-color":             "rgba(180, 210, 220, 1.0)",
    "--ech-mainAction-background-color":       "rgba(0, 0, 0, 0.30)",
    "--ech-mainAction-hover-background":       "rgba(191, 201, 211, 0.90)",
    "--ech-mainAction-hover-border":           "rgba(117, 127, 137, 1.0)",
    "--ech-mainAction-hover-color":            "rgba(180, 210, 220, 1.0)",
    "--ech-portrait-base-background":          "rgba(65, 75, 85, 0.90)",
    "--ech-portrait-base-border":              "rgba(117, 127, 137, 1.0)",
    "--ech-portrait-base-color":               "rgba(180, 210, 220, 1.0)",
    "--ech-abilityMenu-background":            "rgba(65, 75, 85, 0.90)",
    "--ech-abilityMenu-border":                "rgba(117, 127, 137, 1.0)",
    "--ech-abilityMenu-color":                 "rgba(180, 210, 220, 1.0)",
    "--ech-abilityMenu-base-color":            "rgba(180, 210, 220, 1.0)",
    "--ech-abilityMenu-base-boxShadow":        "rgba(117, 127, 137, 0.80)",
    "--ech-abilityMenu-hover-color":           "rgba(180, 210, 220, 1.0)",
    "--ech-abilityMenu-hover-boxShadow":       "rgba(117, 127, 137, 0.80)",
    "--ech-movement-baseMovement-background":  "rgba(90, 190, 245, 1.0)",
    "--ech-movement-baseMovement-boxShadow":   "rgba(110, 210, 255, 0.80)",
    "--ech-tooltip-header-background":         "rgba(255, 255, 255, 0.80)",
    "--ech-tooltip-header-color":              "rgba(65, 65, 70, 1.0)",
    "--ech-tooltip-header-border":             "rgba(117, 127, 137, 1.0)",
    "--ech-tooltip-body-background":           "rgba(90, 120, 150, 0.70)",
    "--ech-tooltip-body-color":                "rgba(255, 255, 255, 1.0)",
    "--ech-tooltip-body-border":               "rgba(117, 127, 137, 1.0)",
    "--ech-reaction-base-color":               "rgba(180, 210, 220, 1.0)",
    "--ech-reaction-base-border":              "rgba(117, 127, 137, 1.0)",
    "--ech-endTurn-base-color":                "rgba(180, 210, 220, 1.0)",
    "--ech-endTurn-base-border":               "rgba(117, 127, 137, 1.0)",
};

function applyThemeVars(vars) {
    for (const [prop, val] of Object.entries(vars))
        document.documentElement.style.setProperty(prop, val);
}

function _injectSVGFilters() {
    if (document.getElementById("im-svg-filters")) return;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "im-svg-filters";
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;";
    svg.innerHTML = `
        <defs>
            <filter id="im-icon-filter"
                    color-interpolation-filters="sRGB"
                    x="0%" y="0%" width="100%" height="100%">
                <feFlood flood-color="${IM_GREEN}" flood-opacity="1" result="greenFlood"/>
                <feComposite in="greenFlood" in2="SourceGraphic" operator="in"/>
            </filter>
        </defs>
    `;
    document.body.appendChild(svg);
}

function applyTheme(value) {
    _injectSVGFilters();
    document.body.classList.remove(...THEME_BODY_CLASSES);
    if (value === "im-classic") {
        document.body.classList.add("ech-impmal-theme-classic");
        applyThemeVars(IM_THEME_VARS);
    } else {
        applyThemeVars(ARGON_DEFAULT_VARS);
    }
    if (ui.ARGON?.rendered) ui.ARGON.render();
}

export {
    applyTheme,
    IM_GREEN, IM_GREEN_DIM, IM_DARK_BG, IM_PIP_USED, IM_TEAL_TINT, IM_WHITE,
};
