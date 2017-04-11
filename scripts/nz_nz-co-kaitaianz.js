const ultimateCrawler = require('../ultimate-crawler')

const config = {
  
  cinemas: {
    'kaitaianz': {
      website: 'http://www.kaitaianz.co.nz',
      name: 'kaitaianz',
      formatted_address: '19 South Rd, Kaitaia 0410, New Zealand'
      latlong: [-35.117394,173.26791],
      telephone: '0800 920029'
    }
  },
  urlTemplate: 'http://www.kaitaianz.co.nz/cinema',
  movieBoxSelector: 'div.pzarc-panel_cinema',
  movieTitleSelector: 'header.entry-header h1',
  showtimeSelector: 'li > strong',
  showtimeFormat: 'dddd, D MMMM YYYY - h.mma',
}

if (require.main === module) { 
  ultimateCrawler.crawl(config)
}

module.exports = config
