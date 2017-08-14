"use strict";

const util = require("util");
const path = require("path");
const async = require("async");
const OSPoint = require("ospoint");
const assert = require("chai").assert;
const randomString = require("random-string");
const rootPath = path.join(__dirname, "../../");
const env = process.env.NODE_ENV || "development";
const NO_RELOAD_DB = !!process.env.NO_RELOAD_DB;
const Base = require(path.join(rootPath, "app/models"));
const config = require(path.join(rootPath + "/config/config"))(env);
const seedPostcodePath = path.join(rootPath, "tests/seed/postcode.csv");
const seedPlacesPath = path.join(rootPath, "tests/seed/places/")

// Load models
const AttributeBase = require(path.join(rootPath, "app/models/attribute_base"));
const Postcode = require(path.join(rootPath, "app/models/postcode"));
const District = require(path.join(rootPath, "app/models/district"));
const Parish = require(path.join(rootPath, "app/models/parish"));
const County = require(path.join(rootPath, "app/models/county"));
const Ccg = require(path.join(rootPath, "app/models/ccg"));
const Constituency = require(path.join(rootPath, "app/models/constituency"));
const Nuts = require(path.join(rootPath, "app/models/nuts"));
const Ward = require(path.join(rootPath, "app/models/ward"));
const Outcode = require(path.join(rootPath, "app/models/outcode"));
const Place = require(path.join(rootPath, "app/models/place"));

const CSV_INDEX = {
	postcode: 2,
	northings: 10,
	eastings: 9
};

// Location with nearby postcodes to be used in lonlat test requests


const locationWithNearbyPostcodes = function (callback) {
	const postcodeWithNearbyPostcodes = "AB14 0LP";
	Postcode.find(postcodeWithNearbyPostcodes, function (error, result) {
		if (error) return callback(error, null);
		return callback(null, result);
	});
}

function getCustomRelation () {
	const relationName = randomString({
			  length: 8,
			  numeric: false,
			  letters: true,
			  special: false
			}),
			schema = {
				"id" : "serial PRIMARY KEY",
				"somefield": "varchar(255)"
			};

	function CustomRelation() {
		Base.Base.call(this, relationName, schema);
	}

	util.inherits(CustomRelation, Base.Base);

	return new CustomRelation();
}

function seedPostcodeDb (callback) {
	if (NO_RELOAD_DB) {
		return callback(null);
	}

	const instructions = [];
	instructions.push(function (callback) {
		Postcode._setupTable(seedPostcodePath, callback);
	});
	instructions.push(District._setupTable.bind(District));
	instructions.push(Parish._setupTable.bind(Parish));
	instructions.push(Nuts._setupTable.bind(Nuts));
	instructions.push(County._setupTable.bind(County));
	instructions.push(Constituency._setupTable.bind(Constituency));
	instructions.push(Ccg._setupTable.bind(Ccg));
	instructions.push(Ward._setupTable.bind(Ward));
	instructions.push(Outcode._setupTable.bind(Outcode));
	instructions.push(function (callback) {
		Place._setupTable(seedPlacesPath, callback);
	});

	async.series(instructions, callback);
}

function clearPostcodeDb(callback, force) {
	if (NO_RELOAD_DB) {
		return callback(null);
	}
	Postcode._destroyRelation(callback);
}

const getRandom = function (max) {
	return Math.floor(Math.random() * max);
}

function randomPostcode(callback) {
	Postcode.random(function (error, result) {
		callback(error, result.postcode);
	});
}

function randomOutcode(callback) {
	return Postcode.random(function (error, result) {
		callback(error, result.outcode)
	});
}

function randomLocation(callback) {
	return Postcode.random(function (error, result) {
		callback(error, {
			longitude: result.longitude,
			latitude: result.latitude
		})
	});
}

function lookupRandomPostcode(callback) {
	Postcode.random(function (error, result) {
		if (error) {
			throw error;
		}
		callback(result);
	});
}

function jsonpResponseBody (response) {
	// Rough regex to extract json object
	const result = response.text.match(/\(.*\)/);
	return JSON.parse(result[0].slice(1, result[0].length - 1));
}

function allowsCORS (response) {
	assert.equal(response.headers["access-control-allow-origin"], "*");
}

function validCorsOptions(response) {
	assert.equal(response.headers["access-control-allow-origin"],
		"*");
	assert.equal(response.headers["access-control-allow-methods"],
		"GET,POST,OPTIONS");
	assert.equal(response.headers["access-control-allow-headers"],
		"X-Requested-With, Content-Type, Accept, Origin");
}

function isRawPlaceObject(o) {
	[
		"id",
	  "code",
	  "longitude",
	  "latitude",
	  "location",
	  "eastings",
	  "northings",
	  "min_eastings",
	  "min_northings",
	  "max_eastings",
	  "max_northings",
	  "bounding_polygon",
	  "local_type",
	  "outcode",
	  "name_1",
	  "name_1_lang",
	  "name_1_search",
	  "name_2",
	  "name_2_lang",
  	"name_2_search",
	  "county_unitary",
	  "county_unitary_type",
	  "district_borough",
	  "district_borough_type",
	  "region",
	  "country",
	  "polygon"
	].forEach(prop => assert.property(o, prop));
}

function isPlaceObject(o) {
	[
	  "code",
	  "longitude",
	  "latitude",
	  "eastings",
	  "northings",
	  "min_eastings",
	  "min_northings",
	  "max_eastings",
	  "max_northings",
	  "local_type",
	  "outcode",
	  "name_1",
	  "name_1_lang",
	  "name_2",
	  "name_2_lang",
	  "county_unitary",
	  "county_unitary_type",
	  "district_borough",
	  "district_borough_type",
	  "region",
	  "country"
	].forEach(prop => assert.property(o, prop));

  [
	  "id",
  	"location",
  	"name_1_search",
  	"name_2_search",
    "bounding_polygon",
    "polygon"
  ].forEach(prop => assert.notProperty(o, prop));
}

const rawPostcodeAttributes = Object.keys(Postcode.schema);
const postcodeAttributes = Postcode.whitelistedAttributes;


//baseObject is the main template of an object
//additionalArr is an array of extra attributes on the postcode object
//blackListedAttr is an array of attributes that Postcode object not supposed to have
function isSomeObject(o, baseObjectAttr, additionalAttr = [], blackListedAttr = []) {
	const whiteBaseObjAttr = baseObjectAttr.reduce((acc,curr) => {
		if (!blackListedAttr.includes(curr)) {acc.push(curr)}
		return acc;
	}, []);
	whiteBaseObjAttr.forEach(attr => assert.property(o, attr));
	if (additionalAttr) {
		additionalAttr.forEach(attr => assert.property(o, attr));
	}
	const expectedObjLen = whiteBaseObjAttr.length + additionalAttr.length;
	assert.equal(Object.keys(o).length, expectedObjLen);
}

function isPostcodeObject(o, additionalAttr = [], blackListedAttr = []) {
	isSomeObject(o, postcodeAttributes, additionalAttr, blackListedAttr);
}

function isPostcodeWithDistanceObject(o) {
	isPostcodeObject(o, ["distance"]);
}
//raw Object is the one that only has properties specified in the schema
function isRawPostcodeObject(o, additionalAttr = [], blackListedAttr = []) {
	isSomeObject(o, rawPostcodeAttributes, additionalAttr, blackListedAttr);
}

function isRawPostcodeObjectWithFC(o, additionalAttr = [], blackListedAttr = []) {
	isRawPostcodeObject(o, Postcode.getForeignColNames().concat(additionalAttr), blackListedAttr);
}

function isRawPostcodeObjectWithFCandDistance(o) {
	isRawPostcodeObjectWithFC(o, ["distance"])
}

function isOutcodeObject(o) {
	["id", "location"].forEach(prop => assert.notProperty(o, prop));

	[
		"eastings",
		"latitude",
		"northings",
		"longitude",
		"admin_ward",
		"admin_county",
		"admin_district",
		"parish",
		"outcode",
		"country"
	].forEach(prop => assert.property(o, prop));
}

function isRawOutcodeObject(o) {
	[
		"id",
		"eastings",
		"latitude",
		"location",
		"northings",
		"longitude",
		"admin_ward",
		"admin_county",
		"admin_district",
		"parish",
		"outcode",
		"country"
	].forEach(prop => assert.property(o, prop))
}

function testOutcode(o) {
	[
		"longitude",
		"latitude",
		"northings",
		"eastings",
		"admin_ward",
		"admin_district",
		"admin_county",
		"parish",
		"country"
	].forEach(prop => assert.property(o, prop));
}

module.exports = {
	// Data
	config: config,
	rootPath: rootPath,

	// Methods
	allowsCORS: allowsCORS,
	testOutcode: testOutcode,
	randomOutcode: randomOutcode,
	isPlaceObject: isPlaceObject,
	randomPostcode: randomPostcode,
	randomLocation: randomLocation,
	seedPostcodeDb: seedPostcodeDb,
	clearPostcodeDb: clearPostcodeDb,
	isOutcodeObject: isOutcodeObject,
	validCorsOptions: validCorsOptions,
	isPostcodeObject: isPostcodeObject,
	isRawPlaceObject: isRawPlaceObject,
	isPostcodeWithDistanceObject: isPostcodeWithDistanceObject,
	jsonpResponseBody: jsonpResponseBody,
	getCustomRelation: getCustomRelation,
	isRawOutcodeObject: isRawOutcodeObject,
	isRawPostcodeObject: isRawPostcodeObject,
	isRawPostcodeObjectWithFC: isRawPostcodeObjectWithFC,
	isRawPostcodeObjectWithFCandDistance: isRawPostcodeObjectWithFCandDistance,
	lookupRandomPostcode: lookupRandomPostcode,
	locationWithNearbyPostcodes: locationWithNearbyPostcodes,

	// Models
	Base: Base,
	AttributeBase: AttributeBase,
	Postcode: Postcode,
	District: District,
	Parish: Parish,
	County: County,
	Ccg: Ccg,
	Constituency: Constituency,
	Nuts: Nuts,
	Ward: Ward,
	Outcode: Outcode,
	Place: Place,
	seedPaths: {
		postcodes: path.join(rootPath, "/tests/seed/postcodes.csv"),
		customRelation: path.join(rootPath, "/tests/seed/customRelation.csv")
	}
};
