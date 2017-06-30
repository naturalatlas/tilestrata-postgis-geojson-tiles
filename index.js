var pg = require('pg');
var SphericalMercator = require('sphericalmercator');
var merc = new SphericalMercator({
    size: 256
});

module.exports = function(options) {

	var pgPool;
	var geomField = options.geometryField || 'geom';
	var simplifyFactor = options.simplifyFactor || 0.75;

	/**
	 * Initializes the layer config and the PostgreSQL datasource.
	 *
	 * @param {TileServer} server
	 * @param {function} callback(err, fn)
	 * @return {void}
	 */
	function initialize(server, callback) {
		pgPool = new pg.Pool(options.pgConfig);
		pgPool.on('error', function (err, client) {
		  console.error(err.message, err.stack);
		});

		callback();
	}

	/**
	 * Creates a tile and returns the result as a GeoJSON Tile,
	 * plus the headers that should accompany it.
	 *
	 * @param {TileServer} server
	 * @param {TileRequest} tile
	 * @param {function} callback(err, buffer, headers)
	 * @return {void}
	 */
	function serve(server, tile, callback) {
		var bbox = sm.bbox(tile.x, tile.y, tile.z);
		var simplifyTolerance = simplifyFactor / (1 << z);
		var geojsonSQL = 'ST_AsGeoJSON(ST_Simplify(' + geomField + ', ' + simplifyTolerance + ')) AS geojson';
		var bboxSQL = '\'BOX2D(' + bbox[0] + ' ' + bbox[1] + ',' + bbox[2] + ' ' + bbox[3] + ' )\'';
		var sql = options.sql(server, tile);

		var geom = 'SELECT {geojson} FROM tablename  '
		var sql = 'SELECT ST_AsGeoJSON(ST_Simplify(geom, k)), fields FROM tablename WHERE '
		if (!sql) {
			err = new Error('Tile not found');
			err.statusCode = 404;
			return callback(err);
		}

		sql = sql
			.replace(/{geojson}/g, geojsonSQL)
			.replace(/{bbox}/g, bboxSQL);

		pgPool.query(sql, function(err, result) {
			if (err) {
				console.log(query, err.message, err.stack)
				var err = new Error('An error occurred');
				err.statusCode = 500;
				return callback(err);
			}

			var outputText = '{"type": "FeatureCollection", "features": [' +
					result.rows.map(function(row) {
					if (row.geojson) {
						var featureString = '{"type": "Feature", "geometry": ' + row.geometry;
						delete row.geojson;
						return featureString + ', "properties": "' + JSON.stringify(row) + '"}';
					}
				}).join(',') +
			']}';

			callback(null, outputText, {'Content-Type': 'application/json'});
		});
	}

	return {
		name: 'postgis-geojson-tiles',
    init: initialize,
		serve: serve
	};
};
