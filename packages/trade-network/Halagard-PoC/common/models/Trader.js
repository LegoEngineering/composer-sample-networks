'use strict';

const Composer = require('../lib/composer.js');

module.exports = function(Trader) {
  Composer.restrictModelMethods(Trader);
};
