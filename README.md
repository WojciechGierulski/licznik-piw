# Piwny licznik 🍺

Dashboard dla grupy na Messengerze, w której każde piwo to zdjęcie i kolejny numer licznika.
Statyczna strona (HTML + Chart.js) na GitHub Pages, dane z eksportu Facebooka.

## Jak to działa

```
eksport FB (.zip / folder)  →  parse_export.py  →  site/data.json  →  GitHub Pages
```

Messenger nie daje API do czatów grupowych, więc dane bierzemy z eksportu konta.

## 1. Pobierz eksport czatu

**Zwykły czat** (niezaszyfrowany):
Facebook → Centrum kont → Twoje informacje i uprawnienia → Pobierz swoje informacje →
wybierz tylko **Wiadomości**, format **JSON**, jakość multimediów **niska** (zdjęcia nie są potrzebne,
liczy się tylko to, że były), zakres dat dowolny. Gotowe po kilku minutach do kilku godzin.

**Czat szyfrowany end-to-end** (na nowszych grupach domyślnie): Messenger na komputerze →
Ustawienia → Prywatność i bezpieczeństwo → Czaty szyfrowane end-to-end → Przechowywanie wiadomości →
Pobierz dane z bezpiecznego magazynu. Na macOS działa w Chrome, w Safari bywa problem.

Jeśli grupa ma historię w obu miejscach, podaj oba pliki naraz. Duplikaty są usuwane.

## 2. Co tydzień

1. Wrzuć nowy eksport do `export/` (dowolny podfolder, np. `export/2026-11-22/`, albo sam `.zip`).
   Stare eksporty możesz zostawić. Nakładające się wiadomości są scalane po (czas, autor, treść),
   a czat jest rozpoznawany po `thread_path`, więc zmiana nazwy grupy nie psuje historii.
2. `./update.sh` parsuje wszystko z `export/`, zapisuje `site/data.json` i `review.md`,
   pokazuje sekcję **Do decyzji** i pyta, czy opublikować.
3. Jeśli coś jest „do decyzji” (np. luka w liczniku, którą mogło wypełnić kilka zdjęć), dopisz decyzję
   do `config.json` (`assign` / `skip_messages`) i odpal ponownie. Możesz też poprosić Claude'a o przejrzenie `review.md`.

`review.md` zawiera też wszystkie decyzje automatyczne („agent47” → #47, „184-190” → 7 piw, kolizje,
luki), więc łatwo wyłapać nowy sposób pisania licznika, którego reguły jeszcze nie znają.

Podgląd lokalny: `cd site && python3 -m http.server 8000` → http://localhost:8000

## Zdjęcia

Parser kopiuje do `site/media/` tylko zdjęcia i filmy, które potwierdziły zaliczone piwa, i usuwa te,
które przestały być potrzebne. Na dashboardzie otwierają się po kliknięciu: ściana piw, rekordy
(np. najbardziej lubiane piwo), imię w rankingu, dzień w kalendarzu albo wiersz z ostatniego dnia.
Żeby nie publikować zdjęć, ustaw `"publish_photos": false` w `config.json`.

## 3. Hosting (GitHub Pages, za darmo)

1. Utwórz repo na GitHubie i wypchnij ten folder.
   Eksporty FB są w `.gitignore`, do repo trafia tylko `site/data.json`.
2. Repo → Settings → Pages → Source: **GitHub Actions**.
3. Każdy push zmieniający `site/` publikuje stronę pod `https://<login>.github.io/<repo>/`.

Aktualizacja: `./update.sh` (patrz wyżej), który commituje `data.json` i robi push.

> Darmowe GitHub Pages wymaga **publicznego** repo, więc `data.json` (imiona, godziny piw,
> treść odrzuconych postów) i zdjęcia z `site/media/` są widoczne dla każdego. Treści zwykłych wiadomości nie ma w pliku,
> tylko posty z licznikiem. Jeśli wolicie prywatnie: Cloudflare Pages z prywatnym repo + Cloudflare Access.

## Zasady liczenia (`config.json`)

| Opcja | Domyślnie | Co robi |
|---|---|---|
| `photo_window_sec` | 180 | Zdjęcie/wideo (nie gif) ±3 min od numeru |
| `photo_fallback_sec` | 1800 | Gdy nic w oknie: niewykorzystane zdjęcie autora do 30 min wcześniej („To się liczy?” … „129”) |
| `photo_same_sender` | true | Zdjęcie od autora numeru. Wyjątek: ktoś wpisał numer za kumpla, który wrzucił zdjęcie bez numeru |
| `max_jump` | 12 | Największy skok licznika w jednym poście |
| `burst_sec` | 60 | Kilka numerów od jednej osoby w ciągu minuty to jeden post (35, 36, 37…) |
| `collision_window_sec` | 900 | Ten sam numer od innej osoby w tym czasie: obie dostają piwo |
| `resync_lookahead` | 3 | Numer spoza kolejności akceptowany, jeśli tyle kolejnych postów leci dalej od niego |
| `day_start_hour` | 6 | Piwa przed 6:00 liczą się do poprzedniego dnia |
| `aliases` | | Scalanie nazw: `{"Wojciech Gierulski": "Wojtek Gierulski"}` |
| `backfill` | | Piwa z poprzedniej konfy: `{"date": "2026-11-02", "beers": {"Imię": n}}` |
| `assign` | | Ręczne przypisanie luki: `{"53": "Imię Nazwisko"}` |
| `skip_messages` | | VAR: `timestamp_ms` postów do odrzucenia |
| `exclude` | | Osoby do pominięcia |

Rozpoznawane formaty: `33`, `33 🍺`, `19*` (korekta), `58,59`, `127, 128`, `131 132`, `136 i 137`,
`184-190`, numer w tekście („agent47”, „Big boss 166”, „tylko piwo 96”). W dłuższym tekście liczba musi być
dokładnie kolejnym numerem, a bez zdjęcia jest ignorowana („Czekam na 69”).

Luka (np. po 52 ktoś pisze 54): autor dostaje tyle piw, ile wrzucił zdjęć. Brakujące numery idą do osoby,
która w międzyczasie wrzuciła zdjęcie bez numeru. Jeśli nikt tego nie zrobił, dostaje je autor.
Jeśli kandydatów jest kilku, luka trafia do `review.md` do decyzji.

Test regresji na syntetycznym czacie:

```sh
python3 tools/make_sample.py /tmp/sample && echo '{}' > /tmp/c.json && \
python3 parse_export.py /tmp/sample --config /tmp/c.json --out /tmp/data.json --review /tmp/r.md
```

## Co jest na dashboardzie

- Licznik grupy, pasek do kolejnych 100 i 1000 z prognozą daty (tempo z 30 dni)
- Dzisiaj / ten tydzień / średnia / rekord dnia oraz feed dzisiejszych piw
- Ranking: tydzień, miesiąc, rok, all-time, ze zmianą miejsca vs poprzedni okres i poziomami (od „Piwnego żółtodzioba” do „Boga chmielu”)
- Piwa w czasie (dziennie / tygodniowo + średnia krocząca), wyścig skumulowany, kalendarz roczny
- Rozkład po godzinach i dniach tygodnia
- Galeria sław: rekordy dnia/tygodnia, serie, najszybszy dublet, korony tygodnia, łowca jubileuszy, nocny marek, susza
- 14 odznak (hat-trick, nocny marek, seria 5 dni, szczęśliwy numer, weekendowy wojownik…)
- Menel tygodnia, kamienie milowe (kto wbił każdą setkę), debiutanci


## Struktura kodu

```
parse_export.py        eksport FB → site/data.json + review.md (reguły liczenia)
config.json            ustawienia i ręczne decyzje (aliasy, backfill, VAR)
update.sh              cotygodniowa aktualizacja: nazwij eksporty, przelicz, opublikuj
tools/                 name_exports.py (nazwy folderów), make_sample.py + check_sample.py (test parsera)
site/index.html        układ strony
site/style.css         wygląd (kolory jasny/ciemny, karty, kufel, tabela)
site/js/main.js        start: wczytuje data.json, rysuje sekcje, motyw, tooltipy
site/js/model.js       dane: piwa, osoby, dni, tygodnie, serie
site/js/rules.js       poziomy i odznaki (tu dodajesz nowe)
site/js/format.js      liczby, daty, odmiana „piwo/piwa/piw”
site/js/ui.js          wspólne drobiazgi: awatary, przyciski, odliczanie
site/js/hero.js        baner z licznikiem i kuflem, kafelki, ostatni dzień
site/js/leaderboard.js ranking
site/js/charts.js      wykresy (Chart.js)
site/js/records.js     galeria sław
site/js/badges.js      tabela odznak i drabinka poziomów
site/js/community.js   kamienie milowe, debiutanci, menel tygodnia
site/js/lightbox.js    podgląd zdjęć
```

Bez frameworka i bez budowania: przeglądarka ładuje moduły JS bezpośrednio, więc wystarczy dowolny serwer plików.
