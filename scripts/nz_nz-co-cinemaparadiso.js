const ultimateCrawler = require('../ultimate-crawler')

const config = {
  
  cinemas: {
    'cinemaparadiso': {
    name: 'cinemaparadiso',
    formatted_address: '112 Main Street Methven 7730',
    website: 'http://www.cinemaparadiso.co.nz/'
    }
  },
  moviesListUrl: 'http://www.cinemaparadiso.co.nz/category/now-showing/',
  moviesListSelector: '.iso-container > .iso-item',
  moviesListIdSelector: 'h3 a',
  moviesListIdAttribute: 'href',

  urlTemplate: ':movieId',

  movieBoxSelector: '.entry-content',
  movieTitleSelector: 'h1',

  showtimeSelector: '.vc_row-has-fill p:contains(am), .vc_row-has-fill p:contains(pm)',
  showtimeFormat: 'ha dddd Do MMMM',
  // showtimeParser : show => show.replace(/\s/g, ' ')
  showtimeParser : show => {
    show = show.replace(/\s/g, ' ').trim()
    if(show.indexOf('&') != -1){
      // var showParts = show.split('&').map(showPart => showPart.trim())
      // var day = showParts[1].split('m')[1]
      // var time1 = showParts[0] + day
      // var showlist = []
      // showlist.push(time1)
      // showlist.push(showParts[1])
      // console.log("time1------------", time1)
      // return time1
      var showParts = show.split('&').map(showPart => showPart.trim())
      var date = showParts[showParts.length - 1].split(' ').splice(1).join(' ')
      showParts[showParts.length - 1] = showParts[showParts.length -1].split(' ').splice(0,1)
      return showParts.map(show => show + ' ' + date)
    }
    return show
  }
}

if (require.main === module) { // only run from CLI
  ultimateCrawler.crawl(config)
}

module.exports = config
