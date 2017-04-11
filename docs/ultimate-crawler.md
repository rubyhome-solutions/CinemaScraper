Ultimate crawler
=========================== 


## Debugging
  Ultimate Crawler uses "debug" package: 
  https://github.com/visionmedia/debug

  Example usage: `DEBUG=selection*,result* node scripts/us_com-yourneighborhoodtheatre.js`

#### Debug Options

- `selection:cinemas` outputs matching of cinemas related html or json selectors 
- `selection:movies` outputs matching of movie related html or json selectors 
- `selection:showtimes` outputs matching of movie related selectors 
- `result*` - show all result outputs
- `result:cinemas` - outputs dynamic scraped cinemas result
- `result:movies` - outputs scraped movies result while iterating through cinemas
- `result:showtime` - outputs scraped showtimes results


## Config Options

#### `traverseDepthFirst` 
- flag to indicate if the crawler (cheerio library) should make Depth-first traversing. Default is false.

#### `is_booking_link_capable` 
- flag to indicate if the crawler is supposed to include `booking_link`s. 
- used for internal KPI #4

#### `preserveCookies` 
- flag to control if cookies should be preserved between requests. 
- `utils.deleteCookies` can be used to delete cookies inbetween (can be useful if cinemas with different domains are crawled by one crawler)

#### `useStrictMode`
- if this is set to true dates will be parsed in strict mode, which means that the showtime has to match exactly with the given format
- especially usefull if a website uses different formats

#### `auditoriumSelector`
- a selector of auditorium name node.

#### `auditoriumAttribute`
- indicates DOM node attribute of `auditoriumSelector`
- by default it's DOM node content text.

#### `auditoriumParser`
- a function to parse an auditorium name. Takes the text retrieved by the `auditoriumSelector` and should return the clean auditorium name.

#### `bookingDataAttribute`
- HTML attribute name of `showtimeSelector` node that contains booking link.

#### `bookingIdSelector`
- a selector used when there is a booking button, separately from actual showtime.

#### `bookingIdAttribute`
- used along with **`bookingLinkTemplate`**, indicates DOM node attribute of `bookingIdSelector`
- by default it's DOM node content text.


#### `bookingLinkTemplate`
- we can create a template for booking link, if showtimes have only part of the actual URL, or "bookingId". We can pass parameters:
  - `:bookingId` - booking ID, retrieved by `bookingIdSelector`.
  - `:movieId` - movie ID, retrieved by `movieIdSelector`.
  - `:date` - date string.
  - `:time` - time string.
  - example: `http://www.uecmovies.com/products/tickets?tid=:cinemaId&perfID=:movieId&perfd=:date&perft=:time&rtsid=:bookingId`

#### `bookingIdParser`
- a function to parse a booking id. Takes the text extracted from the **`bookingIdSelector`** (or **`bookingIdSelector`**) as an argument and should return the booking id.

#### `charset`
- Expected encoding for requests. E.g. 'binary', 'iso-8559', 'utf-8' (default).
- **`cinemasListCharset`: Overwrites encoding for `cinemasListUrl`.
- **`cinemaDetailsCharset`: Overwrites encoding for `cinemaDetailsUrlTemplate`.
- **`moviesListCharset`: Overwrites encoding for `moviesListUrl`.
- 

#### `cinemas`
- contains static cinema data:
  - `name` - cinema name
  - `formatted_address` - cinema formatted address
  - `slug` - slug name for cinema, used in output json filename 
  - `website` - cinema website url
  - `program` - cinema program page. An alternative to `urlTemplate`, if a cinema has different program url, that doesn't fit a template.
  - `filterByAuditorium` - RegExp expression to include only matching showtimes by auditoriom name. Useful when one program page has showtimes for multiple cinemas.
- if we use dynamic `cinemasListUrl` it is **not needed**
- the key of cinema is used as **cinemaId**
- example 
```
    cinemas: {
      'schorndorf-traumpalast': { 
        website: 'http://schorndorf.traumpalast.de', 
        name: 'Traumpalast Schorndorf',
        program: 'http://schorndorf.traumpalast.de/index.php/PID/3535.html'
      }
    }
```

#### `cinemaDetailsUrlTemplate`
- defines a template url where cinema details can be fetched if they are not present on the program page.
- takes precedence over program page content for the following selectors:
  `cinemaNameSelector`
  `cinemaSlugSelector`
  `cinemaMappedIdSelector`
  `cinemaAddressSelector`
  `cinemaTelephoneSelector`
  `cinemaLatlonSelector`

#### `cinemaIds`
- can be an array of cinema ids
- can be an array of cinema urls, if the chain has each cinema on its own domain


#### `cinemaIdToSlug`
- a function that takes cinemaId and returns slug used as json filename. Only needed if json filename must be different than cinemaId, and its not hardcoded in `cinemas` hash slug field.


#### `cinemasListUrl`
- URL for cinemas list page from which we can parse cinemaIds dynamically.
- if this option is passed, nor `cinemaIds`, no `cinemas` option is needed.
- **`cinemasListPageformat: 'json'`** - Similiar to `format`, but for cinemas list page
- **`cinemasListPageParser`** - function that help to modify the cinemas list page. Takes whole page as a string and returns a modified version.
- **`cinemaBoxSelector`** - selector for cinema data box
- **`cinemaNameSelector`** - selector for DOM node that contains cinema name
- **`cinemaAddressSelector`** - selector for DOM node that contains cinema address
- **`cinemaIdSelector`** - selector for DOM node that contains cinemaId
- **`cinemaIdAttribute`** - attribute name of cinema DOM node that contains cinemaId
- **`cinemaSlugSelector`** - selector for cinema slug that will be used as a output filename. 
- **`cinemaLatlonSelector`** - selector for cinema coordinates
- **`cinemaLatlonAttribute`** attribute name of cinema DOM node that contains cinema coordinates
- **`cinemaIdParser`**: a function that gets cinemaId parameter and returns parsed cinemaId
  - useful if the content in `cinemaIdAttribute` is not clean ID.
- **`cinemaNameParser`**: a function that works as above, but for cinema name.
- **`cinemaSlugParser`**: a function that works as above, but for cinema slug.
- **`cinemaAddressParser`**: a function that works as above, but for cinema address.
- **`cinemaLatlonParser`**: a function that works as above, but for cinema coordinates. Should output a string with coordinates separated by comma, for example: `52.5264625,13.2722332`

#### `dateSelector`
- selector for showtime date.
- relative to: `movieBoxSelector` or `dateBoxSelector` (if `groupedByDate` enabled)
- If showtimes themselfs contain the date - it's **not needed**.
- If url template was build using `:date` parameter - it's **not needed**, because all showtimes on the page contain the same date.
- HTML node with `dateSelector` can be a parent or previous sibling for showtimes nodes.
- **`dateFormat`** - Momentjs date format for `dateSelector` content. If an array is provided all formats will be tested until a match is found.
- **`dateLocale`** - Momentjs locale for `dateSelector` content (default: **en**). Can be used to parse localized dates.
- **`dateParser`** - a function to parse a date. Takes the text retrieved by the `dateSelector` and should return a date from it.

#### `delayEveryRequestInSeconds`
- set this as a configuration to deleay every request
- integer value sets seconds of delay
- if not set, crawler will perform 10 concurent requests at a time

#### `format: 'json'`
- used when we have JSON responses instead of HTML pages. 
- when this is set, the selector fields must be in [JsonPath](http://goessner.net/articles/JsonPath/) format, instead of CSS.
- **`jsonPreprocess`** - a function that takes whole json response and return a modified version (equivalent to `programPageParser`)
- useful when html contains bugs and we must fix them for cheerio to work properly
- **`rawJsonPost: true`**
  - set this option if request POST params set in `postParamsTemplate` should be send as json string, i.e. not be converted to Query String format.


#### `groupedByDate: true`
- pass this option if showtimes are grouped by date instead of movie box.
- **`dateBoxSelector`** - selector for the collection of date boxes, containing showtimes (relative to: html root)
- example: http://shortwavecinema.com/Shortwave.dll/Home

#### `includeCinemaIds`
- when set to `true` cinema ids will be included in the output file's cinema data
- should only be enabled if the cinema ids are those used be the websites system and not made up for crawling perpose 

#### `languageSelector`
- selector for DOM node containing language, use with `languageMap`
- **`languageMap`** - option that maps content of `languageSelector` node to language code
  - map key accepts regexp string wrapped in /.../
  - if multiple keys are matching only the last one will be applied, so for cases like 'VO English-spoken' it makes sense to start with the generic rule ('VO': 'original language') followed by the more precise one ('English': 'en')
  - example: 
  ```
  {
    'D': 'de',
    '/Sprache: [.+]E/': 'en',
  }
  ```
  
### `languageAttribute`
- HTML attribute name of languageSelector node that contains language.
- only needed when language is not a text inside languageSelector node.


#### `movieBoxSelector`
- selector for the collection of movie boxes, containing showtimes
- relative to: html root


#### `movieIdSelector`
- a selector to retrieve movieId. Can be later used as `:movieId` in url templates (only `bookingLinkTemplate` is suuported for now).


#### `movieIdAttribute`
- indicates DOM node attribute of `movieIdSelector`

#### `movieIdParser`
- a function to parse a movie id (e.g. from a link). Should return the id to use in url template.


#### `movieTitleSelector`
- selector for movie title
- relative to: `movieBoxSelector`

#### `movieTitleAttribute`
- indicates DOM node attribute of `movieTitleSelector `


#### `movieTitleParser`
- a function to parse movie title. Takes title as an argument and should return parsed title.


#### `moviesListUrl`
- URL that contains currently played movies in the cinema
- useful when `urlTemplate` needs `:movieId` parameter
- supports parameters `:cinemaId` and `:page`. The latter iterates through all pages (1,2,3..) until no more movies are added. `moviesPageMapper` can be used to modify the page value.
- **`moviesListPageformat: 'json'`** - Similiar to `format`, but for movies list page
- **`moviesListPageParser`** - function that help to modify the movies list page. Takes whole page as a string and returns a modified version.
- **`moviesListSelector`** - selector for movies list containing movie ids.
- **`moviesListIdSelector`** - HTML node that contains the movie id (Optional, result of moviesListSelector will be used instead).
- **`moviesListIdAttribute`** - HTML node attribute that contains the movie id.
- **`moviesListIdParser`** - a function to parse a movie id (e.g. from a link). Should return the id to use in url template.
- **`moviesListTitleSelector`** - It can happen that the movie title can only be retrieved through the moviesListUrl. In this case this selector can be used to select the HTML node containing the movie title. If used it is not required to define a `movieTitleSelector`. Works in combination with `movieTitleParser`.
- **`moviesListTitleAttribute`** - HTML node attribute that contains the movie title.


#### `outputFilenamePrefix`
- here we can change the prefix of output filename
- by default it is: [crawler script filename]_
- if we set it to `false`, the prefix will be turned off.


#### `postParamsTemplate`
- if this option is set, the request for program will be POST instead of GET
- we can pass the same parameters here as in `urlTemplate`
- example: `day=:date&cinema=:cinemaId`
- example when `rawJsonPost` option is set: `{"QueryDate":":date","LocationID":":cinemaId"}`


#### `programPageParser`
- a function that takes whole program page string html as a parameter and returns parsed string html
- useful when html contains bugs and we must fix them for cheerio to work properly


#### `proxyCountry`
- ISO 3166 country code. Set it to the country of scraping webpage if it is geo blocking the crawler


#### `showtimeSelector`
- selector for a showtime collection
- **`showtimeFormat`** - Momentjs date format for `showtimeSelector` content. If an array is provided all formats will be tested until a match is found.
- **`showtimeAttribute`**
  - HTML attribute name of `showtimeSelector` node that contains showtime.
  - **only needed** when showtime is not a text inside `showtimeSelector` node.
- **`showtimeDelimiter`** - used when many showtimes are placed all in one DOM node. This delimiter separates them. Examples: '|', 'br'
- **`showtimeParser`** - a function to parse a showtime. Takes the text retrieved by the `showtimeSelector` and should return the showtime part from it.


####  `showtimeDateTableMode: true`
- used when `dateSelector` does not directly preced showtime nodes for the date, but it's a set of date nodes, *relative* to sets of showtimes for that dates.
- **`showtimeDateTableByRow: true`** - special case table - when each showtime is placed in a separate table row and cell
- **`showtimeDateGroupSelector`** - selector for showtimes boxes, that contain showtimes for one date. 
- example: https://esslingen.traumpalast.de/index.php/PID/3496.html


#### `subtitlesSelector`
- selector for DOM node containing subtitles, use with `subtitlesMap`
- **`subtitlesMap`** - option that maps content of `subtitlesSelector` node to subtitle language codes
  - map key accepts regexp string wrapped in /.../
  - example: 
  ```
  {
    '/Sprache: [.+]f/': 'fr',
    'i': 'it',
    'e': 'es',
  }
  ```

#### `urlTemplate`
- URL template that contains program. It accepts parameters:
  - `:cinemaId` - a cinema key in `cinemas` object.
  - `:date` - if passed, then the URL will be called multiple times, once for each day in the next week (or as speficied in parameter **`requestDaysCount`** )
    - **`urlDateFormat`** - use this field to set momentjs date format string that will be used as `:date` parameter.
  - `:weekId` - used when program page is per week.  
    - if passed, then the URL will be called once per each weekId
    - Available week ids we should pass as a separate option like this: **`weekIds: [0, 1]`** 


#### `urlToFilename: true`
- we can set this option to automatically convert cinema urls fo output filenames if we gave list of urls into `cinemaIds`

#### `headers`
- allows passing of additional headers for requests.
- example: 
  ```
  {
    'X-Requested-With': 'XMLHttpRequest',
  }

