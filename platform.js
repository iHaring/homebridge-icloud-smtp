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

    for (const sw of this.config.switches) {
      if (!sw.id) {
        sw.id = this.generateFallbackId(sw);
        this.log.warn(
          `[ICloudSMTP] Switch "${sw.name}" has no "id" field. ` +
          `Auto-generated: "${sw.id}". Please add an explicit "id" to your config ` +
          `to avoid accessory resets if you rename this switch.`
        );
      }
    }

    const ids = this.config.switches.map(sw => sw.id);
    const uniqueIds = new Set(ids);

    if (ids.length !== uniqueIds.size) {
      throw new Error('Duplicate switch IDs detected. Each switch must have a unique id.');
    }
  }

  generateFallbackId(sw) {
    const raw = `${sw.name}-${sw.to || this.config.username}`;
    const id = raw
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 64);

    // Ensure minimum 5 characters, pad if necessary
    return id.length >= 5 ? id : id.padEnd(5, '0');
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
        `${PLUGIN_NAME}:${sw.id}`
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

        this.log.info(`Adding new accessory: ${sw.name} (id: ${sw.id})`);
      } else {
        if (accessory.displayName !== sw.name) {
          this.log.info(`Renaming accessory: ${accessory.displayName} → ${sw.name}`);
          accessory.displayName = sw.name;
        }

        this.log.info(`Restoring existing accessory: ${sw.name} (id: ${sw.id})`);
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
