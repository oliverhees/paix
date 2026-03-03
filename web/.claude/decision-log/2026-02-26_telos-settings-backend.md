# Decision Log: TELOS + Settings Backend-Anbindung

Datum: 2026-02-26

## Entscheidungen

### 1. Service Layer Architektur
- Separate Service-Dateien (`telos-service.ts`, `settings-service.ts`) statt alles in `api.ts`
- Begründung: Klare Trennung der Domänen, wiederverwendbar, testbar
- Die bestehende `api.ts` bleibt als generischer HTTP-Client erhalten

### 2. Mock-Daten Fallback
- Jeder Store hält Mock-Daten als Fallback bereit
- Bei API-Fehler werden Mocks angezeigt + gelbe Warnung
- Begründung: Frontend soll immer nutzbar sein, auch offline

### 3. Optimistic Updates
- Alle Mutationen (save, delete, toggle) aktualisieren zuerst lokal
- API-Call läuft im Hintergrund
- Bei Fehler bleibt lokaler State erhalten
- Begründung: Bessere UX, kein Flackern

### 4. TELOS Datenmodell
- Backend hat 10 Dimensionen: mission, goals, projects, beliefs, models, strategies, narratives, learned, challenges, ideas
- Frontend-Store bildet sowohl freien Text als auch strukturierte Entries ab
- Entries können vom Agent (grün) oder User kommen

### 5. Settings ohne Integrations-Tab
- Integrations-Tab entfernt (war nur Mock)
- Neuer "Ueber PAI-X" Tab stattdessen
- Begründung: Keine Backend-Endpoints für Integrationen vorhanden

### 6. Template Adaption
- Settings-Seite: Struktur inspiriert vom Template (Tabs + Cards Pattern)
- TELOS-Seite: Eigenes Design behalten, da Template kein Äquivalent hat
- Badge, Card, Tabs Patterns 1:1 aus Template übernommen
