var pg = require('pg');
var SphericalMercator = require('@mapbox/sphericalmercator');
var sm = new SphericalMercator({ size: 256 });

module.exports = function(options) {
	var pgPool;
	var geomField = options.geometryField || 'geom';
	var simplifyFactor = typeof options.simplifyFactor === 'number' ? options.simplifyFactor : 0.75;
	var buffer = typeof options.buffer === 'number' ? options.buffer : 16;

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

		// expand bbox by buffer
		var w = bbox[2] - bbox[0];
		var h = bbox[3] - bbox[1];
		var bufferX = buffer * w / 256;
		var bufferY = buffer * h / 256;
		bbox[0] -= bufferX;
		bbox[1] -= bufferY;
		bbox[2] += bufferX;
		bbox[3] += bufferY;

		var simplifyTolerance = simplifyFactor / (1 << tile.z);
		var geojsonSQL = 'ST_MakeValid(ST_SimplifyPreserveTopology(' + geomField + ', ' + simplifyTolerance + '))';
		if (options.collectGeometry) geojsonSQL = 'ST_Collect(' + geojsonSQL + ')';
		if (options.mergeMultiLineStrings) geojsonSQL = 'ST_LineMerge(' + geojsonSQL + ')';

		geojsonSQL = 'ST_Intersection(' + geojsonSQL + ', {bbox})';
		if (options.dumpGeometry) geojsonSQL = '(ST_Dump(' + geojsonSQL + ')).geom';
		geojsonSQL = 'ST_AsGeoJSON(' + geojsonSQL + ') AS geojson';

		var bboxSQL = 'ST_SetSRID(\'BOX(' + bbox[0] + ' ' + bbox[1] + ',' + bbox[2] + ' ' + bbox[3] + ' )\'::box2d, 4326)';
		var sql = options.sql(server, tile);

		if (!sql) {
			err = new Error('Tile not found');
			err.statusCode = 404;
			return callback(err);
		}

		sql = sql
			.replace(/{geojson}/g, geojsonSQL)
			.replace(/{bbox}/g, bboxSQL);

		pgPool.query(sql).then(() => {
			var outputText = '{"type": "FeatureCollection", "features": [' +
				result.rows.map(function(row) {
					if (row.geojson) {
						var featureString = '{"type": "Feature", "geometry": ' + row.geojson;
						delete row.geojson;
						return featureString + ', "properties": ' + JSON.stringify(row) + '}';
					}
				}).join(',') +
			']}';
			callback(null, outputText, {'Content-Type': 'application/json'});
		}, (err) => {
			console.log(sql, err.message, err.stack)
			var err = new Error('An error occurred');
			err.statusCode = 500;
			return callback(err);
		});
	}

	return {
		name: 'postgis-geojson-tiles',
		init: initialize,
		serve: serve
	};
};
