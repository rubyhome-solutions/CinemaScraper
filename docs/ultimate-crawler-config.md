# Ultimate Crawler Reference Documentation 

## Config Schema

|property|type|nullable|description|
|--------|----|--------|-----------|
|cinemasListUrl|string,array||- URL for cinemas list page from which we can parse cinemaIds dynamically. <br>- if this option is passed, nor `cinemaIds`, no `cinemas` option is needed.|
|cinemaDetailsUrlTemplate|string||URL Template for retrieving cinema details from a dedicated page. The crawler will make a separate request for each cinema.|
|cinemaDetailsResponseParser|function||Function for custom parsing of the cinema details pages, loaded as of `cinemaDetailsUrlTemplate`. See details.|
|cinemaAddressSelector|string||Selector for DOM / JSON node that contains the cinema's full formatted address|
|cinemaZipcodeSelector|string||Selector for DOM / JSON node that contains the cinema's zipcode|
|cinemaCitySelector|string||Selector for DOM / JSON node that contains the cinema's city's name|
|cinemaWebsiteSelector|string||Selector for DOM / JSON node that contains the cinema's website URL|
|cinemaLatlonSelector|string||Selector for DOM / JSON node that contains the cinema's both latitude and longitude together|
|cinemaLatSelector|string||Selector for DOM / JSON node that contains the cinema's latitude as a single value|
|cinemaLonSelector|string||Selector for DOM / JSON node that contains the cinema's longitude as a single value|
|versionBoxSelector|string||Selector for DOM / JSON node that group showtimes for a particular version of a movie. Version refers to 3D vs. 2D or different languages.|
|versionLabelSelector|string||Selector for the DOM / JSON node that contains the label of the version box, which will be used for determining showtime flags. Will first be checked relative / inside the version box, then as previous sibling of each box node and finially relative to the movieBox using the `versionIdAttribute` |
|versionLabelIdAttribute|string||Use in case the DOM nodes that contains the verion labels are too separated from the version boxes. The `versionIdAttribute` causes the ultimate crawler to build a map of version labels by the selected ID.|
|versionLabelParser|function||Function that gets passed in the versionLabelBox cheerio element selected by `versionLabelSelector` and should return a label string.|
|versionBoxIdParser|function||Used together with `versionLabelIdAttribute`. Function that gets passed in a version box as cheerio element and should return the ID to find the mapped labels as of the `versionLabelIdAttribute`.|
|versionFlagsParser|function||Function that gets passed in the label of a version and should return the flags for the showtimes in the corresponding version box. If not specified it defaults to default behaviour. See details.|
|showtimeTimeSelector|string||In case the actual time is nested in another node inside the DOM node selected by `showtimeSelector`, this one selects it.|
|showtimesResponseParser|function||Custom implementation for parsing the showtimes page. See details.|


## Details

### cinemaDetailsResponseParser

Function for expanding or overriding the parsing of a single cinema details page. 
Any field provided in the result will replaced a previous value.

#### Parameters

|Name|Type|Description|
|------|----|---|
|`responseText `| String | responseText of the current page
|`config `| Hash | Config of the ultimate crawler

#### Return 

Must return a hash with the cinema details.  

#### Template

```javascript
cinemaDetailsResponseParser: function(responseText, config) { 
	// parse page ...
	return { 
		id: ..., 
		formatted_address: ... 
	}
}
```


### showtimesResponseParser

Function for replacing or expanding the parsing of a single showtimes page. 

#### Parameters

|Name|Type|Description|
|------|----|---|
|`responseText `| String | responseText of the current page
|`pageParameters`| Hash | Parameters use to build the url for fetching the current page
|`config `| Hash | Config of the ultimate crawler

#### Return 

Must return a hash with the following keys: 

|Name|Type|Description|
|------|----|---|
|`showtimes `| Array | Showtimes parsed from the given page
|`isAdditional `| Boolean | Defines whether the showtimes should be merged with those parsed by the ultimate crawler framework (when set to `true`). When set to `false` the showtimes exclusively replace all showtimes parsing.

#### Template

```javascript
showtimesResponseParser: function(responseText, pageParameters, config) { 
	var showtimes = []
	// parse showtimes ...
	return { showtimes: showtimes, isAdditional: false }
}
```


### versionFlagsParser

Function for parsing the showtimes flags from a version box's label. The ultimate crawler already provides common flags via the `defaultsFlags` parameter. It's recommend to join addiontional flags, however the `defaultsFlags` can also be ignored as needed.  

#### Default flags 
- `is_3d`
- `is_imax` 


#### Parameters

|Name|Type|Description|
|------|----|---|
|`versionBox `|Object| Version box as cheerio element
|`label`| String | Label of a version box
|`defaultsFlags `| Hash | Flag that were already parsed by the framework

#### Template
 
```javascript
versionFlagsParser: (versionBox, label, defaultsFlags) => {
	// parse additional flags, e.g. languages
	var moreFalgs = {
		...
	}
	// join with default flags
	return Object.assign({}, defaultsFlags, moreFalgs)
}
```
