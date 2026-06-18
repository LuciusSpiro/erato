// Produktbeschreibung / Erste-Schritte-Doku, die ausgeloggten Besuchern als
// Willkommensseite gezeigt wird (siehe components/Welcome.jsx). Inhalt ist
// Markdown (kanonisch) und wird read-only über TipTapView gerendert.
// `appName` wird zur Laufzeit aus dem Branding eingesetzt.
export function welcomeDoc(appName = 'Erato') {
  return `# Willkommen bei ${appName}

**${appName} ist dein selbst-gehostetes Wissens- und Notiz-System** – wie Confluence
oder OneNote, aber unter deiner Kontrolle und mit eingebautem KI-Assistenten. Schreibe
in einem komfortablen Editor, organisiere alles in Notizbüchern, finde es per Volltext-
**und** semantischer Suche wieder und lass dir von der KI Fragen zu deinen Inhalten
beantworten.

> Melde dich oben rechts über **Login** an, um eigene Notizbücher und Seiten anzulegen.
> Diese Seite ist die öffentliche Produkt-Übersicht für nicht angemeldete Besucher.

## Was kann ${appName}?

- **Notizbücher & verschachtelte Seiten** – gruppiere Inhalte in Notizbüchern; Seiten
  lassen sich beliebig tief in Unterseiten gliedern (z.B. *Projekt → Architektur → Datenbank*).
- **Rich-Editor mit Markdown** – schreibe wie in einem Textverarbeitungsprogramm
  (WYSIWYG) oder direkt in Markdown. Beides bearbeitet denselben Inhalt.
- **Volltext- + semantische Suche** – finde Seiten nach Stichwort *oder* nach Bedeutung.
- **KI-Assistent (RAG)** – stelle Fragen in natürlicher Sprache; die Antwort stützt sich
  auf deine eigenen Seiten und verlinkt die Quellen.
- **Versionsverlauf** – jede Seite wird versioniert; frühere Stände lassen sich ansehen
  und wiederherstellen.
- **Favoriten** – markiere wichtige Seiten für den schnellen Zugriff.
- **Import & Export** – Inhalte als Markdown ein- und ausspielen, einzelne Seiten oder
  ganze Notizbücher.
- **White-Label** – Name, Akzentfarbe und Logo lassen sich an deine Marke anpassen.

## In 3 Schritten loslegen

1. **Anmelden** – Klick oben rechts auf **Login**.
2. **Notizbuch anlegen** – in der linken Seitenleiste auf *„Neues Notizbuch"*. Gib ihm
   einen Namen und ein Symbol (z.B. 📘 *Handbuch*).
3. **Erste Seite schreiben** – wähle das Notizbuch und lege eine Seite an. Vergib oben
   einen Titel und beginne darunter zu schreiben. **Alles wird automatisch gespeichert.**

## Der Editor – mit Beispielen

Du musst kein Markdown können – tippe einfach los. Wer mag, nutzt diese Kürzel:

| Tippe… | …und es wird |
|---|---|
| \`# Titel\` | Überschrift 1 |
| \`## Abschnitt\` | Überschrift 2 |
| \`- Eintrag\` | Aufzählung |
| \`1. Eintrag\` | Nummerierte Liste |
| \`> Zitat\` | Zitatblock |
| \`**fett**\` / \`*kursiv*\` | **fett** / *kursiv* |
| Text in Backticks | \`Inline-Code\` |

### Das Slash-Menü

Tippe einen Schrägstrich **\`/\`** an einer leeren Stelle, um schnell Blöcke einzufügen –
z.B. Überschrift, Tabelle, Code-Block, Aufgabenliste oder einen **Link zu einer anderen
Seite**.

### Aufgabenlisten

- [x] Erato installiert
- [x] Erstes Notizbuch angelegt
- [ ] Team eingeladen

### Code-Blöcke

\`\`\`js
// Syntax bleibt erhalten – ideal für technische Doku
function hallo(name) {
  return \`Hallo, \${name}!\`
}
\`\`\`

### Seiten verlinken

Über das Slash-Menü (*„Link zu Seite"*) verknüpfst du Seiten miteinander. Ein Klick auf
den Link springt direkt zur Zielseite – so entsteht ein vernetztes Wiki.

## Suchen & Finden

Drücke **\`Strg/Cmd + K\`** (oder klick auf **Suche**), um die Suche überall zu öffnen.
${appName} kombiniert dabei zwei Verfahren:

- **Volltext** – exakte Treffer für Stichwörter.
- **Semantisch** – Treffer nach *Bedeutung*, auch wenn andere Wörter verwendet wurden
  (z.B. findet *„Anmeldung fehlgeschlagen"* auch Seiten über *„Login-Fehler"*).

## KI-Assistent

Öffne das **KI-Panel** und stelle eine Frage in normaler Sprache – etwa
*„Wie richte ich die Datenbank ein?"*. Die KI durchsucht deine Seiten, formuliert eine
Antwort **und verlinkt die Quellseiten**, damit du nachschlagen kannst.

> Der KI-Assistent und die semantische Suche erscheinen nur, wenn ein KI-Dienst
> verfügbar ist. Ist keiner eingerichtet, funktioniert die Volltextsuche ganz normal
> weiter – die KI-Funktionen werden einfach ausgeblendet.

## Nützliche Tastenkürzel

| Kürzel | Funktion |
|---|---|
| \`Strg/Cmd + K\` | Suche öffnen/schließen |
| \`/\` | Slash-Menü im Editor |
| \`Esc\` | Suche schließen |

---

**Bereit?** Melde dich oben rechts an und leg dein erstes Notizbuch an. Viel Spaß mit ${appName}! ✨
`
}
