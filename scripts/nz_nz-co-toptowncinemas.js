const ultimateCrawler = require('../ultimate-crawler')

const config = {

  cinemas: {
    'toptowncinemas': {
      name: 'toptowncinemas',
      formatted_address: '4 Kinross St, Blenheim, 7201, New Zealand',
      website: 'http://www.toptowncinemas.co.nz',
      latlong: [-41.5154024,173.957544]
      telephone:'+64 3-577 8273'
    }
  },
  moviesListUrl: 'http://www.toptowncinemas.co.nz/now_showing.php',
  moviesListSelector: 'ul.screenlist li',
  moviesListIdSelector: 'a',
  moviesListIdAttribute: 'href',

  urlTemplate: 'http://www.toptowncinemas.co.nz/:movieId',

  movieBoxSelector: '.content',
  movieTitleSelector: '.content > h1',
  dateSelector : 'ul li strong',
  dateFormat: 'dddd D MMM',
  showtimeSelector: 'ul li div.time',
  showtimeFormat: 'h:mma',
  showtimeParser : show => {
    if(show.indexOf(',') != -1){
      var showParts = show.split(',').map(showPart => showPart.trim())
      return showParts
    }
    return show
  } 
 }

if (require.main === module) { // only run from CLI
  ultimateCrawler.crawl(config)
}

module.exports = config
