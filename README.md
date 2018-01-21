# board-game-scraper
A crawler that scraps and downloads all data from board game geek.

## Development

Sanity checks

```
# These should be equal.
$ cat bgg-details.1/games-loaded.json | jq --raw-output '.[]' | sort | uniq | wc -l
$ cat bgg-details.1/game-details.txt | wc -l
```
