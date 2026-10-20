# PokéTicker

A personal Pokémon card market tracker, portfolio, sold-price log and shop toolkit. It runs entirely in your browser and installs on a phone's home screen.

**App:** https://duskwardstudio.github.io/PokeTicker/

## How it works

- `index.html`, `*.js`, `style.css` — the app. Everything you enter (cards, costs, sales, notes) is stored **only in your own browser/device**; nothing is uploaded anywhere.
- `engine/update.py` — a small Python script. `.github/workflows/prices.yml` runs it once a day on GitHub. It downloads TCGplayer market prices (USD) through [tcgcsv.com](https://tcgcsv.com), keeps a rolling price history, and publishes the result to the `data` branch. The app downloads those public files.
- The workflow uses no third-party actions — only `git` and `python3` — and only has permission to write to this repository.

## Setup notes

- Optional phone alerts: create a repository secret `NTFY_TOPIC` (Settings → Secrets and variables → Actions) containing a long random topic name, then subscribe to that topic in the free [ntfy](https://ntfy.sh) app. The daily job then sends a short “biggest movers” message.
- Turn on two-step sign-in (2FA) for the GitHub account that owns this repository: whoever controls the repository controls the code your phone runs.

## Data and attribution

Prices come from TCGplayer via tcgcsv.com. PokéTicker is an independent personal tool and is not affiliated with or endorsed by TCGplayer, Nintendo, Creatures Inc., GAME FREAK or The Pokémon Company. Outlooks and idea scores are rough rule-of-thumb estimates, not financial advice.
