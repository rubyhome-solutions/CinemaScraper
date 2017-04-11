const ultimateCrawler = require('../ultimate-crawler')

const config = {
  
  cinemas: {
    'limelightcinema': {
    website: 'http://www.limelightcinema.co.nz',
    name: 'limelightcinema',
    formatted_address: '239 Thames Street, Oamaru New Zealand'
    }
  },
  urlTemplate: 'http://www.limelightcinema.co.nz/session_times.php',
  movieBoxSelector: 'ul.times li',
  movieTitleSelector: 'h2 a',
  dateSelector : 'ul.sessions li strong',
  dateFormat: 'dddd D MMM',
  showtimeSelector: 'ul.sessions li a, ul.sessions li > a',
  showtimeFormat: 'h:mma',
}

if (require.main === module) { 
  ultimateCrawler.crawl(config)
}

module.exports = config



// http://www.cinemaparadiso.co.nz/beauty-and-the-beast/
// http://www.cinemaparadiso.co.nz/

// https://scrapy.internationalshowtimes.com/#!index.md
// login is 
// user: scrapy
// password: 23_uipY3VmjamKh1