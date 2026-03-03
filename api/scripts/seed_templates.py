"""Seed pre-built RoutineTemplate records into the database.

Usage (from the /api directory):
    python -m scripts.seed_templates
    # or
    python scripts/seed_templates.py
"""

import asyncio
import sys
from pathlib import Path

# Ensure the api package root is on the path when run directly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import func, select

from models.database import async_session, engine
from models.routine import RoutineTemplate


# ---------------------------------------------------------------------------
# Template definitions
# ---------------------------------------------------------------------------

TEMPLATES: list[dict] = [
    # 1 — Täglicher Digest (FEATURED)
    {
        "name": "Täglicher Digest",
        "description": (
            "Erstellt jeden Morgen eine kompakte Zusammenfassung deiner Aufgaben, "
            "Termine und offenen Punkte für den Tag."
        ),
        "category": "productivity",
        "icon": "sun",
        "prompt_template": (
            "Erstelle mir einen strukturierten Tagesüberblick für heute ({date}).\n\n"
            "Bitte gliedere die Zusammenfassung in folgende Abschnitte:\n"
            "1. **Wichtigste Prioritäten heute** — Was muss heute unbedingt erledigt werden?\n"
            "2. **Termine & Meetings** — Welche Termine stehen an?\n"
            "3. **Offene Aufgaben** — Was liegt noch aus früheren Tagen vor?\n"
            "4. **Fokus-Empfehlung** — Welcher eine Aufgabe sollte ich heute den meisten "
            "Fokus widmen und warum?\n\n"
            "Halte den Digest klar und handlungsorientiert. Keine langen Einleitungen."
        ),
        "suggested_cron": "0 7 * * 1-5",
        "default_model": "claude-sonnet-4-6",
        "variables": [
            {
                "name": "date",
                "label": "Datum",
                "type": "date",
                "default": "heute",
            }
        ],
        "is_featured": True,
    },
    # 2 — Wochenrückblick (FEATURED)
    {
        "name": "Wochenrückblick",
        "description": (
            "Jeden Freitagnachmittag: Reflexion der Woche, Erfolge festhalten "
            "und Prioritäten für die nächste Woche setzen."
        ),
        "category": "productivity",
        "icon": "calendar-check",
        "prompt_template": (
            "Führe meinen Wochenrückblick für die Kalenderwoche {week_number} durch.\n\n"
            "Struktur:\n"
            "## Was lief gut diese Woche?\n"
            "- Liste 3-5 Erfolge oder positive Entwicklungen auf.\n\n"
            "## Was lief nicht so gut?\n"
            "- Identifiziere 2-3 Herausforderungen oder Verbesserungspotenziale.\n\n"
            "## Lernpunkte\n"
            "- Was nehme ich aus dieser Woche mit?\n\n"
            "## Prioritäten nächste Woche\n"
            "- Die 3 wichtigsten Ziele für die kommende Woche.\n\n"
            "Sei ehrlich und konstruktiv. Keine Floskeln."
        ),
        "suggested_cron": "0 16 * * 5",
        "default_model": "claude-sonnet-4-6",
        "variables": [
            {
                "name": "week_number",
                "label": "Kalenderwoche",
                "type": "text",
                "default": "aktuell",
            }
        ],
        "is_featured": True,
    },
    # 3 — System Health Check
    {
        "name": "System Health Check",
        "description": (
            "Regelmäßige Überprüfung des Server-Status und kritischer Systemmetriken "
            "mit Handlungsempfehlungen bei Problemen."
        ),
        "category": "monitoring",
        "icon": "activity",
        "prompt_template": (
            "Führe einen System Health Check für {system_name} durch.\n\n"
            "Prüfe und berichte über:\n"
            "1. **CPU & Speicher** — Aktuelle Auslastung und Trends\n"
            "2. **Festplatte** — Belegung und freier Speicherplatz\n"
            "3. **Laufende Dienste** — Sind alle kritischen Services aktiv?\n"
            "4. **Fehler-Logs** — Gibt es kritische Fehlermeldungen der letzten 24h?\n"
            "5. **Handlungsempfehlungen** — Was muss sofort getan werden?\n\n"
            "Format: Kurze, klare Statusmeldungen. Kritische Probleme als erste Punkte."
        ),
        "suggested_cron": "0 */6 * * *",
        "default_model": "claude-sonnet-4-6",
        "variables": [
            {
                "name": "system_name",
                "label": "Systemname",
                "type": "text",
                "default": "Produktionsserver",
            }
        ],
        "is_featured": False,
    },
    # 4 — API Uptime Monitor
    {
        "name": "API Uptime Monitor",
        "description": (
            "Prüft stündlich die Verfügbarkeit und Antwortzeiten kritischer API-Endpunkte "
            "und meldet Abweichungen."
        ),
        "category": "monitoring",
        "icon": "wifi",
        "prompt_template": (
            "Überprüfe den Status der folgenden API-Endpunkte und erstelle einen Bericht:\n\n"
            "Endpunkte: {api_endpoints}\n\n"
            "Für jeden Endpunkt prüfe:\n"
            "- HTTP Status Code (erwartet: 200)\n"
            "- Antwortzeit (Warnung bei > {response_threshold_ms}ms)\n"
            "- Inhalt der Antwort (ist sie valide?)\n\n"
            "Ausgabe:\n"
            "- Status-Tabelle aller Endpunkte\n"
            "- Zusammenfassung: Alles OK / X Probleme gefunden\n"
            "- Bei Problemen: Mögliche Ursachen und nächste Schritte\n\n"
            "Zeitstempel: {timestamp}"
        ),
        "suggested_cron": "0 * * * *",
        "default_model": "claude-sonnet-4-6",
        "variables": [
            {
                "name": "api_endpoints",
                "label": "API-Endpunkte (kommagetrennt)",
                "type": "text",
                "default": "https://api.example.com/health",
            },
            {
                "name": "response_threshold_ms",
                "label": "Schwellwert Antwortzeit (ms)",
                "type": "number",
                "default": "500",
            },
            {
                "name": "timestamp",
                "label": "Zeitstempel",
                "type": "datetime",
                "default": "jetzt",
            },
        ],
        "is_featured": False,
    },
    # 5 — Security News Digest
    {
        "name": "Security News Digest",
        "description": (
            "Wochentlich zusammengefasste Sicherheitsnachrichten, neue CVEs und "
            "relevante Bedrohungen fur deine Technologien."
        ),
        "category": "security",
        "icon": "shield",
        "prompt_template": (
            "Erstelle einen Security News Digest fur die Woche {week}.\n\n"
            "Fokus auf folgende Technologien: {tech_stack}\n\n"
            "Abschnitte:\n"
            "## Kritische Sicherheitslucken (CVSS >= 7.0)\n"
            "- CVE-ID, betroffene Software, Schweregrad, empfohlene Massnahme\n\n"
            "## Neue Angriffsvektoren & Trends\n"
            "- Aktuelle Bedrohungslage, neue Angriffsmethoden\n\n"
            "## Patches & Updates\n"
            "- Wichtige Sicherheitsupdates der Woche\n\n"
            "## Handlungsbedarf\n"
            "- Was muss in meiner Umgebung sofort gepruft/geupdated werden?\n\n"
            "Quellen: NVD, CISA, Hersteller-Advisories."
        ),
        "suggested_cron": "0 9 * * 1",
        "default_model": "claude-sonnet-4-6",
        "variables": [
            {
                "name": "week",
                "label": "Woche",
                "type": "text",
                "default": "aktuelle Woche",
            },
            {
                "name": "tech_stack",
                "label": "Technologien (kommagetrennt)",
                "type": "text",
                "default": "Python, PostgreSQL, Docker, Node.js",
            },
        ],
        "is_featured": False,
    },
    # 6 — Projekt-Statusbericht (FEATURED)
    {
        "name": "Projekt-Statusbericht",
        "description": (
            "Erstellt automatisch einen wochentlichen Projekt-Statusbericht "
            "fur Stakeholder mit Fortschritt, Risiken und nachsten Schritten."
        ),
        "category": "reporting",
        "icon": "bar-chart-2",
        "prompt_template": (
            "Erstelle einen professionellen Projekt-Statusbericht fur {project_name}.\n\n"
            "Berichtszeitraum: {reporting_period}\n"
            "Empfanger: {audience}\n\n"
            "Struktur:\n"
            "## Executive Summary (3 Satze)\n"
            "Kurzer Gesamtstatus: Grun / Gelb / Rot\n\n"
            "## Fortschritt seit letztem Bericht\n"
            "- Abgeschlossene Meilensteine\n"
            "- Erledigte Aufgaben\n"
            "- Aktuelle Auslastung des Teams\n\n"
            "## Risiken & Blockers\n"
            "- Identifizierte Risiken mit Auswirkung (Hoch/Mittel/Niedrig)\n"
            "- Aktive Blocker und Verantwortliche\n\n"
            "## Nachste Schritte\n"
            "- Geplante Meilensteine bis {next_milestone_date}\n"
            "- Offene Entscheidungen die benotigt werden\n\n"
            "Ton: Sachlich, prasize, keine Euphemismen bei Problemen."
        ),
        "suggested_cron": "0 8 * * 5",
        "default_model": "claude-sonnet-4-6",
        "variables": [
            {
                "name": "project_name",
                "label": "Projektname",
                "type": "text",
                "default": "Mein Projekt",
            },
            {
                "name": "reporting_period",
                "label": "Berichtszeitraum",
                "type": "text",
                "default": "letzte Woche",
            },
            {
                "name": "audience",
                "label": "Empfanger",
                "type": "text",
                "default": "Stakeholder & Management",
            },
            {
                "name": "next_milestone_date",
                "label": "Nachster Meilenstein",
                "type": "date",
                "default": "in 2 Wochen",
            },
        ],
        "is_featured": True,
    },
    # 7 — Daten-Backup Reminder
    {
        "name": "Daten-Backup Reminder",
        "description": (
            "Erinnerung und Checkliste fur regelmasige Datensicherungen "
            "mit Statusuberprufung der letzten Backups."
        ),
        "category": "data",
        "icon": "hard-drive",
        "prompt_template": (
            "Erstelle eine Backup-Checkliste und Statusbericht fur {backup_targets}.\n\n"
            "Checkliste:\n"
            "- [ ] Datenbank-Backup erstellt und verifiziert\n"
            "- [ ] Dateisystem-Backup aktuell\n"
            "- [ ] Backup auf externen/Cloud-Speicher synchronisiert\n"
            "- [ ] Wiederherstellung stichprobenartig getestet\n"
            "- [ ] Backup-Logs auf Fehler geprüft\n\n"
            "Fragen zur Reflexion:\n"
            "1. Wann wurde das letzte Backup erfolgreich durchgefuhrt?\n"
            "2. Entspricht die Backup-Frequenz dem Datenvolumen und Anderungsrate?\n"
            "3. Wurde die Wiederherstellung in den letzten 30 Tagen getestet?\n\n"
            "Gib eine klare Empfehlung: Ist die Backup-Strategie aktuell ausreichend?"
        ),
        "suggested_cron": "0 10 * * 1",
        "default_model": "claude-sonnet-4-6",
        "variables": [
            {
                "name": "backup_targets",
                "label": "Backup-Ziele",
                "type": "text",
                "default": "Datenbank, Uploads, Konfigurationsdateien",
            }
        ],
        "is_featured": False,
    },
    # 8 — Meeting-Vorbereitung
    {
        "name": "Meeting-Vorbereitung",
        "description": (
            "Bereitet dich automatisch auf das nachste wichtige Meeting vor: "
            "Agenda, Unterlagen, offene Fragen und Ziele."
        ),
        "category": "communication",
        "icon": "users",
        "prompt_template": (
            "Bereite mich auf folgendes Meeting vor:\n\n"
            "Meeting: {meeting_title}\n"
            "Datum & Uhrzeit: {meeting_datetime}\n"
            "Teilnehmer: {participants}\n"
            "Ziel des Meetings: {meeting_goal}\n\n"
            "Erstelle:\n"
            "## Agenda-Vorschlag\n"
            "Strukturierter Ablaufplan mit Zeitblöcken\n\n"
            "## Wichtige Unterlagen\n"
            "Welche Dokumente/Daten sollte ich vorbereiten?\n\n"
            "## Offene Fragen\n"
            "Welche Fragen muss ich klaren, bevor das Meeting startet?\n\n"
            "## Meine Ziele fur dieses Meeting\n"
            "Was soll am Ende des Meetings konkret beschlossen/geklart sein?\n\n"
            "## Mogliche Einwande & Vorbereitung\n"
            "Welche Einwande konnen kommen und wie reagiere ich darauf?"
        ),
        "suggested_cron": "0 7 * * 1-5",
        "default_model": "claude-sonnet-4-6",
        "variables": [
            {
                "name": "meeting_title",
                "label": "Meeting-Titel",
                "type": "text",
                "default": "Team-Meeting",
            },
            {
                "name": "meeting_datetime",
                "label": "Datum & Uhrzeit",
                "type": "datetime",
                "default": "heute",
            },
            {
                "name": "participants",
                "label": "Teilnehmer",
                "type": "text",
                "default": "Team",
            },
            {
                "name": "meeting_goal",
                "label": "Meeting-Ziel",
                "type": "text",
                "default": "Wochentliche Abstimmung",
            },
        ],
        "is_featured": False,
    },
    # 9 — Lern-Zusammenfassung
    {
        "name": "Lern-Zusammenfassung",
        "description": (
            "Konsolidiert taglich deine Lernfortschritte, erstellt Zusammenfassungen "
            "und schlagt nachste Lernschritte vor."
        ),
        "category": "learning",
        "icon": "book-open",
        "prompt_template": (
            "Erstelle eine Lern-Zusammenfassung fur den Bereich: {learning_topic}\n\n"
            "Lernzeitraum: {learning_period}\n"
            "Mein aktuelles Level: {current_level}\n\n"
            "## Was habe ich gelernt?\n"
            "Fasse die wichtigsten Erkenntnisse und Konzepte zusammen.\n\n"
            "## Key Takeaways\n"
            "Die 3-5 wichtigsten Punkte die ich mir merken muss.\n\n"
            "## Praxis-Aufgaben\n"
            "Konkrete Ubungen um das Gelernte zu festigen.\n\n"
            "## Wissenslucken\n"
            "Was verstehe ich noch nicht vollstandig? Was muss ich vertiefen?\n\n"
            "## Nachste Lernschritte\n"
            "Empfohlene Themen und Ressourcen fur den nachsten Lernblock.\n\n"
            "## Lernfortschritt (0-100%)\n"
            "Geschatzte Kompetenz im Bereich {learning_topic}: ___%"
        ),
        "suggested_cron": "0 20 * * *",
        "default_model": "claude-sonnet-4-6",
        "variables": [
            {
                "name": "learning_topic",
                "label": "Lernthema",
                "type": "text",
                "default": "Python Async Programming",
            },
            {
                "name": "learning_period",
                "label": "Lernzeitraum",
                "type": "text",
                "default": "heute",
            },
            {
                "name": "current_level",
                "label": "Aktuelles Level",
                "type": "text",
                "default": "Fortgeschrittener Einsteiger",
            },
        ],
        "is_featured": False,
    },
]


# ---------------------------------------------------------------------------
# Seeder
# ---------------------------------------------------------------------------


async def seed_templates() -> None:
    print("Verbinde mit der Datenbank...")

    async with async_session() as session:
        # Check if templates already exist
        result = await session.execute(
            select(func.count()).select_from(RoutineTemplate)
        )
        existing_count: int = result.scalar_one()

        if existing_count > 0:
            print(
                f"Seed übersprungen: {existing_count} Template(s) bereits vorhanden. "
                "Lösche die Einträge manuell, um neu zu seeden."
            )
            return

        print(f"Füge {len(TEMPLATES)} Template(s) ein...")

        inserted = 0
        for tpl in TEMPLATES:
            record = RoutineTemplate(
                name=tpl["name"],
                description=tpl["description"],
                category=tpl["category"],
                icon=tpl["icon"],
                prompt_template=tpl["prompt_template"],
                suggested_cron=tpl["suggested_cron"],
                default_model=tpl.get("default_model", "claude-sonnet-4-6"),
                variables=tpl.get("variables", []),
                is_featured=tpl.get("is_featured", False),
                suggested_skills=[],
            )
            session.add(record)
            inserted += 1
            print(f"  + {tpl['name']} ({tpl['category']})")

        await session.commit()
        print(f"\nSeed abgeschlossen: {inserted} Template(s) eingefugt.")

        # Summary
        featured = sum(1 for t in TEMPLATES if t.get("is_featured"))
        categories = sorted({t["category"] for t in TEMPLATES})
        print(f"Davon featured: {featured}")
        print(f"Kategorien: {', '.join(categories)}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    asyncio.run(seed_templates())
