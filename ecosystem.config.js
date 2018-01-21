module.exports = {
  apps: [{
    name: "board-game-scraper",
    script: "./index.js",
    watch: true,
    interpreter: "babel-node",
    ignore_watch: ["node_modules", ".git", "bgg-details.*"]
  }]
}
