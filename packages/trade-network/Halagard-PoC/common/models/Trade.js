'use strict';

const Composer = require('../lib/composer.js');

module.exports = function(Trade) {
  Composer.restrictModelMethods(Trade);
};
