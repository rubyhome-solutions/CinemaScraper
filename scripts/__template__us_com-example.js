const ultimateCrawler = require('../ultimate-crawler')

const config = {
  // START HERE


}

if (require.main === module) { // only run from CLI
  ultimateCrawler.crawl(config)
}

module.exports = config
