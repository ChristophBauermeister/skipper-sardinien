# Changelog v2 (gegenüber v1)

Bezug: Befunde SPEC §8.

- **Cannigione**: Sektoren waren invertiert. Jetzt Landschutz W/NW, exponiert gegen E/NE/SE; Badge "ungeprüft".
- **Orosei-Gate**: wirkt jetzt ab Posada/Tavolara/Olbia/Figari (oder GPS lat 40,30–40,95), nicht nur im Golf; Kinder-Schwelle 15 kn; Dünung als Auslöser.
- **Reff-Lücken (20–23 / 25–28)** geschlossen: 18/23/28 kn, jede ganze Zahl liefert genau eine Stufe (getestet 0–60).
- **Kinderregel** implementiert: alle Schwellen −3 kn (Reff, Ampel, Orosei); Standard "an".
- **Text/Code-Widerspruch "Grün <20" vs. 18**: Regeln-Screen wird aus denselben Konstanten wie die Logik erzeugt.
- **Wahrer vs. scheinbarer Wind**: Reff nach scheinbarem Wind (Böen × Kursfaktor, aufgerundet), Hafen/Ampel nach wahren Böen.
- **Allwetter immer grün** entfernt: Allwetterhafen ab 35 kn Böen gelb; Schwell kann rot machen.
- **Dünung** eingeführt (Richtung + Höhe) in Ampel, Gates und Hafenstatus.
- **Bonifacio-Gate** gilt für W/NW (Mistral) und E/SE (Levante), mit effektivem Böenbereich (+10–15 kn).
- **Porto Corallo→Arbatax**: 12 sm war falsch; jetzt Haversine aus Koordinaten (~30 sm).
- **Distanzen** pauschal -> aus Position berechnet (GPS, manuell oder Abschnitt), mit rwK und Mindestfahrzeit.
- **Cala Gavetta**: Südseite von La Maddalena (nicht "Westufer").
- **Cala Moresca**: unplausible v1-Sektoren entfernt; "Schutz unbekannt – keine Zuflucht".
- **Arbatax**: VHF 9 statt 16, Tel. ergänzt. **S. M. Navarrese** neu (Schutz unbekannt).
- **"Verkehrsverbot Caténa"** entfernt (keine Quelle).
- **Cala Zafferano / Porto Scudo** nicht mehr Zuflucht, nur Warnung im Abschnitt Teulada.
- **"Offline-fähig"**: Service Worker (sw.js) + Manifest, Registrierung nur über http/https, Fehler still; Status-Text ehrlich.
- **NAVTEX** (518 kHz R 06:50/18:50 UTC, 490 kHz I), UTC->Ortszeit automatisch (CEST/CET).
- **Notfall**: DSC-Distress, 112 mit Reichweitenhinweis, 118, MAYDAY-Schema mit Feldern, Positionsanzeige in Grad/Dezimalminuten, PAN PAN, CROSS MED, MRCC Rom.
- **Ungeprüft-Kennzeichnung** je Lage/Schutz/VHF/Tel; Datenstand-Badge; Tiefgang-Angabe Bonifacio entfernt.
- **PDF**: eine Datenquelle (Print-Stylesheet), keine verwaisten Gruppenköpfe, jeder Platz genau einmal, Notfall + Funk auf Seite 1.
- Neu: Nachtmodus (rot auf schwarz), `prefers-color-scheme`, Kompassrosen, Zuflucht-Ausweichliste mit Filter.
