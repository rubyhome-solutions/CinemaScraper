# Details

## cinemaDetailsResponseParser

Function for expanding or overriding the parsing of a single cinema details page. 
Any field provided in the result will replaced a previous value.

### Parameters

|Name|Type|Description|
|------|----|---|
|`responseText `| String | responseText of the current page
|`config `| Hash | Config of the ultimate crawler

### Return 

Must return a hash with the cinema details.  

### Template

```javascript
cinemaDetailsResponseParser: (responseText, config) => { 
	// parse page ...
	return { 
		id: ..., 
		formatted_address: ... 
	}
}
```


## showtimesResponseParser

Function for replacing or expanding the parsing of a single showtimes page. 

### Parameters

|Name|Type|Description|
|------|----|---|
|`responseText `| String | responseText of the current page
|`pageParameters`| Hash | Parameters use to build the url for fetching the current page
|`config `| Hash | Config of the ultimate crawler

### Return 

Must return a hash with the following keys: 

|Name|Type|Description|
|------|----|---|
|`showtimes `| Array | Showtimes parsed from the given page
|`isAdditional `| Boolean | Defines whether the showtimes should be merged with those parsed by the ultimate crawler framework (when set to `true`). When set to `false` the showtimes exclusively replace all showtimes parsing.

### Template

```javascript
showtimesResponseParser: (responseText, pageParameters, config) => { 
	var showtimes = []
	// parse showtimes ...
	return { showtimes: showtimes, isAdditional: false }
}
```


## versionFlagsParser

Function for parsing the showtimes flags from a version box's label. The ultimate crawler already provides common flags via the `defaultsFlags` parameter. It's recommend to join addiontional flags, however the `defaultsFlags` can also be ignored as needed.  

### Default flags 
- `is_3d`
- `is_imax` 


### Parameters

|Name|Type|Description|
|------|----|---|
|`versionBox `|Object| Version box as cheerio element
|`label`| String | Label of a version box
|`defaultsFlags `| Hash | Flag that were already parsed by the framework

### Template
 
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
