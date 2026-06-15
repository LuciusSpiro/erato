// Dummy-Daten für die Mockups — keine echte API.

export const notebooks = [
  {
    id: 'nb-eng',
    title: 'Engineering',
    icon: 'Code2',
    pages: [
      {
        id: 'p-onb',
        title: 'Onboarding',
        children: [
          { id: 'p-setup', title: 'Dev-Setup', children: [] },
          { id: 'p-access', title: 'Zugänge & Tools', children: [] },
        ],
      },
      {
        id: 'p-arch',
        title: 'Architektur',
        children: [
          {
            id: 'p-backend',
            title: 'Backend',
            children: [
              { id: 'p-api', title: 'API-Konventionen', children: [] },
              { id: 'p-db', title: 'Datenmodell', children: [] },
            ],
          },
          { id: 'p-frontend', title: 'Frontend', children: [] },
        ],
      },
      { id: 'p-runbook', title: 'Runbook: Incidents', children: [] },
    ],
  },
  {
    id: 'nb-product',
    title: 'Produkt',
    icon: 'Lightbulb',
    pages: [
      { id: 'p-roadmap', title: 'Roadmap 2026', children: [] },
      { id: 'p-research', title: 'User Research', children: [] },
    ],
  },
  {
    id: 'nb-team',
    title: 'Team & Orga',
    icon: 'Users',
    pages: [
      { id: 'p-meeting', title: 'Meeting-Notizen', children: [] },
      { id: 'p-prozesse', title: 'Prozesse', children: [] },
    ],
  },
]

// Aktive Beispielseite (für den Editor-Mockup)
export const activePage = {
  notebook: 'Engineering',
  breadcrumb: ['Engineering', 'Architektur', 'Backend', 'API-Konventionen'],
  title: 'API-Konventionen',
  editedBy: 'Christian P.',
  editedAt: 'vor 3 Stunden',
}

export const searchResults = [
  {
    breadcrumb: ['Engineering', 'Architektur', 'Backend'],
    title: 'API-Konventionen',
    snippet: 'Alle Endpunkte folgen dem REST-Muster mit klaren …Status-Codes und konsistenter Fehlerstruktur.',
    kind: 'text',
  },
  {
    breadcrumb: ['Engineering', 'Onboarding'],
    title: 'Dev-Setup',
    snippet: '…Authentifizierung läuft über OIDC/Keycloak, Token werden …',
    kind: 'text',
  },
  {
    breadcrumb: ['Produkt'],
    title: 'Roadmap 2026',
    snippet: 'Semantische Suche und AI-Assistent sind für Q3 geplant …',
    kind: 'semantic',
  },
]
