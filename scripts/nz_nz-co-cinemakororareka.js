const ultimateCrawler = require('../ultimate-crawler')

const config = {
  
  cinemas: {
    'cinemakororareka': {
      website: 'http://cinemakororareka.co.nz',
      name: 'cinemakororareka',
      formatted_address: '9 York St, Russell 0202, New Zealand'
      latlong: [-35.2627142,174.1205705],
      telephone: '021 022 33 888'
    }
  },
  urlTemplate: 'http://cinemakororareka.co.nz/',
  movieBoxSelector: 'div.et_pb_section ',
  movieTitleSelector: 'div.et_pb_column_1_4 p span',
  showtimeSelector: 'div.et_pb_column_1_2 p span',
  showtimeFormat: 'dddd Do MMMM ha',
}

if (require.main === module) { 
  ultimateCrawler.crawl(config)
}

module.exports = config
