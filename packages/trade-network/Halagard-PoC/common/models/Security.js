'use strict';

const Composer = require('../lib/composer.js');

module.exports = function(Security) {
  Composer.restrictModelMethods(Security);
};
