# Walkie-Talkie — Developer Notes

## OpenCode Plugin API

Plugin dostaje `{ client, directory, serverUrl }` jako input.

`client` używa **starego SDK** (`dist/gen/` nie `dist/v2/gen/`).
Wszystkie path parametry to `{ path: { id } }`, nie `{ sessionID }`.

### Poprawne wywołania:

```typescript
// Pobierz sesję
client.session.get({ path: { id: sessionId } })

// Lista wiadomości sesji
client.session.messages({ path: { id: sessionId } })

// Pojedyncza wiadomość
client.session.message({ path: { id: sessionId, messageID } })

// Lista sesji (bez path)
client.session.list()

// Wyślij wiadomość
client.session.promptAsync({ path: { id: sessionId }, body: { parts: [...] } })
```

### Global events (SSE):

```typescript
client.global.event().then(({ stream }) => {
  // NIE używaj await na client.global.event() — blokuje
  for await (const ev of stream) {
    const event = ev?.payload;
    // event.type, event.properties
  }
})
```

### Dostępne metody session (stary SDK):

- `list()` — lista wszystkich sesji
- `get({ path: { id } })` — pobierz sesję (tytuł, directory, etc.)
- `create()`, `delete()`, `update()`
- `messages({ path: { id } })` — lista wiadomości (array of `{ info, parts }`)
- `message({ path: { id, messageID } })` — pojedyncza wiadomość
- `prompt()`, `promptAsync()` — wyślij wiadomość
- `abort({ path: { id } })` — przerwij sesję
- `fork()`, `share()`, `unshare()`, `diff()`, `summarize()`
- `children()` — sub-sesje
- `todo()` — lista todoków sesji

### Eventy które przychodzą przez plugin `event()`:

Przy `-s` (restore sesji) **żaden event nie przychodzi** na starcie.
Eventy zaczynają przychodzić dopiero gdy użytkownik coś napisze.

Dlatego używamy **global SSE** (`client.global.event()`) do wykrycia aktywnej sesji.

### Filtrowanie sesji po directory:

```typescript
// Plugin zna swój directory
export default async ({ client, directory }) => {
  // session.list() zwraca wszystkie sesje — filtruj po directory
  const sessions = await client.session.list()
  const mine = sessions.data.find(s => s.directory === directory)
}
```

**Uwaga:** Jeśli dwa opencode są w tym samym directory, `find` bierze pierwszą (najnowszą po sort).
Właściwa sesja pojawi się przez global SSE gdy user zacznie pisać.

### Heartbeat / TTL:

Go server usuwa sesje po 30s bez heartbeatu.
Plugin pinguje co 10s przez `POST /api/register` (idempotentne — broadcast tylko gdy coś się zmienia).

## Architektura

```
opencode (TUI)
  └── plugin (Bun WS server na losowym porcie)
        └── POST /api/register → Go server
              ├── GET /api/sessions (JSON lista)
              ├── WS /api/sessions/ws (hub dla WebUI)
              └── WS /ws/{port}/* (proxy do pluginu)
                    └── WebUI (vanilla JS SPA)
```

## Uruchomienie

```bash
# Go server
cd server && go run . -static ../webui

# Plugin (build)
cd plugin && npm run build

# OpenCode
opencode          # nowa sesja
opencode -s <id>  # restore sesji
```

## Debug

```bash
# Aktywne sesje w Go server
curl -sk https://localhost:3000/api/sessions

# Logi pluginu
cat /tmp/walkie-debug.log
```
