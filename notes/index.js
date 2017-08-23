'use strict';

var SaxAsync = require('sax-async');
var fs = require('fs');
var pg = require('pg');
var db = require('./db');

module.exports = processFile;

/**
    Processes an XML file with <note> entries and dumps them
    into a postgres database.

    @param {Object} options Options object
    @param {string} options.filename Path to XML file
    @param {string} options.pgURL Postgres URL, like 'postgres://postgres@localhost/osm-comments'
    @param {processDoneCallback} callback called after file is done processing

    @callback processDoneCallback

    @returns {undefined}

*/
function processFile(options, callback) {
    options = options || {};
    var filename = options.filename || 'data/planet-notes-latest.osn';
    console.log(filename);
    var pgURL = options.pgURL || process.env.OSM_COMMENTS_POSTGRES_URL || 'postgres://postgres@localhost/osm-comments';
    console.log(pgURL);
    pg.connect(pgURL, function(err, client, done) {
        if (err) {
            return console.error('could not connect to postgres', err);
        }
        if (err)
            console.log('error connect postgres', err);
        console.log(client);
        parseNotes(filename, client, function() {
            done();
            callback();
        });
    });
}

function parseNotes(xmlFilename, client, callback) {
    xmlFilename = xmlFilename || '/Users/sanjaybhangar/tmp/cdata/planet-notes-latest.osn';
    console.log(xmlFilename);
    var saxStream = new SaxAsync();
    var currentNote, currentComment;
    saxStream.hookSync('opentag', function(node) {
        var tagName = node.name.toLowerCase();
        console.log('tag name', tagName);
        if (tagName === 'note') {
            currentNote = node;
            currentNote.comments = [];
        } else if (tagName === 'comment') {
            currentNote.comments.push(node);
            currentComment = node;
        }
    });
    saxStream.hookAsync('closetag', function(next, tagName) {
        tagName = tagName.toLowerCase();
        if (tagName === 'note') {
            console.log('saving note');
            db.saveNote(client, currentNote, function () {
                currentNote = null;
                next();
            });
        } else if (tagName === 'comment') {
            currentComment = null;
            next();
        } else {
            next();
        }
    });
    saxStream.hookSync('text', function(text) {
        if (currentComment && text) {
            currentComment.text = text;
        }
    });
    saxStream.hookSync('end', function() {
        callback();
    });

    saxStream.hookSync('error', function (err) {
        console.log('sax stream error', JSON.stringify(err));
    });

    fs.createReadStream(xmlFilename)
        .pipe(saxStream);

}
