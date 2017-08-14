# tilestrata-postgis-geojson-tiles
Tilestrata plugin for generating geojson tiles from postgis.

### Configuration

- `geometryField` *(string, required)*: name of column containing geometry. (default = `"geom"`)
- `sql` *(function, required)*: method that returns a PostGIS query that will be executed. *Be sure to protect against sql injection if doing dynamic filtering based on the request query string.* The query can contain the following tokens:
  - `{bbox}` (box2d): the buffered tile bounding box 
  - `{geojson}` (text): the geojson representation of the clipped and simplified geometry as text
- `pgConfig` *(object, required)*: postgres connection options
  - `{host}` (string)
  - `{password}` (string)
  - `{user}` (string)
  - `{port}` (string)
  - `{database}` (string)
- `simplifyFactor` *(number, optional)*: a constant affecting how much the geometry is simplified. (default = `0.75`)
- `buffer` *(number, optional)*: the amount of buffer around each tile in pixels. (default = `16`)
- `dumpGeometry` *(boolean, optional)*: whether or not to use ST_Dump to break apart geometry collections. (default = `false`)

### Example
```js
var tilestrataPostGISGeoJSON = require('tilestrata-postgis-geojson-tiles');
var querystring = require('querystring');

var layer = server.layer('geojson-tiles', {minZoom: 5, maxZoom: 14});

// .../geojson-tiles/tile.json?id=12345
layer
  .route('tile.json')
    .use(headers({
      'Access-Control-Allow-Origin': '*'
    }))
    .use(tilestrataPostGISGeoJSON({
      geometryField: 'geom',
      sql: function(server, req) {
        var qs = querystring.parse(req.qs);
        var id = qs && qs.id ? parseInt(qs.id, 10) : null;

        return 'SELECT id, name, {geojson} FROM tablename WHERE ST_Intersects(geom, {bbox}) AND id = ' + id;
      },
      pgConfig: {
        username: 'postgres',
        password: 'password',
        host: 'localhost',
        port: '5432',
        database: 'postgres'
      }
    }));
 ```
