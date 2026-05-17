const nodemailer = require('nodemailer');
const { MailSwitchAccessory } = require('./switchAccessory');

const PLATFORM_NAME = 'ICloudSMTP';
const PLUGIN_NAME = 'homebridge-icloud-smtp';

class EmailService {
  constructor(log, transporter, username) {
    this.log = log;
    this.transporter = transporter;
    this.username = username;
    this.authFailed = false;
  }

  async send({ to, subject, text, debugPrefix = '' }) {
    if (this.authFailed) {
      this.log.error(`${debugPrefix} SMTP disabled due to authentication failure`);
      return;
    }

    return await this.transporter.sendMail({
      from: this.username,
      to,
      subject,
      text
    });
  }
}

class ICloudSMTPPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config || {};
    this.api = api;
    this.accessories = [];

    this.debug = this.config.debug === true;
    this.validConfig = true;

    try {
      this.validateConfig();
    } catch (err) {
      this.log.error(`[ICloudSMTP] Configuration error: ${err.message}`);
      this.validConfig = false;
    }

    const transporter = nodemailer.createTransport({
      service: 'icloud',
      auth: {
        user: this.config.username,
        pass: this.config.password
      }
    });

    this.emailService = new EmailService(
      this.log,
      transporter,
      this.config.username
    );

    this.log.info('ICloudSMTP initialized');

    api.on('didFinishLaunching', () => this.init());
  }

  validateConfig() {
    if (!this.config.username || !this.config.password) {
      throw new Error('Missing iCloud credentials');
    }

    if (!Array.isArray(this.config.switches)) {
      throw new Error('Switches must be an array');
    }
  }

  configureAccessory(accessory) {
    this.accessories.push(accessory);
  }

  init() {
    if (!this.validConfig) {
      this.log.error('[ICloudSMTP] Plugin disabled due to invalid configuration');
      return;
    }

    const validUUIDs = new Set();

    for (const sw of this.config.switches || []) {
      const uuid = this.api.hap.uuid.generate(
        `${sw.name}-${sw.to || this.config.username}`
      );

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
      } else {
        this.log.info(`Restoring existing accessory: ${sw.name}`);
      }

      accessory.context.config = sw;

      new MailSwitchAccessory(
        this.log,
        this.api,
        accessory,
        sw,
        this.config,
        this.emailService
      );
    }

    for (const accessory of this.accessories) {
      if (!validUUIDs.has(accessory.UUID)) {
        this.log.info(`Removing stale accessory: ${accessory.displayName}`);

        this.api.unregisterPlatformAccessories(
          PLUGIN_NAME,
          PLATFORM_NAME,
          [accessory]
        );
      }
    }
  }
}

module.exports = { ICloudSMTPPlatform };
