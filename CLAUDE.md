# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**КвизЦентр** — мультиплеерная квиз-платформа для живых мероприятий. Ванильный JS + Supabase (PostgreSQL + Realtime). Никакой сборки, никаких фреймворков.

Открывай файлы прямо в браузере (`file://`) или через любой статический сервер. `python -m http.server 8080` достаточно для локальной разработки.

## Testing

Тесты скоринговой логики — `test.html`. Открой в браузере, запускаются автоматически. 28 тестов покрывают `pts()`, streak/бонусы, штрафы за смену ответа, REVEALED-защиту.

При изменении функций `pts()`, `onOpt()`, `revealAnswer()` или `resetQuiz()` в `hub.html` — обязательно синхронизируй копию `pts()` в `test.html` и перепрогони тесты.

## Architecture

```
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
| `hub.html` | Игрок: регистрация, ответы, скоринг, чат (~4700 строк) |
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
- **`quiz_state`** — текущее состояние: `phase`, `current_index`, `show_answer`, `round_type`, `quiz_id`, `shuffle_seed`, `question_visible`, `game_timer`, `question_started_at`, `session_code`
- **`quiz_scores`** — `game_id, student_name, team_name, score numeric(5,1), questions_answered, avg_answer_time`
- **`quiz_chat`** — чат и свободные ответы в режиме 100к1

## Game Phases

`phase` в `quiz_state` управляет всеми экранами:

| Phase | Состояние |
|-------|-----------|
| `waiting` | Ожидание игроков |
| `running` | Активный вопрос |
| `paused` | Пауза |
| `scoreboard` | Таблица очков (каждые ~10 вопросов) |
| `ended` | Игра завершена |
| `survey_0..N` | Раунд «100 к 1», N = номер раскрытого ответа |

`round_type`: `'' / blitz_start / betting_chips / betting_open / betting_reveal`

## Scoring Logic (hub.html)

```js
function pts(d){ return !d||d<=1 ? 1 : d===2 ? 2 : 3; }
```

- Очки начисляются **сразу** в `onOpt()` при правильном ответе (оптимистично)
- `REVEALED` Set — защита от двойного начисления при последующем `revealAnswer()`
- `streak`: серия правильных; каждые 3 → +0.5 бонус; каждые 5 → `tryStealFromTop()` (−1 у лидера)
- `penalty`: 1-я смена ответа бесплатна; со 2-й — каждая смена −0.5; `earned = max(0, pts − penalty)`
- Сброс серии: `streak=0` при неверном ответе и в `resetQuiz()`

## Timer Sync

- `QT` — длительность (15/20/25/30/45/60 с, по умолчанию 25)
- `presSetTimer(t)` в presenter — устанавливает QT, пушит `game_timer` в БД, подсвечивает кнопку
- `question_started_at` (UTC timestamp) — все клиенты считают `elapsed = now − started_at`, остаток = `QT − elapsed`
- **Anti-spoiler** (оффлайн-режим, `doDelay`): 5-сек обратный отсчёт перед вопросом; таймер сдвигается: `startTimer(new Date(parseIso(at) + 5000).toISOString())`

## Question Types

`text` — 4 варианта | `svg` — с иллюстрацией | `rebus` — ребус | `survey` — 100к1 со свободным ответом

## Projector Animations

`@keyframes`: `shimmer`, `dragPulse`, `qEntrance`, `optReveal`. Вход вопроса — `q-entrance` класс на `#qBlock`, сбрасывается через `void offsetWidth` для перезапуска. Варианты ответа появляются с stagger 0/60 мс.
