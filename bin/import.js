#!/usr/bin/env node

console.log("Postcodes.io ONS Postcode Directory Import Script");

var fs = require("fs");
var path = require("path");
var async = require("async");
var start = process.hrtime();
var prompt = require("prompt");
var sourceFile = process.argv[2];
var env = process.env.NODE_ENV || "development";
var Base = require(path.join(__dirname, "../app/models"));
var config = require(path.join(__dirname, "../config/config"))(env);
var Postcode = require(path.join(__dirname, "../app/models/postcode.js"));
var TerminatedPostcode = require(path.join(__dirname, "../app/models/terminated_postcode.js"))
var District = require(path.join(__dirname, "../app/models/district.js"));
var Ward = require(path.join(__dirname, "../app/models/ward.js"));
var Nuts = require(path.join(__dirname, "../app/models/nuts.js"));
var County = require(path.join(__dirname, "../app/models/county.js"));
var Parish = require(path.join(__dirname, "../app/models/parish.js"));
var Ccg = require(path.join(__dirname, "../app/models/ccg.js"));
var Outcode = require(path.join(__dirname, "../app/models/outcode.js"));

var pg = Base.connect(config);
// Performing checks

if (!sourceFile) {
	throw new Error("Aborting Import. No source file specified");
}

function dropRelation (callback) {
	console.log("Nuking old postcode database...");
	Postcode._destroyRelation(callback);
}

function createRelation (callback) {
	console.log("Creaing new postcode database...");
	Postcode._createRelation(callback);
}

function recreateIndexes(callback) {
	console.log("Rebuilding indexes...");
	Postcode.createIndexes(callback);
}

function importRawCsv (callback) {
	console.log("Seeding CSV data from", sourceFile);
	Postcode.seedPostcodes(sourceFile, callback);
}

function populateLocation (callback) {
	console.log("Populating location data...");
	Postcode.populateLocation(callback);
}

function setupSupportTables (callback) {
	console.log("Setting up support tables...");
	var instructions = [
		District._setupTable.bind(District),
		County._setupTable.bind(County),
		Ccg._setupTable.bind(Ccg),
		Ward._setupTable.bind(Ward),
		Nuts._setupTable.bind(Nuts),
		Parish._setupTable.bind(Parish)
	];
	async.series(instructions, callback);
}

function setupOutcodeTable(callback) {
	console.log("Building outcodes table...");
	Outcode._setupTable(callback);
}

function createPostgisExtension(callback) {
	console.log("Enabling POSTGIS extension...")
	Postcode._query("CREATE EXTENSION IF NOT EXISTS postgis", callback);
}

function setupTerminatedPostcodes (callback) {
	console.log("Building terminated postcodes table");
	TerminatedPostcode._setupTable(sourceFile, callback);
}

var executionStack = [createPostgisExtension,
											dropRelation, 
											setupSupportTables,
											createRelation, 
											importRawCsv,
											populateLocation, 
											recreateIndexes,
											setupOutcodeTable,
										  setupTerminatedPostcodes];

function startImport () {
	async.series(executionStack, function (error, result) {
		if (error) {
			console.log("Unable to complete import process due to error", error);
			console.log("Dropping newly created relation")
			dropRelation(function (error, result) {
				if (error) {
					console.log("Unabled to drop relation");
					process.exit(1);		
				}		
			});
		}
		console.log("Finished import process in", process.hrtime(start)[0], "seconds");
		process.exit(0);
	});
}

prompt.start();

prompt.get([{
	description: "Importing data will wipe your current postcode database before continuing. If you already have existing data please consider using updateons. Type YES to continue",
  name: 'userIsSure', 
  warning: 'Username must be only letters, spaces, or dashes'
}], function (error, result) {
	if (error) {
		console.log(error);
		process.exit(1);
	}
	if (result.userIsSure === "YES") {
		startImport();
	} else {
		console.log("You have opted to cancel the import process");
		process.exit(0);
	}
});