# OpenCode Silly Walkie-Talkie

## Podsumowanie projektu

Plugin do OpenCode.ai, który pozwala na powiadamianie użytkownika na telefonie/komórce, gdy LLM ma pytanie lub skończył odpowiedź. Użytkownik może odpowiadać z komórki słownie przez klawiaturę Google/Apple i kontynuować rozmowę z LLM.

## Główny problem do rozwiązania

Komunikacja bezpieczna między OpenCode (działającym lokalnie) a aplikacją mobilną musi działać zarówno w sieci lokalnej, jak i zdalnie — przy czym komputer z OpenCode może być za firewallem/NAT bez publicznego IP.

## Architektura

### 1. Plugin OpenCode (TypeScript/Node.js)
- Monitoruje sesję rozmowy z LLM
- Uruchamia lokalny serwer WebSocket
- Generuje QR kod z:
  - Publicznym URL (przez tunel)
  - Tokenem autoryzacyjnym/szyfrowania
- Wysyła eventy do podłączonych klientów:
  - Gdy LLM zakończył odpowiedź
  - Gdy czeka na input użytkownika
- Obsługuje żądania:
  - Pobranie pełnej historii rozmowy
  - Dodanie nowej wiadomości od użytkownika

### 2. Tunel (zrok self-hosted na Dokploy)
- Wybrane rozwiązanie: **zrok self-hosted**
- Uruchamiane na własnym VPS z Dokploy
- Konfiguracja: akceptuje połączenia bez rejestracji użytkowników (open/public mode)
- Plugin łączy się do zrok → otrzymuje publiczny URL → generuje QR

### 3. Aplikacja mobilna — PWA (Progressive Web App)
- Platforma: React Native / PWA w przeglądarce
- Funkcje:
  - Lista monitorowanych sesji OpenCode (wiele maszyn)
  - Badge/ikona powiadomienia gdy sesja ma nowe zdarzenie
  - Pobieranie pełnej historii rozmowy po kliknięciu
  - Pole tekstowe do wpisania następnej instrukcji
  - Powiadomienia push przez Web Push API (działa nawet gdy PWA zamknięta)

## Parowanie urządzeń (QR Code)

1. Użytkownik w OpenCode uruchamia komendę generującą QR
2. QR zawiera:
   - URL WebSocket serwera (przez tunel zrok)
   - Jednorazowy klucz/token autoryzacyjny
3. Użytkownik skanuje QR telefonem → PWA łączy się z pluginem
4. Połączenie WebSocket pozostaje aktywne, eventy przesyłane real-time

## Komunikacja WebSocket

### Eventy z pluginu do PWA:
- `session:ended` — LLM zakończył odpowiedź
- `session:awaiting_input` — LLM czeka na input
- `conversation:history` — pełna historia rozmowy (odpowiedź na żądanie)

### Komendy z PWA do pluginu:
- `get_conversation` — pobierz historię
- `send_message` — dodaj wiadomość użytkownika
- `ping` — keepalive

## Szyfrowanie

- HTTPS/TLS przez tunel (zrok) — bezpieczeństwo transportu
- Dodatkowy token autoryzacyjny w URL/QR — tylko sparowane urządzenie może się połączyć
- Opcjonalnie: symetryczne AES dla payloadów (jeśli potrzebna dodatkowa warstwa)

## Technologie

- **Plugin**: TypeScript, Node.js, WebSocket (ws lub socket.io), @ngrok/ngrok (początkowo) / zrok (docelowo)
- **Tunel**: zrok self-hosted (Go) na Dokploy + VPS
- **PWA**: React/TypeScript, Web Push API, WebSocket client
- **Deploy**: GitHub Actions, Docker

## Fazy rozwoju (POC → Produkcja)

### POC (Proof of Concept)
1. Podstawowy plugin OpenCode z WebSocket serwerem
2. Integracja z zrok.io (chmura) — bez własnego serwera
3. Prosta PWA — lista sesji, badge, odpowiadanie
4. QR kod z URL + tokenem

### Produkcja
1. Migracja na własny zrok self-hosted
2. Zaawansowane powiadomienia push (nawet gdy PWA nieaktywna)
3. Szyfrowanie end-to-end
4. Autentykacja użytkownika
5. Wielu użytkowników na jednej sesji

## Skrót nazwy projektu

**OpenCode Silly Walkie-Talkie** — nawiązanie do Monty Pythona (Silly Walks), ale w wersji wojskowej "walkie-talkie" (radiotelefon). Cel: szybka, nieformalna komunikacja z LLM jak na polu walki.

## Repozytorium

- GitHub: `crazy-goat/open-code-silly-walkie-talkie`
- Publiczne
- Issue #1: https://github.com/crazy-goat/open-code-silly-walkie-talkie/issues/1

## Następne kroki

1. Zainstalować zrok na VPS/Dokploy
2. Stworzyć strukturę monorepo (plugin + PWA)
3. Implementacja pluginu OpenCode (WebSocket server)
4. Implementacja PWA (React + WebSocket client)
5. Integracja z tunel zrok
6. Testowanie parowania QR

## Autor

Inicjatywa: crazy-goat / s2x
Cel: Udostępnienie narzędzia dla społeczności OpenCode
