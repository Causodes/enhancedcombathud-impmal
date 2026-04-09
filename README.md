# Argon-ImpMal
An implementation of the [Argon - Combat HUD](https://foundryvtt.com/packages/enhancedcombathud) (by [TheRipper93](https://theripper93.com/) and [Mouse0270](https://github.com/mouse0270)) for the [Imperium Maledictum](https://foundryvtt.com/packages/impmal) system. The Argon Combat HUD (CORE) module is required for this module to work.

![image](https://github.com/user-attachments/assets/74189d60-0cda-4b50-9441-00fa9af27f8c)

![image](https://github.com/user-attachments/assets/10326f82-0b8f-4623-a7b1-9ce632c84d89)

<sup>All icons included in this project are from [Game-icons.net](game-icons.net), used under the [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) license.</sup>

### The documentation for the Core Argon features can be found [here](https://api.theripper93.com/modulewiki/enhancedcombathud/free).

This module adjust various Argon features for the Imperium Maledictum system:

- **Portrait**
    - The Fate Points are displayed and can be adjusted via left and right click.
    - The character sheet can be opened via right click.
- **Movement Tracking**
    - The module has a toggleable button to swap between zone-based and grid-based movement tracking
        - For zone-based movement tracking, the movement pips will be decremented once per move, irregardless of distance travelled by the token
        - For grid-based movement tracking, the movement pips are divided into two sections: *Base Movement* and *Free Movement*. 
            - *Free Movement* is consumed before *Base Movement* and is can be manually activated once per turn via a button on the Free Actions panel. This can be configured in module settings to automatically grant *Free Movement* every turn.
            - Actions that are non-movement based drain all remaining movement upon use, to simulate a single *Move Action*. This can be toggled off in module settings.
    - A speed selector is also included to account for various talents and conditions that adjust speed on the fly.
    - The *Run* action grants additional pips of movement depending on actor speed.
    - *Go Prone* decrements the actor speed step by 1; *Stand Up* and *Sure-Footed* increment the actor speed step by 1.
- **Characteristics / Skills**
    - Characteristics, skills, and specialisations are displayed, including advancement count via color for skills and specialisations. Characteristics that have their bonus increased from modifiers are also highlighted.
    - Tests can be directly triggered from this panel.
- **Weapons**
    - Weapon slots automatically account for handedness; the left slot is the off-hand, the right slot is the primary hand.
    - A *Thrown* toggle badge will be displayed on the weapon button for melee weapons with the *Thrown* trait. The badge shows **M** in melee mode and the remaining quantity in thrown mode.
        - When thrown, the weapon quantity is decremented automatically. If *Track Thrown Weapon Quantity* is enabled (default on), throws are tracked for the duration of combat and a prompt is offered at the end to restore the quantities (e.g. the party retrieves them after the fight).
        - If [Item Piles](https://github.com/fantasycalendar/FoundryVTT-ItemPiles) is loaded, an item pile of the thrown weapon is created at the targeted token's position (or the thrower's position if no target is selected).
    - The *Reload* and *Aim* buttons will only be rendered if the actor has a valid ranged weapon equipped in the active weapon set.
- **Tooltips** will display descriptions for all buttons and further details such as damage, range, area, traits, etc. for *Weapons* and *Powers*.
- **Powers**
    - A dedicated *Manifest* panel will be rendered if the actor has at least a single power.
    - This panel tracks up to two *Powers* which are manually set, *Warp Charges*, and *Sustained Powers*.
        - *Sustained Powers* can be unsustained via right clicking the element for each given power.
- **Talents**
    - The module will detect if the actor has certain talents that grant or modify existing actions and will adjust the hud accordingly.
        - For example, an actor with the *Slippery* talent taken twice will move the *Disengage* button from Defensive to Free Action.
        - Similarly, an actor with the *Hit and Run* talent will add an additional button to the Free Action section.

### Client Customization
- **Themes**: The module ships with two themes: *Argon Classic* and *Imperium Maledictum*.
- **Handedness**:  The ordering of primary hand and off-hand can be swapped.

### Languages:
- English

**If you have suggestions, questions, or requests for additional features please [open an issue and let me know](https://github.com/Causodes/enhancedcombathud-impmal/issues)!**