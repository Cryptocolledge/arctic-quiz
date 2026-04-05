# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**КвизЦентр** — мультиплеерная квиз-платформа для живых мероприятий. Ванильный JS + Supabase (PostgreSQL + Realtime). Никакой сборки, никаких фреймворков.

Открывай файлы прямо в браузере (`file://`) или через любой статический сервер. `python -m http.server 8080` достаточно для локальной разработки.

## Testing

Тесты скоринговой логики — `test.html`. Открой в браузере, запускаются автоматически. 28 тестов покрывают `pts()`, streak/бонусы, штрафы за смену ответа, REVEALED-защиту.

При изменении функций `pts()`, `onOpt()`, `revealAnswer()` или `resetQuiz()` в `hub.html` — обязательно синхронизируй копию `pts()` в `test.html`, `presenter.html` и `projector.html`, перепрогони тесты. Каноническая форма: `function pts(d){return !d||d<=1?1:d===2?2:3;}` (с `!d||` guard).

## Array Sync (hub ↔ presenter)

**Оба файла** (`hub.html` и `presenter.html`) содержат одинаковые массивы вопросов. Несовпадение индексов ломает игру. Синхронизировать нужно **три типа массивов**:

- **Основные вопросы**: `Q_SCHOOL`, `Q_SPO`, `Q_ECO_SCHOOL`, `Q_ECO_SPO`, ... (Arctic использует `Q_SCHOOL`/`Q_SPO`, остальные — с префиксом квиза)
- **Блиц-массивы**: `Q_BLITZ_SPO`, `Q_BLITZ_SCHOOL`, `Q_ECO_BLITZ`, `Q_HISTORY_BLITZ`, ... (по 10 вопросов)
- **Ставки**: `Q_BET_SPO`, `Q_BET_SCHOOL` и аналоги с суффиксом `_BET`

При добавлении вопросов в любой из этих массивов — внести то же изменение в оба файла.

**Соло-массивы** (`Q_SOLO_ARCTIC`, `Q_SOLO_ECO`) — только в `hub.html`, в `<script id="soloQData">` блоке перед основным скриптом. Не синхронизировать с presenter. Эти массивы изолированы от мультиплеерных пулов — намеренно, чтобы игрок не мог запомнить ответы через соло и использовать их в игре с ведущим.

## Architecture

```text
Игроки (hub.html) ──────────────┐
Проектор (projector.html) ──────┼── Supabase quiz_state ◄── Ведущий (presenter.html)
Наблюдатель (observer.html) ────┘
```

Ведущий пишет в `quiz_state` через `ups({...})`. Остальные читают:

- `hub.html`, `observer.html` — Supabase Realtime-подписки
- `projector.html` — polling `getState()` каждые 1–2 с

## Key Files

| Файл | Роль |
|------|------|
| `hub.html` | Игрок: регистрация, ответы, скоринг, чат (~5000+ строк) |
| `presenter.html` | Ведущий PWA: управление игрой, таймер, раунды |
| `projector.html` | Большой экран: вопрос + таймер + анимации |
| `observer.html` | Пассивный просмотр |
| `admin.html` | Управление сессиями, сброс БД |
| `arctic-odyssey.html` | Автономная одиночная игра (независима от Supabase) |
| `partisan-game.html` | Canvas-аркада «ВЕЧНЫЕ МСТИТЕЛИ · 1942», модули в `/js/` |
| `test.html` | Авто-тесты скоринга |
| `debug.html` | Валидатор схемы Supabase |

## Supabase Configuration

`SURL` и `SKEY` (anon key) прописаны в начале каждого из трёх главных файлов (`hub.html` ~строка 1433, `presenter.html`, `projector.html`). Все три должны содержать одинаковые значения.

Таблицы:

- **`quiz_state`** — текущее состояние: `phase`, `current_index`, `show_answer`, `round_type`, `quiz_id`, `shuffle_seed`, `question_visible`, `game_timer`, `question_started_at`, `session_code`, `music_playing`, `music_broadcast`
- **`quiz_scores`** — `game_id, student_name, team_name, score numeric(5,1), questions_answered, avg_answer_time`
- **`quiz_chat`** — чат, свободные ответы 100к1, и статистика ответов (`msg_type='answer_stat'`, message=JSON `{q, ok}`)

## Game Phases

`phase` в `quiz_state` управляет всеми экранами:

| Phase | Состояние |
|-------|-----------|
| `waiting` | Ожидание — проектор показывает idle-экран с DRIVE музыкой (без кода игры) |
| `intro` | Вступительное шоу на проекторе (Startgame.mp3 + анимация) |
| `howtoplay` | Экран правил игры на проекторе — автозапуск Rulesgame.mp3, показывает `session_code`, скрывается по окончании аудио → возврат на idle с кодом |
| `running` | Активный вопрос |
| `paused` | Пауза |
| `scoreboard` | Таблица очков (каждые ~10 вопросов) |
| `ended` | Игра завершена (Endgame music.mp3) |
| `survey_0..N` | Раунд «100 к 1», N = номер раскрытого ответа |

`round_type`: `'' / blitz_start / betting_chips / betting_open / betting_reveal`

**Важно**: в `ups()` в presenter в base-объекте `phase` вычисляется из `lastState` и фильтруется по известному списку — значения вне списка (`howtoplay` и др.) всё равно применяются через patch-spread. Добавляя новый phase, не нужно трогать `ups()`.

**hub.html и phase**: при добавлении нового phase нужно явно обработать его в `applyState()` в hub.html. Необработанный phase падает в ветку `running` и рендерит вопрос. Текущие исключения: `intro` и `howtoplay` трактуются как `waiting` (показывают панель ожидания).

## Scoring Logic (hub.html)

```js
function pts(d){ return !d||d<=1 ? 1 : d===2 ? 2 : 3; }
```

- Очки начисляются **сразу** в `onOpt()` при правильном ответе (оптимистично)
- `REVEALED` Set — защита от двойного начисления при последующем `revealAnswer()`
- `streak`: серия правильных; каждые 3 → +0.5 бонус; каждые 5 → `tryStealFromTop()` (−1 у лидера)
- `penalty`: 1-я смена ответа бесплатна; со 2-й — каждая смена −0.5; `earned = max(0, pts − penalty)`
- Сброс серии: `streak=0` при неверном ответе и в `resetQuiz()`
- **Восстановление очков**: `loadSavedScore()` вызывается при первом `syncLoop()` — тянет `score` и `questions_answered` из `quiz_scores` если `score > 0`

## Timer Sync

- `QT` — длительность (15/20/25/30/45/60 с, по умолчанию 25)
- `presSetTimer(t)` в presenter — устанавливает QT, пушит `game_timer` в БД, подсвечивает кнопку
- `question_started_at` (UTC timestamp) — все клиенты считают `elapsed = now − started_at`, остаток = `QT − elapsed`
- **Anti-spoiler** (очный режим, `doDelay`): 5-сек обратный отсчёт перед вопросом; таймер сдвигается: `startTimer(new Date(parseIso(at) + 5000).toISOString())`
- **Ресинк при сбросе**: projector отслеживает `lastStartedAt`. Если `question_started_at` изменился при том же `current_index` (сброс игры → повторный старт с idx=0), вызывается `renderQ` заново и таймер рестартует.

## Question Types

`text` — 4 варианта | `svg` — с иллюстрацией | `rebus` — ребус | `survey` — 100к1 со свободным ответом

## Special Rounds

### Блиц (`round_type = "blitz_start"`)

Ведущий устанавливает `round_type = "blitz_start"` один раз — дальше всё идёт **только на клиенте** (hub.html). Суть:

- `startPlayerBlitz(0)` → `playBlitzStart()` + `showAnnounce("blitz", cb)` → 12-секундный анонс с частицами ⚡ → `blitzState = {qi:0,...}` → `renderPlayerBlitz()`
- Каждый вопрос: 10 сек таймер, `onBlitzAnswer()` → `autoNextBlitz()` через 1.8 с
- По окончании: `score += correct * 0.5`, `pushScore()`, обновляются `scoreEl`/`score2El`
- `lastRoundType` не сбрасывается пока `round_type` остаётся "blitz_start" → повторного запуска не будет
- Guard: `if(!ovBlitz.classList.contains("active"))startPlayerBlitz(0)` — защита от перезапуска при повторном `applyState()`

### Ставки (`betting_chips → betting_open → betting_reveal`)

Управление через `round_type`, логика на клиенте в `hub.html`. Ставка 0–3 очка; выигрыш/проигрыш = ±ставка.

- Анонс: `playBetStart()` + `showAnnounce("betting", cb)` — 12 с с частицами 💎🃏🎲

### Анонс раунда (`showAnnounce(type, cb)`)

Оверлей `#ov-announce` используется для обоих раундов. Для перезапуска анимации карточки: `card.style.animation="none"; void card.offsetWidth; card.style.animation=""`. Частицы инжектируются в `#announce-particles` и очищаются при закрытии.

## Sound System

### hub.html (игрок)

Все звуки — MP3-файлы из корня проекта, лениво создаются через `_playSnd(key)`:

- `playOk()` → `respuesta-correcta.mp3` — правильный ответ
- `playErr()` → `wrong-1.mp3` — неправильный ответ
- `playDone()` → `Endgame music.mp3` — конец игры
- `playBlitzStart()` → `Blic new.mp3` — начало блица
- `playBetStart()` → `Stavki new.mp3` — начало ставок

Тики таймера и системные сигналы (`playTick`, `playAlert`, `playTimeUp`) — Web Audio API.

Фоновая музыка (онлайн): `_bgAudio` — управляется через `music_broadcast` в `quiz_state` (ведущий включает через панель). В очном режиме музыку воспроизводит **проектор**, не hub.

Онлайн шоув-вступление (`_hubShowIntro`): при первом вопросе в онлайн-режиме (`shuffle_seed===0`, `idx===0`, `lastPhase==="waiting"`) — оверлей `#ov-online-intro` с `Startgame.mp3`.

### projector.html (большой экран, очный режим)

Проектор отвечает за весь ambient-звук при очном режиме:

| Событие | Файл |
| ------- | ---- |
| `phase=waiting` | `DRIVE(chosic.com).mp3` (loop, idle-экран) |
| `phase=intro` | `Startgame.mp3` (вступительное шоу) |
| `phase=howtoplay` | `Rulesgame.mp3` (озвучка правил, автозапуск) |
| `phase=running` (фон) | `Mike_Oldfield_-_Amarok_1990_66104094.mp3` (loop) |
| `round_type=blitz_start` | `Blic new.mp3` (фанфара) |
| `round_type=betting_chips` | `Stavki new.mp3` (фанфара) |
| `phase=ended` | `Endgame music.mp3` |

hub.html скипает ambient-звуки в очном режиме (`shuffle_seed > 0`): `playBetStart()`, `playBlitzStart()` не вызываются.

**Управление звуком из presenter**: два отдельных поля. `music_playing` (boolean) — мутирует/размутирует ambient-звук проектора (`_projBg`, `_idleAudio`) через `_projMuteAll()` / `_projUnmuteAll()`; флаг `_projAudioMuted` хранит состояние. `music_broadcast` (string | null) — имя трека, транслируемого ведущим; hub.html читает его и запускает/останавливает `_bgAudio` в онлайн-режиме.

## Projector Overlay System

Проектор имеет четыре полноэкранных оверлея (z-index по приоритету):

1. **`#ov-idle`** (z-index 40) — фоновый экран при `phase=waiting`. Показывает лого, название квиза, аврора-анимацию. Код игры (`#idle-code-block`) скрыт до интро; появляется после `howtoplay` когда `showIdleOverlay()` вызывается с session_code. Играет `DRIVE(chosic.com).mp3`.
2. **`#ov-intro`** (z-index 100) — вступительное шоу по кнопке `🎬 Шоу!` у ведущего (`phase=intro`). Радужный заголовок, частицы, сканлайн. Играет `Startgame.mp3`. После окончания — возвращается к idle.
3. **`#ov-howtoplay`** (z-index 90) — экран правил игры (`phase=howtoplay`), кнопка `📖 Правила`. При показе автоматически запускает `Rulesgame.mp3` и показывает `session_code` (`#htp-code-block`). Когда аудио заканчивается (`_howToPlayAudioDone=true`): overlay скрывается, проектор возвращается на idle с кодом. Guard: пока `_howToPlayAudioDone=true` и phase ещё `howtoplay`, `hideIdleOverlay()` НЕ вызывается — иначе следующий polling-тик убил бы только что показанный idle.
4. **`#scoreboardOv`** (z-index 80) — промежуточный скорборд.

Флаг `_lastProjPhaseWasIntro` предотвращает зацикливание: `_introShown` сбрасывается только при смене phase с `intro` на что-то другое.

## Presenter Access

`presenter.html` защищён паролем (`PRESENTER_PWD = "arctic2025"`, строка ~3488). При каждом открытии показывает форму входа — `_presCheckAuth()` всегда возвращает `false`. После успешного входа вызывается `initPrep()`.

## Presenter Features

### Кнопки управления (топбар)

- `🎬 Шоу!` (`btnIntro`) → `triggerIntro()` → `ups({phase:"intro"})` — запускает вступление на проекторе
- `📖 Правила` (`btnHowToPlay`) → `triggerHowToPlay()` → `ups({phase:"howtoplay"})` — показывает экран правил с озвучкой
- `🔊 Звук проектора` (`btnProjMute`) → `toggleProjMute()` — мутирует/размутирует ambient-звук на проекторе через `music_playing` в БД
- `🎵 Музыка` (`btnMusicPanel`) → `toggleMusicPanel()` — открывает панель плейлиста; все кнопки управления (▶/⏸, ⏹, ⏮, ⏭) находятся **внутри панели**, отдельной кнопки в топбаре нет
- `🖥 ОЧНО` (`btnMode`) — переключает режим (очный/онлайн)

### Статистика ответов

`refreshAnswered()` — поллинг каждые 2 с. Помимо счётчика ответивших, показывает ✅/❌ статистику текущего вопроса через `quiz_chat` с `msg_type='answer_stat'`. Дедупликация: берётся **последний** ответ каждого игрока на текущий вопрос.

`questions_answered` в `quiz_scores` = `Math.max(qAnswered, curIdx + 1)` — чтобы корректно работало после перезагрузки страницы.

### 100к1 маркеры

`renderQ(idx)` в presenter показывает:

- Жёлтый баннер `survey-cur-warn` если текущий вопрос — survey
- Превью следующего survey-вопроса (`survey-next-warn`)
- Чип `🎲 100к1` в `qChipType`

## Projector Animations

`@keyframes`: `shimmer`, `dragPulse`, `qEntrance`, `optReveal`. Вход вопроса — `q-entrance` класс на `#qBlock`, сбрасывается через `void offsetWidth` для перезапуска. Варианты ответа появляются с stagger 0/60 мс.

Intro-анимации CSS: `introTitleReveal`, `introTitleShimmer`, `introLineExpand`, `introSubReveal`, `introFadeOut`, `introBurstPulse`, `introScan`, `introPreReveal`, `introPulse`.

**Частицы intro** — реализованы через `<canvas>` + `requestAnimationFrame` (функция `_introSpawnParticles`). RAF-хэндл хранится в `_introCanvasRAF` и отменяется в `_hideIntroOverlay()`. Не использовать DOM-элементы с CSS-анимациями для частиц — это создаёт 90+ анимированных слоёв и тормозит проектор.

`introParticle` и `introStarPulse` keyframes оставлены только для **idle-частиц** (emoji + dots в `_spawnIdleParticles`).
