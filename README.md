# Vaultsmith

**English** · [Deutsch](README.de.md)

Vaultsmith creates and edits structured notes in [Obsidian](https://obsidian.md) from **your own** note types. One dialog, the right fields for each type, clean YAML, and a small status bar to move a note from "to write" to "finished".

Your types, fields and value lists live as plain JSON files in your vault. Vaultsmith only provides the mechanics, so your notes, templates and configuration stay readable and usable without it. It works fully offline: no network access, no account, no telemetry, and it only reads and writes files inside your vault.

## Why Vaultsmith

A vault that grows over years drifts. The same property is spelled three ways (`Status`, `status`, `stage`), some notes have a status and most don't, `physics` sits next to `Physik` and `physic`, and the person you linked as `[[Van Gogh]]` also exists as `[[Vincent van Gogh]]`. Obsidian's Properties allow anything, which is great for freedom and bad for a collection you want to filter and trust later.

Vaultsmith gives every **kind of note** a fixed shape: which fields it has, which values are allowed, which folder and template it gets. You choose the kind once; the dialog shows exactly the fields that belong to it, and nothing else. Later you can change the type, step the status forward, or fix a wrong value without opening the raw YAML.

The payoff is a vault you can query. With Obsidian's [Bases](https://help.obsidian.md/bases) you get reliable answers to "what haven't I finished?", "which paintings by Van Gogh do I have notes on?" or "which vegan recipes take under 30 minutes?", because every note of a kind looks the same.

Vaultsmith started as the tool for a personal knowledge base: topics, concepts, people, places, works and events, collected over years to understand things rather than to hoard articles, with sources and links between disciplines. The example setup reflects that. The plugin itself knows nothing about it, so the same mechanics work for very different vaults (see [Examples](#examples)).

### Is it for you?

**Good fit:** vaults where notes fall into **recurring kinds with recurring facts**. A knowledge base, reading and research notes, recipes and ingredients, a collection (records, plants, board games), worldbuilding for a novel or a tabletop campaign, client projects.

**Less useful:** a diary, journaling, meeting scribbles or free-form personal notes. These have no fixed shape, and Obsidian's core Templates already cover them. You can still define a type for them (e.g. a journal entry with mood and date), but Vaultsmith adds little there.

## What it does

- **One dialog for new notes.** Pick a type step by step (e.g. *Entity › Work › Painting*); only the fields of that type appear. Folder and template follow the type.
- **Controlled values.** Fields like *Domains* or *Status* use catalogs with stable IDs, readable labels and aliases. Typing `Physik` finds `physics`. New values are created on purpose, never by accident.
- **Links with search.** Link fields search the titles and aliases of your notes, limited to the right type (an *Artist* field only suggests people). No match? Create a stub note without leaving the dialog.
- **Edit properties later.** The same dialog, prefilled. Changing the type shows which fields will be removed. Properties of other plugins (`tags`, `cssclasses`, …) are never touched. Renaming keeps the old title as alias.
- **Status bar.** `‹ ● Researching ›` at the bottom of the window: arrows step through the stages, a click opens the full list.
- **Catalog editor.** Add, rename, reorder and recolor values in the settings. Renaming an ID updates every note that uses it.
- **Checks.** *Check configuration* explains broken config files; *Check vault* finds notes with unknown values or fields that don't belong to their type.
- **Duplicate protection.** Warns when a title or alias already exists, and suggests similar notes.

## Install

Vaultsmith is desktop only.

- **Community plugins:** search for "Vaultsmith" (once it is listed).
- **BRAT (before that):** install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin, choose *Add beta plugin* and enter `NihadCommits/Vaultsmith`.
- **Manual:** download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/NihadCommits/Vaultsmith/releases) into `<your vault>/.obsidian/plugins/vaultsmith/`, then enable the plugin.

## Get started

There are two ways in. Most people with an existing vault will want the second one.

### A: Try the example setup

1. Run **Vaultsmith: Install starter config**. It adds `_Vaultsmith/` (21 example types, 6 catalogs), `Templates/` and `Worklist.base`. Existing files are never overwritten.
2. Choose whether to also create the recommended folders (below). Without them, folders are created with the first note that needs them.
3. Click the ribbon icon or run **Vaultsmith: New note**. Open `Worklist.base` for a board of all notes by status.

### B: Build your own setup

Your folders and your way of sorting stay as they are. You only describe them.

1. Create `_Vaultsmith/Schemas/` and `_Vaultsmith/Catalogs/` (or install the starter config and delete what you don't need).
2. Add a **root type** that every note shares, here with a status:

   `_Vaultsmith/Schemas/note.json`
   ```json
   {
     "id": "note",
     "label": "Note",
     "abstract": true,
     "subtypeField": "type",
     "fields": [{ "name": "status", "label": "Status", "type": "choice", "catalog": "statuses", "default": "to_write" }]
   }
   ```
3. Add **one file per type** you use, pointing to your own folders:

   `_Vaultsmith/Schemas/book.json`
   ```json
   {
     "id": "book",
     "label": "Book",
     "extends": "note",
     "defaultFolder": "Reading/Books",
     "fields": [
       { "name": "author", "label": "Author", "type": "link", "target": "person" },
       { "name": "year", "label": "Year", "type": "number" }
     ]
   }
   ```
   `_Vaultsmith/Schemas/person.json`
   ```json
   { "id": "person", "label": "Person", "extends": "note", "defaultFolder": "People" }
   ```
4. Add the **catalog** the status field uses:

   `_Vaultsmith/Catalogs/statuses.json`
   ```json
   {
     "id": "statuses",
     "label": "Status",
     "values": [
       { "id": "to_write", "label": "To write" },
       { "id": "in_progress", "label": "In progress", "color": "orange" },
       { "id": "done", "label": "Done", "color": "green" }
     ]
   }
   ```
5. Run **Vaultsmith: Check configuration**. It names the file and the reason for every problem.
6. Create a note with **New note**. For notes you already have, use **Edit properties** to give them a type, and **Check vault** to find the rest.

Tips:

- Add a subtype only when it brings its own fields or template. Otherwise a catalog value (e.g. a genre) is enough.
- Pick IDs you can read: Obsidian's Properties panel and Bases show the stored ID, not the label.
- Templates are optional. Add `"template": "Templates/Book.md"` to a type when you want a fixed outline.
- Catalog values can be managed later in *Settings → Vaultsmith → Catalogs*, without editing JSON.

## Examples

### 1. The starter: a knowledge base

What *Install starter config* sets up. Folders:

```text
10 Personal/       Events, People, Stories: your own life, kept apart from general knowledge
20 Knowledge/
  01 - Concepts & Topics/
    01 - Topics/
    02 - Concepts/
  02 - Entities/
  03 - Maps/
30 Projects/       active research and work, linking to knowledge notes
40 Outputs/        essays, videos, finished work
90 Archive/        ignored by Worklist.base
Attachments/       images, PDFs, audio
Templates/
_Vaultsmith/
```

For `Attachments/` to be used, set Obsidian's *Settings → Files and links → Default location for new attachments* to that folder. Vaultsmith does not change Obsidian settings.

Types (each line is one file in `_Vaultsmith/Schemas/`):

```text
common            domains, status, aliases, related          (root, every note has these)
├── topic         larger subjects                            → 01 - Topics
│   └── medical_condition
├── concept       ideas, mechanisms                          → 02 - Concepts
│   ├── method
│   └── process
├── entity        identifiable things                        → 02 - Entities
│   ├── person    birth_date, death_date, occupations
│   ├── place
│   │   └── country     country_code, continent
│   ├── work
│   │   └── painting    artist, creation_year, art_movement, medium, …
│   ├── event     start_year, end_year
│   │   └── war
│   ├── organism
│   │   ├── taxon       scientific_name, taxonomic_rank
│   │   └── individual
│   └── group, object, system
└── map           overview notes                             → 03 - Maps
```

A painting, `The Starry Night (1889).md`:

```yaml
---
type: entity
entity_type: work
work_type: painting
domains:
  - arts
  - art_history
status: to_write
aliases:
  - Die Sternennacht
artist: "[[Vincent van Gogh]]"
creation_year: 1889
art_movement: "[[Post-Impressionism]]"
medium: oil_on_canvas
current_location: "[[Museum of Modern Art]]"
---
```

Titles are English, names in other languages go into `aliases`, so the note is found both as "The Starry Night" and as "Die Sternennacht". The status runs `to_write → researching → writing → needs_review → finished`.

### 2. The starter with your own folders

You like the types, but your vault looks different, say `Wiki/` for knowledge and `People/` at the top. Change the folders, nothing else:

```jsonc
// _Vaultsmith/Schemas/topic.json
"defaultFolder": "Wiki/Topics"
// _Vaultsmith/Schemas/concept.json
"defaultFolder": "Wiki/Concepts"
// _Vaultsmith/Schemas/entity.json   (all entities inherit it…)
"defaultFolder": "Wiki/Things"
// _Vaultsmith/Schemas/person.json   (…except people, who get their own)
"defaultFolder": "People"
```

Then trim and extend:

- **Remove** what you don't need by deleting the files, a type together with its subtypes (e.g. `organism.json`, `taxon.json`, `individual.json`). *Check configuration* tells you if something still points to a deleted type.
- **Add** what you miss with a new file, e.g. books under works:
  ```json
  { "id": "book", "label": "Book", "extends": "work", "fields": [{ "name": "author", "label": "Author", "type": "link", "target": "person" }] }
  ```
- **Rename** labels freely. Keep IDs, they are stored in your notes (or rename them in *Settings → Vaultsmith → Catalogs*, which updates the notes too).

### 3. Other setups

The [`examples/`](examples) folder has three complete setups. To use one, copy its `Schemas/` and `Catalogs/` into your `_Vaultsmith/` folder and run *Check configuration*. Change the `defaultFolder` values to your folders. Templates are optional and not included.

#### Reading and research ([`examples/reading`](examples/reading))

For sources you read or watch, the people behind them and the excerpts you take.

```text
Library/
  Sources/      books, articles, videos
  People/       authors
  Excerpts/     your notes on a part of a source
```

```text
entry        status (unread → reading → taking_notes → done), aliases, topics
├── source   authors, year, url, rating                → Library/Sources
│   ├── book       publisher, isbn
│   ├── article    journal, doi
│   └── video      channel, duration_minutes
├── person                                             → Library/People
└── excerpt  source (required), pages                  → Library/Excerpts
```

`Thinking, Fast and Slow.md`:

```yaml
---
type: source
source_type: book
status: taking_notes
aliases:
  - Schnelles Denken, langsames Denken
topics:
  - "[[Cognitive biases]]"
authors:
  - "[[Daniel Kahneman]]"
year: 2011
rating: must_read
---
```

Ideas for Bases: everything rated `must_read` that is still `unread`; all excerpts of one source; all sources of one author.

#### Kitchen: recipes and ingredients ([`examples/kitchen`](examples/kitchen))

For recipes you collect and the ingredients and spices they use. Each ingredient is a note, so its backlinks list every recipe that uses it.

```text
Kitchen/
  Recipes/
  Ingredients/  spices, vegetables, everything else
```

```text
item           status (to_try → tried → favorite / skip), aliases
├── recipe     ingredients (links), cuisine, diet, prep_minutes, servings, source   → Kitchen/Recipes
└── ingredient season                                                              → Kitchen/Ingredients
    ├── spice      heat
    ├── vegetable
    └── other_ingredient
```

`Chana masala.md` and `Cumin.md`:

```yaml
---
type: recipe
status: favorite
ingredients:
  - "[[Chickpeas]]"
  - "[[Cumin]]"
  - "[[Garam masala]]"
cuisine: indian
diet:
  - vegetarian
  - vegan
prep_minutes: 40
servings: 4
---
```

```yaml
---
type: ingredient
ingredient_type: spice
status: tried
aliases:
  - Kreuzkümmel
heat: medium
---
```

Ideas for Bases: vegan favorites under 30 minutes; recipes still `to_try`; every hot spice.

#### Worldbuilding and tabletop campaigns ([`examples/worldbuilding`](examples/worldbuilding))

For a novel's world or a role-playing campaign: characters, places, factions and the sessions where things happened. The status here is not about writing but about canon.

```text
World/
  Characters/
  Places/
  Factions/
Campaign/
  Sessions/
```

```text
entry          canon (idea → draft → canon / retconned), aliases, related
├── character  role, faction, home                          → World/Characters
├── place      region                                       → World/Places
│   ├── city       population
│   └── dungeon    danger
├── faction    leader                                       → World/Factions
└── session    session_number (required), played_on, characters, places   → Campaign/Sessions
```

`Session 12.md`:

```yaml
---
type: session
canon: canon
session_number: 12
played_on: 2026-11-20
characters:
  - "[[Mira Ashvale]]"
  - "[[Brother Oren]]"
places:
  - "[[Port Kessa]]"
---
```

Ideas for Bases: all characters of a faction; every session a place appeared in; everything still `idea` or `draft` before the next session.

#### More ideas

The same pattern (a few kinds, a few facts each, a status) fits many more vaults:

- **Collections:** records, plants, board games, with condition, location and a wishlist status.
- **Job search:** companies and applications (`applied → interview → offer / rejected`).
- **Language learning:** words and phrases with gender, level and a "learned" status.
- **Client work:** clients, projects and deliverables with deadlines.

## Configuration

Everything lives in the config folder (default `_Vaultsmith`, changeable in the settings).

### Types: `Schemas/*.json`

Types form a tree. Each type has exactly one parent (`extends`) and inherits its fields, folder and template. A parent names the property that stores which subtype was chosen (`subtypeField`). That's how `type → entity_type → work_type` is written, and why a field only appears for its own type and its subtypes.

| Key | Meaning |
|---|---|
| `id` | Unique, snake_case. Written as value of the parent's `subtypeField`. |
| `label` | Shown in the dialog. |
| `extends` | Parent type. Exactly one type (the root) has none. |
| `abstract` | `true`: can't be picked directly, a subtype is required. |
| `subtypeField` | Property that stores the chosen subtype. Only on types with subtypes. |
| `defaultFolder`, `template` | Where new notes go and which template they get. Inherited. |
| `fields` | Own fields. A field with the same `name` replaces the inherited one. |

Field types:

| Type | Stored as | Options |
|---|---|---|
| `text` | text | |
| `number` | number (negative = BC) | |
| `date` | `YYYY-MM-DD` | |
| `list` | list of texts | |
| `choice` | catalog ID(s) | `catalog`, `multiple` |
| `link` | `"[[Note]]"` | `target` (a type, includes its subtypes), `multiple` |

Every field also takes `required` and `default`. A property name must have the same field type everywhere, because Obsidian property types apply to the whole vault.

### Value lists: `Catalogs/*.json`

The file name is the catalog ID. Each value has `id` and `label`, optionally `aliases` (search terms, e.g. another language), `description` and `color` (`red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `purple`, `pink`). The order is used in dropdowns and by the status bar arrows.

### Templates

Plain Markdown files without frontmatter (Vaultsmith writes the properties). `{{title}}`, `{{date}}`, `{{time}}` and `{{date:FORMAT}}` work as in Obsidian's core Templates plugin.

## Commands

| Command | |
|---|---|
| New note | Opens the dialog (also the ribbon icon). |
| Edit properties | For the active note; also in the file menu. |
| Status: next stage / previous stage / set… | Same as the status bar, assignable to hotkeys. |
| Install starter config | Adds the example types, catalogs and templates, optionally the folders. |
| Check configuration | Lists errors in the config files. |
| Check vault | Lists notes that don't match the configuration. |

## Build it yourself

Requires Node.js 18 or newer.

```bash
git clone https://github.com/NihadCommits/Vaultsmith.git
cd Vaultsmith
npm install
npm test
npm run build
```

Copy `main.js`, `manifest.json` and `styles.css` to `<your vault>/.obsidian/plugins/vaultsmith/`. For development, `npm run dev` rebuilds on every change.

## License

[MIT](LICENSE)
