'use strict';

const Composer = require('../lib/composer.js');

module.exports = function(RemoveHighQuantitySecurities) {
  Composer.restrictModelMethods(RemoveHighQuantitySecurities);
};
