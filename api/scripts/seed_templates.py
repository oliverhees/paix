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
    # 10 — Tägliches KI-Briefing (FEATURED)
    {
        "name": "Tägliches KI-Briefing",
        "description": (
            "Recherchiert jeden Morgen die wichtigsten KI-News und erstellt "
            "ein kompaktes Briefing mit den relevantesten Entwicklungen."
        ),
        "category": "research",
        "icon": "newspaper",
        "prompt_template": (
            "Erstelle ein umfassendes KI-Briefing für heute.\n\n"
            "Recherchiere die wichtigsten Entwicklungen in der KI-Branche "
            "der letzten 24 Stunden und gliedere das Briefing wie folgt:\n\n"
            "## Top-Nachrichten\n"
            "Die 3-5 wichtigsten KI-News des Tages mit kurzer Zusammenfassung.\n\n"
            "## Neue Modelle & Releases\n"
            "Wurden neue KI-Modelle, Tools oder Plattformen veröffentlicht?\n\n"
            "## Forschung & Paper\n"
            "Bemerkenswerte neue Forschungsergebnisse oder Paper.\n\n"
            "## Branche & Markt\n"
            "Investitionen, Partnerschaften, Regulierung.\n\n"
            "## Einordnung & Relevanz\n"
            "Was bedeuten diese Entwicklungen für {{focus_area}}?\n\n"
            "Fokus auf: {{focus_area}}\n"
            "Halte es prägnant und handlungsorientiert."
        ),
        "suggested_cron": "30 7 * * *",
        "default_model": "claude-sonnet-4-6",
        "variables": [
            {
                "name": "focus_area",
                "label": "Fokusbereich",
                "type": "text",
                "default": "KI-Anwendungen im Business",
            }
        ],
        "is_featured": True,
    },
    # 11 — Wöchentlicher KI-Trend-Report
    {
        "name": "Wöchentlicher KI-Trend-Report",
        "description": (
            "Analysiert wöchentlich die wichtigsten KI-Trends, identifiziert "
            "Muster und gibt strategische Einschätzungen."
        ),
        "category": "research",
        "icon": "trending-up",
        "prompt_template": (
            "Erstelle einen wöchentlichen KI-Trend-Report.\n\n"
            "Analysiere die KI-Entwicklungen der letzten Woche und erstelle "
            "einen strategischen Report:\n\n"
            "## Trend-Überblick\n"
            "Die 5 wichtigsten Trends dieser Woche, jeweils mit:\n"
            "- Kurzbeschreibung\n"
            "- Relevanz (Hoch/Mittel/Niedrig)\n"
            "- Zeithorizont (kurzfristig/mittelfristig/langfristig)\n\n"
            "## Aufsteigende Technologien\n"
            "Welche Technologien gewinnen an Bedeutung?\n\n"
            "## Absteigende Technologien\n"
            "Was verliert an Relevanz oder wird abgelöst?\n\n"
            "## Marktbewegungen\n"
            "Wichtige Deals, Investments, Akquisitionen.\n\n"
            "## Strategische Empfehlungen\n"
            "Was sollte {{company_context}} diese Woche beachten?\n\n"
            "Branchenfokus: {{industry_focus}}"
        ),
        "suggested_cron": "0 9 * * 1",
        "default_model": "claude-sonnet-4-6",
        "variables": [
            {
                "name": "company_context",
                "label": "Unternehmenskontext",
                "type": "text",
                "default": "ein KI-fokussiertes Tech-Unternehmen",
            },
            {
                "name": "industry_focus",
                "label": "Branchenfokus",
                "type": "text",
                "default": "Enterprise AI, SaaS, Automation",
            },
        ],
        "is_featured": False,
    },
    # 12 — Content Pipeline (FEATURED)
    {
        "name": "Content Pipeline",
        "description": (
            "Erstellt aus aktuellen Themen Social Media Posts — recherchiert, "
            "formuliert und bereitet Inhalte zur Veröffentlichung vor."
        ),
        "category": "content",
        "icon": "pen-tool",
        "prompt_template": (
            "Recherchiere ein aktuelles KI-Thema und erstelle daraus einen "
            "LinkedIn-Post.\n\n"
            "## Schritt 1: Themenrecherche\n"
            "Finde ein aktuelles, relevantes KI-Thema das {{target_audience}} "
            "interessiert.\n\n"
            "## Schritt 2: LinkedIn-Post erstellen\n"
            "Erstelle einen professionellen LinkedIn-Post mit:\n"
            "- Aufmerksamkeitsstarker erster Zeile (Hook)\n"
            "- Klarer Struktur mit Absätzen\n"
            "- Konkretem Mehrwert für den Leser\n"
            "- Call-to-Action am Ende\n"
            "- 3-5 relevante Hashtags\n"
            "- Länge: 800-1500 Zeichen\n\n"
            "## Schritt 3: Varianten\n"
            "Erstelle zusätzlich eine kürzere Version für {{additional_platform}}.\n\n"
            "Tonalität: {{tone}}\n"
            "Sprache: {{language}}"
        ),
        "suggested_cron": "0 10 * * 1-5",
        "default_model": "claude-sonnet-4-6",
        "variables": [
            {
                "name": "target_audience",
                "label": "Zielgruppe",
                "type": "text",
                "default": "Tech-Entscheider und KI-Interessierte",
            },
            {
                "name": "additional_platform",
                "label": "Zusätzliche Plattform",
                "type": "text",
                "default": "Twitter/X",
            },
            {
                "name": "tone",
                "label": "Tonalität",
                "type": "text",
                "default": "Professionell, aber nahbar",
            },
            {
                "name": "language",
                "label": "Sprache",
                "type": "text",
                "default": "Deutsch",
            },
        ],
        "is_featured": True,
    },
    # 13 — Tages-Zusammenfassung
    {
        "name": "Tages-Zusammenfassung",
        "description": (
            "Fasst den Tag zusammen, reflektiert Erreichtes und plant die "
            "Prioritäten für den nächsten Tag."
        ),
        "category": "productivity",
        "icon": "clipboard-check",
        "prompt_template": (
            "Erstelle eine Zusammenfassung des heutigen Tages und plane den "
            "nächsten Tag.\n\n"
            "## Tagesrückblick\n"
            "### Erledigte Aufgaben\n"
            "Was wurde heute geschafft? Liste die abgeschlossenen Aufgaben.\n\n"
            "### Offene Aufgaben\n"
            "Was konnte nicht fertiggestellt werden und warum?\n\n"
            "### Highlights & Erkenntnisse\n"
            "Was war besonders bemerkenswert heute?\n\n"
            "## Planung für morgen\n"
            "### Top 3 Prioritäten\n"
            "Die drei wichtigsten Aufgaben für morgen.\n\n"
            "### Termine & Deadlines\n"
            "Welche Termine stehen morgen an?\n\n"
            "### Fokus-Empfehlung\n"
            "Worauf sollte ich morgen besonders achten?\n\n"
            "Bereich: {{work_area}}\n"
            "Format: Kurz und handlungsorientiert."
        ),
        "suggested_cron": "0 18 * * 1-5",
        "default_model": "claude-sonnet-4-6",
        "variables": [
            {
                "name": "work_area",
                "label": "Arbeitsbereich",
                "type": "text",
                "default": "Allgemein",
            }
        ],
        "is_featured": False,
    },
    # 14 — Wettbewerber-Watch (FEATURED)
    {
        "name": "Wettbewerber-Watch",
        "description": (
            "Überwacht täglich die Aktivitäten deiner Wettbewerber — News, "
            "Produktupdates, Stellenanzeigen und Social Media."
        ),
        "category": "research",
        "icon": "eye",
        "prompt_template": (
            "Recherchiere aktuelle News und Aktivitäten zu folgenden "
            "Unternehmen/Wettbewerbern:\n\n"
            "Wettbewerber: {{competitors}}\n\n"
            "Erstelle einen Monitoring-Bericht mit:\n\n"
            "## Neue Entwicklungen\n"
            "Für jeden Wettbewerber: Was gibt es Neues?\n"
            "- Produktupdates & Feature-Releases\n"
            "- Pressemitteilungen & News\n"
            "- Blog-Beiträge & Content\n\n"
            "## Strategische Bewegungen\n"
            "- Neue Partnerschaften oder Integrationen\n"
            "- Funding-Runden oder Akquisitionen\n"
            "- Neue Stellenanzeigen (deuten auf strategische Richtung hin)\n\n"
            "## Social Media Aktivität\n"
            "Auffällige Posts oder Kampagnen der Wettbewerber.\n\n"
            "## Bewertung & Handlungsempfehlung\n"
            "Was bedeuten diese Entwicklungen für {{own_company}}?\n"
            "Gibt es Chancen oder Bedrohungen?\n\n"
            "Branche: {{industry}}"
        ),
        "suggested_cron": "0 8 * * 1-5",
        "default_model": "claude-sonnet-4-6",
        "variables": [
            {
                "name": "competitors",
                "label": "Wettbewerber (kommagetrennt)",
                "type": "textarea",
                "default": "Unternehmen A, Unternehmen B, Unternehmen C",
            },
            {
                "name": "own_company",
                "label": "Eigenes Unternehmen",
                "type": "text",
                "default": "Mein Unternehmen",
            },
            {
                "name": "industry",
                "label": "Branche",
                "type": "text",
                "default": "KI & Software",
            },
        ],
        "is_featured": True,
    },
]


# ---------------------------------------------------------------------------
# Seeder
# ---------------------------------------------------------------------------


async def seed_templates() -> None:
    print("Verbinde mit der Datenbank...")

    async with async_session() as session:
        # Get existing template names to avoid duplicates
        result = await session.execute(
            select(RoutineTemplate.name)
        )
        existing_names: set[str] = {row[0] for row in result.all()}

        if existing_names:
            print(f"{len(existing_names)} Template(s) bereits vorhanden.")

        # Filter to only new templates
        new_templates = [t for t in TEMPLATES if t["name"] not in existing_names]

        if not new_templates:
            print("Keine neuen Templates zum Einfügen. Alles aktuell.")
            return

        print(f"Füge {len(new_templates)} neue Template(s) ein...")

        inserted = 0
        for tpl in new_templates:
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
        print(f"\nSeed abgeschlossen: {inserted} neue Template(s) eingefügt.")

        # Summary
        total = len(existing_names) + inserted
        featured = sum(1 for t in TEMPLATES if t.get("is_featured"))
        categories = sorted({t["category"] for t in TEMPLATES})
        print(f"Gesamt: {total} Templates ({featured} featured)")
        print(f"Kategorien: {', '.join(categories)}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    asyncio.run(seed_templates())
