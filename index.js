const PLATFORM_NAME = 'ICloudSMTP';
const PLUGIN_NAME = 'homebridge-icloud-smtp';

const { ICloudSMTPPlatform } = require('./platform');

module.exports = (api) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, ICloudSMTPPlatform);
};
