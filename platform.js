const nodemailer = require('nodemailer');
const { MailSwitchAccessory } = require('./switchAccessory');

const PLATFORM_NAME = 'ICloudSMTP';
const PLUGIN_NAME = 'homebridge-icloud-smtp';

class ICloudSMTPPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config || {};
    this.api = api;
    this.accessories = [];

    // DEBUG FLAG (from config)
    this.debug = this.config.debug === true;

    // Debug logger helper
    this.dlog = (msg, ...args) => {
      if (this.debug) {
        this.log.info(`[DEBUG] ${msg}`, ...args);
      }
    };

    this.queue = {
      promise: Promise.resolve(),
      add: function (task) {
        this.promise = this.promise
          .then(() => task())
          .catch(err => {
            console.error('Queue error:', err);
          });
        return this.promise;
      }
    };

    try {
      this.validateConfig();
    } catch (err) {
      this.log.error(err.message);
      throw err;
    }

    // -------------------------------
    // SHARED SMTP TRANSPORTER (NEW)
    // -------------------------------
    this.smtpReady = false;
    this.smtpAuthFailed = false;

    this.transporter = nodemailer.createTransport({
      host: 'smtp.mail.me.com',
      port: 587,
      secure: false,
      auth: {
        user: this.config.username,
        pass: this.config.password
      }
    });

    // Single verify for ALL switches
    this.transporter.verify((error) => {
      if (error) {
        this.smtpReady = false;

        if (error.code === 'EAUTH') {
          this.smtpAuthFailed = true;

          this.log.error(
            '[homebridge-icloud-smtp] SMTP authentication failed. ' +
            'Check Apple app-specific password.'
          );
        } else {
          this.log.error(
            `[homebridge-icloud-smtp] SMTP verify failed: ${error.message}`
          );
        }
      } else {
        this.smtpReady = true;

        this.log.info(
          '[homebridge-icloud-smtp] SMTP server connection established'
        );
      }
    });

    this.log.info('ICloudSMTP initialized');
    this.dlog('Platform constructor complete');

    api.on('didFinishLaunching', () => this.init());
  }

  validateConfig() {
    this.dlog('Validating config...');

    if (!this.config.username || !this.config.password) {
      throw new Error('Missing iCloud credentials');
    }

    if (!Array.isArray(this.config.switches) || this.config.switches.length === 0) {
      throw new Error('No switches defined');
    }

    this.dlog(`Config valid. Switch count: ${this.config.switches.length}`);
  }

  configureAccessory(accessory) {
    this.dlog(`Restoring accessory from cache: ${accessory.displayName}`);
    this.accessories.push(accessory);
  }

  init() {
    this.dlog('init() called');

    const validUUIDs = new Set();

    for (const sw of this.config.switches || []) {
      const uuid = this.api.hap.uuid.generate(`${sw.name}-${sw.to}`);
      validUUIDs.add(uuid);

      let accessory = this.accessories.find(a => a.UUID === uuid);

      if (!accessory) {
        accessory = new this.api.platformAccessory(sw.name, uuid);

        this.api.registerPlatformAccessories(
          PLUGIN_NAME,
          PLATFORM_NAME,
          [accessory]
        );

        this.log.info(`Adding new accessory: ${sw.name}`);
        this.dlog(`Created new accessory UUID: ${uuid}`);
      } else {
        this.log.info(`Restoring existing accessory: ${sw.name}`);
        this.dlog(`Matched cached UUID: ${uuid}`);
      }

      accessory.context.config = sw;

      new MailSwitchAccessory(
        this.log,
        this.api,
        accessory,
        sw,
        this.config,
        this.queue,
        this.transporter,        // NEW
        () => this.smtpAuthFailed // NEW guard accessor
      );
    }

    // Remove stale accessories
    for (const accessory of this.accessories) {
      if (!validUUIDs.has(accessory.UUID)) {
        this.log.info(`Removing stale accessory: ${accessory.displayName}`);
        this.dlog(`Unregistering UUID: ${accessory.UUID}`);

        this.api.unregisterPlatformAccessories(
          PLUGIN_NAME,
          PLATFORM_NAME,
          [accessory]
        );
      }
    }

    this.dlog('init() complete');
  }
}

module.exports = { ICloudSMTPPlatform };
