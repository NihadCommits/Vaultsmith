# Vaultsmith
https://community.obsidian.md/plugins/vaultsmith

[English](README.md) · **Deutsch**

Vaultsmith legt in [Obsidian](https://obsidian.md) strukturierte Notizen nach **deinen eigenen** Notiztypen an und bearbeitet sie. Ein Dialog, die passenden Felder für jeden Typ, sauberes YAML und eine kleine Statusleiste, mit der du eine Notiz von „zu schreiben“ bis „fertig“ weiterschaltest.

Typen, Felder und Wertelisten liegen als normale JSON-Dateien in deiner Vault. Vaultsmith liefert nur die Mechanik. Notizen, Templates und Konfiguration bleiben lesbar und funktionieren auch ohne das Plugin. Es arbeitet komplett offline: kein Netzwerkzugriff, kein Konto, keine Telemetrie, und es liest und schreibt nur Dateien in deiner Vault.

## Warum Vaultsmith

Eine Vault, die über Jahre wächst, franst aus. Dieselbe Property heißt mal `Status`, mal `status`, mal `stage`. Manche Notizen haben einen Status, die meisten nicht. `physics` steht neben `Physik` und `physic`, und die Person, die du als `[[Van Gogh]]` verlinkt hast, gibt es auch als `[[Vincent van Gogh]]`. Obsidians Properties erlauben alles. Das ist gut für die Freiheit und schlecht für eine Sammlung, die du später filtern und der du vertrauen willst.

Vaultsmith gibt jeder **Art von Notiz** eine feste Form: welche Felder sie hat, welche Werte erlaubt sind, in welchen Ordner sie kommt und welches Template sie bekommt. Du wählst die Art einmal, und der Dialog zeigt genau die Felder, die dazugehören, und sonst nichts. Später kannst du den Typ wechseln, den Status weiterschalten oder einen falschen Wert korrigieren, ohne das rohe YAML zu öffnen.

Der Gewinn: eine Vault, die du abfragen kannst. Mit Obsidians [Bases](https://help.obsidian.md/bases) bekommst du verlässliche Antworten auf „Was habe ich noch nicht fertig?“, „Zu welchen Gemälden von Van Gogh habe ich Notizen?“ oder „Welche veganen Rezepte gehen in unter 30 Minuten?“, weil jede Notiz einer Art gleich aufgebaut ist.

Entstanden ist Vaultsmith als Werkzeug für eine persönliche Wissenssammlung: Topics, Konzepte, Personen, Orte, Werke und Ereignisse, über Jahre gesammelt, um Dinge zu verstehen statt Artikel zu horten, mit Quellen und Verbindungen zwischen den Fachgebieten. Das Beispiel-Setup spiegelt das wider. Das Plugin selbst weiß davon nichts, deshalb funktioniert dieselbe Mechanik auch für ganz andere Vaults (siehe [Beispiele](#beispiele)).

### Passt es zu dir?

**Gut geeignet:** Vaults, in denen Notizen in **wiederkehrende Arten mit wiederkehrenden Fakten** fallen. Eine Wissenssammlung, Lese- und Recherche-Notizen, Rezepte und Zutaten, eine Sammlung (Platten, Pflanzen, Brettspiele), Worldbuilding für einen Roman oder eine Pen-&-Paper-Kampagne, Kundenprojekte.

**Weniger sinnvoll:** ein Tagebuch, Journaling, Gesprächsnotizen oder freie persönliche Notizen. Die haben keine feste Form, und Obsidians Core-Vorlagen decken sie schon ab. Du kannst trotzdem einen Typ dafür anlegen (z. B. einen Tagebucheintrag mit Stimmung und Datum), aber Vaultsmith bringt dort wenig.

## Was es kann

- **Ein Dialog für neue Notizen.** Du wählst den Typ Schritt für Schritt (z. B. *Entity › Work › Painting*), und es erscheinen nur die Felder dieses Typs. Ordner und Template passen sich dem Typ an.
- **Feste Wertelisten.** Felder wie *Domains* oder *Status* nutzen Kataloge mit stabilen IDs, lesbaren Labels und Aliassen. Wer `Physik` tippt, findet `physics`. Neue Werte entstehen nur bewusst, nie aus Versehen.
- **Links mit Suche.** Link-Felder durchsuchen Titel und Aliase deiner Notizen, beschränkt auf den passenden Typ (ein *Artist*-Feld schlägt nur Personen vor). Kein Treffer? Dann legst du direkt eine Stub-Notiz an, ohne den Dialog zu verlassen.
- **Eigenschaften später ändern.** Derselbe Dialog, schon ausgefüllt. Beim Typwechsel siehst du vorher, welche Felder wegfallen. Properties anderer Plugins (`tags`, `cssclasses`, …) bleiben unangetastet. Beim Umbenennen wird der alte Titel zum Alias.
- **Statusleiste.** `‹ ● Researching ›` unten im Fenster: Die Pfeile schalten eine Stufe vor oder zurück, ein Klick zeigt alle Stufen.
- **Katalog-Editor.** In den Einstellungen Werte anlegen, umbenennen, sortieren und einfärben. Eine geänderte ID wird in allen Notizen mitgeändert.
- **Prüfungen.** *Check configuration* erklärt kaputte Config-Dateien, *Check vault* findet Notizen mit unbekannten Werten oder Feldern, die nicht zu ihrem Typ passen.
- **Schutz vor Duplikaten.** Warnt, wenn Titel oder Alias schon existieren, und zeigt ähnliche Notizen.

## Installieren

Vaultsmith läuft nur am Desktop.

- **Community-Plugins:** nach „Vaultsmith“ suchen (sobald es dort gelistet ist).
- **BRAT (bis dahin):** Das Plugin [BRAT](https://github.com/TfTHacker/obsidian42-brat) installieren, *Add beta plugin* wählen und `NihadCommits/Vaultsmith` eingeben.
- **Von Hand:** `main.js`, `manifest.json` und `styles.css` aus dem [neuesten Release](https://github.com/NihadCommits/Vaultsmith/releases) nach `<deine Vault>/.obsidian/plugins/vaultsmith/` kopieren und das Plugin einschalten.

## Loslegen

Es gibt zwei Wege. Wer schon eine eigene Vault hat, nimmt meist den zweiten.

### A: Das Beispiel ausprobieren

1. **Vaultsmith: Install starter config** ausführen. Der Befehl legt `_Vaultsmith/` (21 Beispiel-Typen, 6 Kataloge), `Templates/` und `Worklist.base` an. Vorhandene Dateien werden nie überschrieben.
2. Wählen, ob auch die empfohlenen Ordner (siehe unten) angelegt werden sollen. Ohne sie entsteht ein Ordner, sobald die erste Notiz ihn braucht.
3. Auf das Icon in der linken Leiste klicken oder **Vaultsmith: New note** ausführen. `Worklist.base` zeigt ein Board mit allen Notizen nach Status.

### B: Eigene Konfiguration bauen

Deine Ordner und deine Sortierung bleiben, wie sie sind. Du beschreibst sie nur.

1. `_Vaultsmith/Schemas/` und `_Vaultsmith/Catalogs/` anlegen (oder die Starter-Config installieren und löschen, was du nicht brauchst).
2. Einen **Wurzel-Typ** anlegen, den alle Notizen teilen, hier mit einem Status:

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
3. **Eine Datei pro Typ**, den du nutzt, mit deinen eigenen Ordnern:

   `_Vaultsmith/Schemas/book.json`
   ```json
   {
     "id": "book",
     "label": "Book",
     "extends": "note",
     "defaultFolder": "Lesen/Bücher",
     "fields": [
       { "name": "author", "label": "Author", "type": "link", "target": "person" },
       { "name": "year", "label": "Year", "type": "number" }
     ]
   }
   ```
   `_Vaultsmith/Schemas/person.json`
   ```json
   { "id": "person", "label": "Person", "extends": "note", "defaultFolder": "Personen" }
   ```
4. Den **Katalog** für das Status-Feld anlegen:

   `_Vaultsmith/Catalogs/statuses.json`
   ```json
   {
     "id": "statuses",
     "label": "Status",
     "values": [
       { "id": "to_write", "label": "Zu schreiben" },
       { "id": "in_progress", "label": "In Arbeit", "color": "orange" },
       { "id": "done", "label": "Fertig", "color": "green" }
     ]
   }
   ```
5. **Vaultsmith: Check configuration** ausführen. Der Befehl nennt bei jedem Problem Datei und Grund.
6. Mit **New note** eine Notiz anlegen. Bestehenden Notizen gibst du mit **Edit properties** einen Typ, den Rest findet **Check vault**.

Tipps:

- Einen Untertyp nur anlegen, wenn er eigene Felder oder ein eigenes Template mitbringt. Sonst reicht ein Katalogwert (z. B. ein Genre).
- Lesbare IDs wählen: Obsidians Properties-Feld und Bases zeigen die gespeicherte ID, nicht das Label.
- Templates sind optional. Mit `"template": "Templates/Book.md"` bekommt ein Typ eine feste Gliederung.
- Katalogwerte lassen sich später unter *Einstellungen → Vaultsmith → Catalogs* pflegen, ohne JSON anzufassen.

## Beispiele

### 1. Der Starter: eine Wissenssammlung

Das richtet *Install starter config* ein. Ordner:

```text
10 Personal/       Events, People, Stories: dein eigenes Leben, getrennt vom allgemeinen Wissen
20 Knowledge/
  01 - Concepts & Topics/
    01 - Topics/
    02 - Concepts/
  02 - Entities/
  03 - Maps/
30 Projects/       aktive Recherche und Arbeit, verlinkt auf Wissensnotizen
40 Outputs/        Essays, Videos, fertige Arbeiten
90 Archive/        wird von Worklist.base ignoriert
Attachments/       Bilder, PDFs, Audio
Templates/
_Vaultsmith/
```

Damit `Attachments/` genutzt wird, stell in Obsidian *Einstellungen → Dateien & Links → Standardspeicherort für neue Anhänge* auf diesen Ordner. Vaultsmith ändert keine Obsidian-Einstellungen.

Typen (jede Zeile ist eine Datei in `_Vaultsmith/Schemas/`):

```text
common            domains, status, aliases, related          (Wurzel, jede Notiz hat diese Felder)
├── topic         größere Themen                             → 01 - Topics
│   └── medical_condition
├── concept       Ideen, Mechanismen                         → 02 - Concepts
│   ├── method
│   └── process
├── entity        konkret benennbare Dinge                   → 02 - Entities
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
└── map           Übersichtsnotizen                          → 03 - Maps
```

Ein Gemälde, `The Starry Night (1889).md`:

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

Die Titel sind englisch, Namen in anderen Sprachen kommen in `aliases`. So findest du die Notiz als „The Starry Night“ und als „Die Sternennacht“. Der Status läuft `to_write → researching → writing → needs_review → finished`.

### 2. Der Starter mit deinen eigenen Ordnern

Dir gefallen die Typen, aber deine Vault sieht anders aus, etwa mit `Wiki/` für Wissen und `Personen/` ganz oben. Dann änderst du die Ordner und sonst nichts:

```jsonc
// _Vaultsmith/Schemas/topic.json
"defaultFolder": "Wiki/Themen"
// _Vaultsmith/Schemas/concept.json
"defaultFolder": "Wiki/Konzepte"
// _Vaultsmith/Schemas/entity.json   (alle Entities erben das …)
"defaultFolder": "Wiki/Dinge"
// _Vaultsmith/Schemas/person.json   (… außer Personen, die bekommen ihren eigenen)
"defaultFolder": "Personen"
```

Danach kürzen und ergänzen:

- **Entfernen,** was du nicht brauchst, indem du die Dateien löschst, einen Typ zusammen mit seinen Untertypen (z. B. `organism.json`, `taxon.json`, `individual.json`). *Check configuration* sagt dir, wenn noch etwas auf einen gelöschten Typ zeigt.
- **Ergänzen,** was dir fehlt, mit einer neuen Datei, z. B. Bücher unter Werken:
  ```json
  { "id": "book", "label": "Book", "extends": "work", "fields": [{ "name": "author", "label": "Author", "type": "link", "target": "person" }] }
  ```
- **Umbenennen** kannst du Labels jederzeit. IDs lieber behalten, sie stehen in deinen Notizen (oder du benennst sie unter *Einstellungen → Vaultsmith → Catalogs* um, dann werden die Notizen mitgeändert).

### 3. Andere Setups

Im Ordner [`examples/`](examples) liegen drei komplette Setups. Um eins zu nutzen, kopierst du dessen `Schemas/` und `Catalogs/` in deinen `_Vaultsmith/`-Ordner und führst *Check configuration* aus. Die `defaultFolder`-Werte passt du an deine Ordner an. Templates sind optional und nicht dabei.

#### Lesen und Recherche ([`examples/reading`](examples/reading))

Für Quellen, die du liest oder schaust, die Menschen dahinter und die Exzerpte, die du dir machst.

```text
Library/
  Sources/      Bücher, Artikel, Videos
  People/       Autorinnen und Autoren
  Excerpts/     deine Notizen zu einem Teil einer Quelle
```

```text
entry        status (unread → reading → taking_notes → done), aliases, topics
├── source   authors, year, url, rating                → Library/Sources
│   ├── book       publisher, isbn
│   ├── article    journal, doi
│   └── video      channel, duration_minutes
├── person                                             → Library/People
└── excerpt  source (Pflicht), pages                   → Library/Excerpts
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

Ideen für Bases: alles mit `must_read`, das noch `unread` ist; alle Exzerpte zu einer Quelle; alle Quellen einer Person.

#### Küche: Rezepte und Zutaten ([`examples/kitchen`](examples/kitchen))

Für Rezepte, die du sammelst, und die Zutaten und Gewürze darin. Jede Zutat ist eine eigene Notiz, deshalb listen ihre Backlinks jedes Rezept, das sie verwendet.

```text
Kitchen/
  Recipes/
  Ingredients/  Gewürze, Gemüse, alles andere
```

```text
item           status (to_try → tried → favorite / skip), aliases
├── recipe     ingredients (Links), cuisine, diet, prep_minutes, servings, source   → Kitchen/Recipes
└── ingredient season                                                              → Kitchen/Ingredients
    ├── spice      heat
    ├── vegetable
    └── other_ingredient
```

`Chana masala.md` und `Cumin.md`:

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

Ideen für Bases: vegane Lieblingsrezepte unter 30 Minuten; Rezepte, die noch `to_try` sind; alle scharfen Gewürze.

#### Worldbuilding und Pen-&-Paper-Kampagnen ([`examples/worldbuilding`](examples/worldbuilding))

Für die Welt eines Romans oder eine Rollenspiel-Kampagne: Figuren, Orte, Fraktionen und die Sessions, in denen etwas passiert ist. Der Status zeigt hier nicht den Schreibstand, sondern ob etwas Kanon ist.

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
└── session    session_number (Pflicht), played_on, characters, places   → Campaign/Sessions
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

Ideen für Bases: alle Figuren einer Fraktion; jede Session, in der ein Ort vorkam; alles, was vor der nächsten Session noch `idea` oder `draft` ist.

#### Weitere Ideen

Dasselbe Muster (ein paar Arten, je ein paar Fakten, ein Status) passt in viele weitere Vaults:

- **Sammlungen:** Platten, Pflanzen, Brettspiele, mit Zustand, Standort und einem Wunschliste-Status.
- **Jobsuche:** Firmen und Bewerbungen (`applied → interview → offer / rejected`).
- **Sprachenlernen:** Wörter und Wendungen mit Genus, Niveau und einem „gelernt“-Status.
- **Kundenarbeit:** Kunden, Projekte und Lieferungen mit Fristen.

## Konfiguration

Alles liegt im Config-Ordner (Standard `_Vaultsmith`, in den Einstellungen änderbar).

### Typen: `Schemas/*.json`

Typen bilden einen Baum. Jeder Typ hat genau einen Elterntyp (`extends`) und erbt dessen Felder, Ordner und Template. Ein Elterntyp legt fest, in welcher Property der gewählte Untertyp landet (`subtypeField`). So entsteht `type → entity_type → work_type`, und deshalb erscheint ein Feld nur bei seinem Typ und dessen Untertypen.

| Key | Bedeutung |
|---|---|
| `id` | Eindeutig, snake_case. Wird als Wert ins `subtypeField` des Elterntyps geschrieben. |
| `label` | Anzeige im Dialog. |
| `extends` | Elterntyp. Genau ein Typ (die Wurzel) hat keinen. |
| `abstract` | `true`: nicht direkt wählbar, ein Untertyp ist Pflicht. |
| `subtypeField` | Property für den gewählten Untertyp. Nur bei Typen mit Untertypen. |
| `defaultFolder`, `template` | Wohin neue Notizen kommen und welches Template sie bekommen. Wird vererbt. |
| `fields` | Eigene Felder. Ein Feld mit gleichem `name` ersetzt das geerbte. |

Feldtypen:

| Typ | Gespeichert als | Optionen |
|---|---|---|
| `text` | Text | |
| `number` | Zahl (negativ = v. Chr.) | |
| `date` | `YYYY-MM-DD` | |
| `list` | Liste von Texten | |
| `choice` | Katalog-ID(s) | `catalog`, `multiple` |
| `link` | `"[[Notiz]]"` | `target` (ein Typ, inklusive Untertypen), `multiple` |

Jedes Feld kennt außerdem `required` und `default`. Ein Property-Name muss überall denselben Feldtyp haben, weil Obsidian Property-Typen für die ganze Vault festlegt.

### Wertelisten: `Catalogs/*.json`

Der Dateiname ist die Katalog-ID. Jeder Wert hat `id` und `label`, optional `aliases` (Suchbegriffe, z. B. in einer anderen Sprache), `description` und `color` (`red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `purple`, `pink`). Die Reihenfolge gilt für Dropdowns und für die Pfeile der Statusleiste.

### Templates

Normale Markdown-Dateien ohne Frontmatter (die Properties schreibt Vaultsmith). `{{title}}`, `{{date}}`, `{{time}}` und `{{date:FORMAT}}` funktionieren wie im Core-Plugin „Vorlagen“.

## Befehle

| Befehl | |
|---|---|
| New note | Öffnet den Dialog (auch über das Icon in der linken Leiste). |
| Edit properties | Für die aktive Notiz; auch im Rechtsklick-Menü. |
| Status: next stage / previous stage / set… | Wie die Statusleiste, mit Hotkey belegbar. |
| Install starter config | Legt die Beispiel-Typen, -Kataloge und -Templates an, auf Wunsch auch die Ordner. |
| Check configuration | Listet Fehler in den Config-Dateien. |
| Check vault | Listet Notizen, die nicht zur Konfiguration passen. |

## Selbst bauen

Braucht Node.js 18 oder neuer.

```bash
git clone https://github.com/NihadCommits/Vaultsmith.git
cd Vaultsmith
npm install
npm test
npm run build
```

`main.js`, `manifest.json` und `styles.css` nach `<deine Vault>/.obsidian/plugins/vaultsmith/` kopieren. Zum Entwickeln baut `npm run dev` bei jeder Änderung neu.

## Lizenz

[MIT](LICENSE)
