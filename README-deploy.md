# SRS Workbench — deployment notes

The SRS Workbench is the web edition of the SRS Development Framework calculator (Practitioner Manual, version 1.5). It is a static site: one HTML page, one stylesheet and nine scripts, with no server-side component. Out of the box it makes no network calls apart from the Google Fonts stylesheet (the page falls back to system fonts when that host is unreachable) and the Firebase scripts, which stay idle until a project is configured; see `README-firebase.md` in the Firebase package for the shared-workspace mode.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The page shell. |
| `styles.css` | Visual design, light and dark themes, phone layout. |
| `srs-data.js` | The default indicator library (70 indicators with definitions and basis notes), the parameter card (level bands, stage thresholds on the gap, coverage and weight-cap rules, readiness multipliers, the thirteen check parameters, the nine lag profiles, the count each ratio indicator divides by) and the Westhaven Region demonstration territory (8 units with their counts and flood-capacity flags, 13 options, bundles A–D, and from version 1.5 the four systems already in operation and the coupling table). Generated from the Python calculator by `tools/export_data.py`. |
| `srs-calc.js` | The calculator, manual version 1.5: Tier 1 rating (balanced performance index B on sustainability and resilience, the balance stage read from the gap between the outcomes, coordination degree D, smartness as a capability score, ratio indicators derived from register counts with coverage and approximate flags, weight caps enforced), Tier 2 appraisal (readiness applied per digital option, offsets lifted as delivered, lock-in by design class), the ranking rule on the outcomes and weights, and from version 1.4 the city's goals with the SDG crosswalk, the alignment chain (project record, programme, portfolio, city), the value library and the money view, and from version 1.5 effective smartness (alignment under the capability crosswalk, the two-layer yield of the digital records in the planned and in-operation stances, the catalytic ratio) and the coupling premium that replaces the IC6 multiplier. A verified port of `srs_calc.py`, `srs_chain.py` and `srs_smart.py`. |
| `app-core.js` | State, routing (the menu: the framework screens first, the work screens folded under data entry), formatting, charts. |
| `app-demo.js` | The framework screens for demonstration (version 1.5, October 2026): the Dashboard (the rating, the balance plane, the plan at a glance), Rate the territory, Appraise investments, Deliver at every level, Effective smartness and the Balance plane; chart-first and read-only, each panel naming the work screen it is computed from. |
| `app-screens.js` | The work screens of the roles: the work-screens overview, Sponsor brief, Configuration and sign-off (assessment lead), Register and values (data steward), Dimension detail, Project records and bundles (appraiser), Indicators Library (the former Reference screen), About, Account and team. |
| `app-levels.js` | Version 1.4: the Project manager, Programme manager, Portfolio manager and City expectations pages; from version 1.5 each carries an effective-smartness card. |
| `app-smart.js` | Version 1.5: the Effective smartness page (alignment, the readings in operation and planned at every unit, the programmes, portfolio and records, the four bundles, the coupling table and premium, the operating register, the capability crosswalk). |
| `cloud.js`, `firebase-config.js` | Optional sign-in, shared workspace, roles and audit log (Firebase). Inactive while `firebase-config.js` holds `null`. |
| `tools/verify.js` | Node script that checks `srs-calc.js` against `tools/reference.json`, the Python outputs for Westhaven (baseline of all eight units, roll-ups, bundles A–D, every single option, the mature-readiness run, the year profile of bundle D, the ranking, a weighted configuration and, from version 1.5, the effective-smartness readings at every unit, for the programmes, the portfolio and the bundles, and the run with the premium switched off). |

## Hosting

Copy the folder to any static host (an internal web server, S3 or Azure Blob static hosting, GitHub Pages, Netlify, an intranet share) and open `index.html`. No build step is needed. The page also opens directly from disk (`file://`), which is enough for a training laptop.

Routes are hash fragments: the framework screens `#home`, `#rating`, `#appraisal`, `#levels`, `#smart`, `#plane`; the work screens `#roles`, `#data`, `#lead`, `#appraiser`, `#project`, `#programme`, `#portfolio`, `#city`, `#smartness`, `#sponsor`, `#dimension`; and `#reference`, `#about`, `#account`. No server rewrite rules are required.

## Data and privacy

In local mode, edits made in the workbench (indicator values, grades, sources, counts, flood capacity, custom options, saved bundles, configuration settings, weights, and from 1.4 the goals, programmes, the portfolio record, the envelope and the value library, and from 1.5 the operating register and the coupling table) are stored in the viewer's browser only (local storage under the key `srs-workbench-state-v1.5`; a state saved by version 1.4 is upgraded on first load). Nothing is transmitted. To move a territory between people, download or copy the territory file on the Assessment lead or Data steward screen and open or paste it on the other side; option libraries are exchanged the same way from the Project appraiser screen (download, copy, merge or replace). *Reset to Westhaven* restores the demonstration data. In cloud mode the workspace is held in your own Firebase project; see `README-firebase.md`.

## Replacing the demonstration territory

Edit `srs-data.js`, or regenerate it. The structure is:

```
window.SRS_DATA = {
  territory: { id, name, configuration_version, reference_year },
  dims, subdims, indicators[ {code, sub, name, ref, unit, floor, target, grade, levels, agg, text{...}} ],
  level_bands, stages, defaults, lag_profiles, check_params,
  den_basis{ code: {key, fallback, exact_fallback} }, full_effect_year,
  units[ {id, name, level, parent, population, area, dwellings, elderly_share, hard_flood_capacity, denominators{ count_name: count }, values{ code: {value, year, dq, source} }} ],
  options[ {id, name, unit, tags[], lag_class, capex_m, opex_m, flags..., effects[ {unit, code, set|delta|reduce_by} ]} ],
  stock[ {id, name, unit, tags[], lag_class, status: 'complete', completion, capex_m, opex_m, effects[ {unit, code, delta} | {unit, code, set, before} ]} ],
  bundles{ id: {name, options[]} }, readiness
}
```

Only measured values are listed under `values`; derived and inherited values are computed on load. A unit's `parent` must name another unit's `id`; the root has `parent: null`.

## Verifying the calculator

```
cd tools
node verify.js
```

The script prints the number of checks and failures. With the supplied data it runs 4,884 numeric comparisons at a tolerance of 1e-9 and reports no failures; the remaining differences are in the wording of a few rounding ties in the explanatory notes.

## Browser support

Current versions of Chrome, Edge, Firefox and Safari, on desktop and mobile. The page needs JavaScript; without it nothing renders.
