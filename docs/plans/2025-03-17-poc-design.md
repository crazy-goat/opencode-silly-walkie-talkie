# OpenCode Silly Walkie-Talkie - Design Document

**Date:** 2025-03-17  
**Status:** Approved  
**Codename:** Walkie-Talkie for OpenCode

---

## 1. Cel projektu

Plugin do OpenCode.ai, który pozwala na powiadamianie użytkownika na telefonie/komórce, gdy LLM ma pytanie lub skończył odpowiedź. Użytkownik może odpowiadać z komórki słownie przez klawiaturę Google/Apple i kontynuować rozmowę z LLM.

---

## 2. Architektura

### 2.1 Komponenty

```
┌─────────────────┐      WebSocket      ┌──────────────────┐
│   OpenCode      │ ◄──────────────────►│   PWA (Vanilla)  │
│   Plugin        │   (ngrok tunnel)    │   Mobile/Tablet  │
│   localhost:8765│                     │                  │
└────────┬────────┘                     └──────────────────┘
         │
         ▼
┌─────────────────┐     ngrok free      ┌─────────────────┐
│   ngrok CLI     │ ───────────────────►│   Public URL    │
│   (share http)  │   (authtoken req.)  │   (wss://...)   │
└─────────────────┘                     └─────────────────┘
```

### 2.2 Flow

1. Plugin OpenCode startuje WebSocket server na `localhost:8765`
2. Uruchamia `ngrok http 8765` → otrzymuje publiczny URL
3. Generuje QR kod z URL + tokenem autoryzacyjnym
4. Użytkownik skanuje QR telefonem
5. PWA łączy się przez WebSocket
6. Plugin wysyła eventy do PWA
7. PWA może odpowiadać przez komendy

---

## 3. Struktura projektu

```
open-code-silly-walkie-talkie/
├── README.md
├── plugin/                          # Plugin OpenCode
│   ├── package.json
│   ├── tsconfig.json
│   ├── opencode.json                # Konfiguracja pluginu OpenCode
│   ├── src/
│   │   ├── index.ts                 # Entry point, rejestracja hooków
│   │   ├── server.ts                # WebSocket server
│   │   ├── ngrok.ts                 # Integracja z ngrok
│   │   ├── qr.ts                    # Generator QR code
│   │   ├── protocol.ts              # Typy i definicje protokołu
│   │   └── handlers.ts              # Handlery komend z PWA
│   └── tests/
│       └── plugin.test.ts
├── pwa/                             # Progressive Web App (Vanilla JS)
│   ├── index.html                   # Główny plik
│   ├── manifest.json                # PWA manifest
│   ├── sw.js                        # Service Worker (min. wersja)
│   └── src/
│       ├── app.js                   # Główna logika aplikacji
│       ├── ws-client.js             # WebSocket client
│       ├── qr-scanner.js            # Skaner QR (html5-qrcode)
│       ├── ui.js                    # Manipulacja UI
│       └── styles.css               # Stylowanie
└── docs/
    └── plans/
        └── 2025-03-17-poc-design.md # Ten dokument
```

---

## 4. Protokół WebSocket

### 4.1 Eventy (Plugin → PWA)

| Event | Opis | Payload |
|-------|------|---------|
| `heartbeat` | Co 10s, keepalive | `{timestamp}` |
| `new_message` | Nowa wiadomość od LLM | `{message: {id, role, content, timestamp}}` |
| `end` | LLM skończył odpowiadać | `{timestamp}` |
| `messages` | Odpowiedź na get_messages | `{messages: [...]}` |

### 4.2 Komendy (PWA → Plugin)

| Komenda | Opis | Payload | Odpowiedź |
|---------|------|---------|-----------|
| `get_messages` | Pobierz historię | `{}` | `messages` event |
| `ping` | Keepalive (gdy brak heartbeat) | `{}` | `pong` |
| `bye` | Rozłączenie | `{}` | - |

### 4.3 Logika połączenia

**Plugin:**
- Wysyła `heartbeat` co 10 sekund
- Jeśli brak odpowiedzi przez 30s → uznaje PWA za offline

**PWA:**
- Nasłuchuje `heartbeat`
- Jeśli brak przez 10s → wysyła `ping`
- Jeśli brak przez 30s → "błąd połączenia", próba reconnect
- Reconnect: exponential backoff 1s, 2s, 4s, 8s, 16s, 32s, potem co 60s

### 4.4 Ikony statusu

| Status | Ikona | Kiedy |
|--------|-------|-------|
| Pracuje | 🔄 | Otrzymano `new_message`, nie otrzymano `end` |
| Skończył | ✓ | Otrzymano `end` |
| Błąd | ⚠️ | Brak heartbeat przez 30s |

---

## 5. Integracja z OpenCode

### 5.1 Hooki OpenCode

```typescript
export const WalkieTalkiePlugin = async ({ client }) => {
  const wsServer = new WebSocketServer();
  
  return {
    // Inicjalizacja przy starcie OpenCode
    async init() {
      await wsServer.start();
      const url = await startNgrok(wsServer.port);
      const qr = generateQR(url, wsServer.token);
      console.log("\n[Silly Walkie-Talkie] Scan QR to connect:");
      console.log(qr);
    },

    // LLM skończył odpowiadać
    "session.idle": async (event) => {
      wsServer.broadcast({ type: "end" });
    },

    // Nowa wiadomość (streaming)
    "message.updated": async (event) => {
      if (isNewMessage(event)) {
        wsServer.broadcast({
          type: "new_message",
          message: formatMessage(event.message)
        });
      }
    },

    // Sesja czeka na input
    "session.status": async (event) => {
      if (event.status === "awaiting_input") {
        wsServer.broadcast({
          type: "awaiting_input",
          prompt: event.prompt
        });
      }
    }
  };
};
```

### 5.2 Instalacja pluginu

Użytkownik instaluje przez:
```bash
# npm (gdy opublikujemy)
npm install -g @crazy-goat/opencode-walkie-talkie

# lub lokalnie
git clone https://github.com/crazy-goat/open-code-silly-walkie-talkie
cd plugin && npm install && npm link
```

Dodanie do `opencode.json`:
```json
{
  "plugins": ["@crazy-goat/opencode-walkie-talkie"]
}
```

---

## 6. Wymagania techniczne

### 6.1 Plugin
- Node.js >= 18
- TypeScript
- Zależności:
  - `ws` - WebSocket server
  - `@ngrok/ngrok` - Tunel
  - `qrcode` - Generowanie QR
  - `@opencode-ai/plugin` - SDK OpenCode

### 6.2 PWA
- Vanilla JavaScript (ES6+)
- HTML5 + CSS3
- Zależności:
  - `html5-qrcode` - Skaner QR
  - WebSocket API (native)
  - Service Worker (minimalny, bez push)

### 6.3 Ngrok
- Darmowy plan (wystarczy dla POC)
- Wymaga authtoken (konfiguracja jednorazowa)
- Limit: 1 godzina per sesja (po 1h nowy URL i QR)

---

## 7. Obsługa błędów

| Scenariusz | Zachowanie Pluginu | Zachowanie PWA |
|------------|-------------------|----------------|
| **Ngrok timeout (1h)** | Restartuje ngrok, nowy URL → wyświetla nowy QR w terminalu | Rozłącza, pokazuje "Sesja wygasła, zeskanuj nowy QR" |
| **PWA offline** | Heartbeat timeout po 30s → czeka na reconnect | Reconnect z exponential backoff |
| **Plugin restart** | Resetuje historię, nowy token | Rozłącza, "Plugin zrestartowany, zeskanuj QR" |
| **Więcej niż 1 PWA** | Pierwszy połączony = aktywny, reszta → "Już połączony" | Pokazuje "Inne urządzenie aktywne" |
| **Invalid token** | Odrzuca połączenie (HTTP 403) | "Nieprawidłowy kod, zeskanuj ponownie" |

---

## 8. Następne kroki (Implementation)

1. **Task 1:** Stworzenie struktury katalogów
2. **Task 2:** Implementacja WebSocket server (plugin)
3. **Task 3:** Integracja z ngrok
4. **Task 4:** Generator QR
5. **Task 5:** Podstawowy PWA (HTML + QR scanner)
6. **Task 6:** WebSocket client (PWA)
7. **Task 7:** UI PWA (lista wiadomości, status)
8. **Task 8:** Hooki OpenCode
9. **Task 9:** Testowanie end-to-end

---

## 9. Decyzje projektowe

| Decyzja | Wybór | Uzasadnienie |
|---------|-------|--------------|
| Architektura | ngrok + WebSocket | Dobre wsparcie WebSocket, prostsze niż zrok dla POC |
| PWA Framework | Vanilla JS | Minimalny overhead, szybszy development POC |
| Struktura | Flat (bez monorepo tools) | Szybszy setup, mniej konfiguracji |
| OpenCode vs Crush | OpenCode | Ma oficjalne API pluginów z eventami |
| Tunel | ngrok (później zrok self-hosted) | ngrok szybszy w POC, zrok na produkcję |

---

**Zatwierdzony przez:** @s2x  
**Data zatwierdzenia:** 2025-03-17
