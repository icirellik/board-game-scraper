module.exports = {
  apps: [{
    name: "board-game-scraper",
    script: "./index.js",
    args: "--yes",
    watch: false,
    interpreter: "babel-node",
    ignore_watch: ["node_modules", ".git", "bgg.*"]
  }]

}
