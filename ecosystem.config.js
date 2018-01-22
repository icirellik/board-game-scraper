module.exports = {
  apps: [{
    name: "board-game-scraper",
    script: "./index.js",
    args: "--resume --start-page=773",
    watch: false,
    interpreter: "babel-node",
    ignore_watch: ["node_modules", ".git", "bgg.*"]
  }]

}
