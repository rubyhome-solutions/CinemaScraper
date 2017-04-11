const ultimateCrawler = require('../ultimate-crawler')

const config = {
  cinemas: {
    'burgkino': {
      name: 'Burg Kino',
      formatted_address: 'Opernring 19, 1010 Vienna',
      website: 'https://www.burgkino.at'
    }
  },
  moviesListUrl: 'https://www.burgkino.at/showtimes/this-week',
  moviesListSelector: '.view-content > .views-row',
  moviesListIdSelector: 'h2 > a',
  moviesListIdAttribute: 'href',

  urlTemplate: 'https://www.burgkino.at:movieId',

  movieBoxSelector: '.region-content',
  movieTitleSelector: 'h1',

  showtimeSelector: '.views-field-field-startdatetime-1 > time',
  showtimeAttribute: 'datetime',
  showtimeFormat: 'YYYY-MM-DDTHH:mm:ssZ',

  auditoriumSelector: '.views-field-field-room-name',
  auditoriumParser: (auditorium) => auditorium.trim(),

  bookingIdSelector: '.btn-tickets',
  bookingIdAttribute: 'href',
  bookingLinkTemplate: ':bookingId',

  languageMap: {
    'OmU': 'original version',
    'OmdU': 'original version',
    'OmeU': 'original version',
  },

  subtitlesMap: {
    'OmU': 'undefined',
    'OmdU': 'de',
    'OmeU': 'en',
  },
}

if (require.main === module) { // only run from CLI
  ultimateCrawler.crawl(config)
}

module.exports = config


