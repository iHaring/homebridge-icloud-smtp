const pluginPackage = require('./package.json');
const nodemailerVersion = require('nodemailer/package.json').version;
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

  async verify() {
    try {
      await this.transporter.verify();
      this.log.info('SMTP connection verified ✓');
      return true;
    } catch (err) {
      this.handleError(err, 'SMTP verify:');
      return false;
    }
  }

  async send({ to, subject, text, debugPrefix = '' }) {
    if (this.authFailed) {
      const err = new Error('SMTP disabled due to authentication failure');
      this.log.error(`${debugPrefix} ${err.message}`);
      throw err;
    }

    try {
      const result = await this.transporter.sendMail({
        from: this.username,
        to,
        subject,
        text
      });
      return result;
    } catch (err) {
      this.handleError(err, debugPrefix);
      throw err;
    }
  }

  handleError(err, prefix = '') {
    switch (err.code) {
      // --- Authentication errors ---
      case 'EAUTH':
        this.authFailed = true;
        this.log.error(
          `${prefix} Authentication failed. Check your iCloud credentials and ensure ` +
          `you are using an app-specific password. SMTP sending is now disabled.`
        );
        break;

      case 'ENOAUTH':
        this.authFailed = true;
        this.log.error(
          `${prefix} No authentication credentials provided. ` +
          `Please configure username and password in your config.json.`
        );
        break;

      case 'EOAUTH2':
        this.authFailed = true;
        this.log.error(`${prefix} OAuth2 token error: ${err.message}`);
        break;

      // --- Connection errors ---
      case 'ECONNECTION':
        this.log.error(
          `${prefix} Connection to SMTP server failed. ` +
          `Check your network connection and firewall settings. Details: ${err.message}`
        );
        break;

      case 'ETIMEDOUT':
        this.log.error(
          `${prefix} Connection timed out. The SMTP server may be unreachable ` +
          `or a firewall is blocking port 587. Details: ${err.message}`
        );
        break;

      case 'ESOCKET':
        this.log.error(
          `${prefix} Socket error. A low-level network issue occurred. Details: ${err.message}`
        );
        break;

      case 'EDNS':
        this.log.error(
          `${prefix} DNS resolution failed. The SMTP hostname could not be resolved. ` +
          `Check your DNS settings. Details: ${err.message}`
        );
        break;

      // --- TLS/Security errors ---
      case 'ETLS':
        this.log.error(
          `${prefix} TLS handshake failed. This could be a certificate issue ` +
          `or STARTTLS upgrade failure. Details: ${err.message}`
        );
        break;

      case 'EREQUIRETLS':
        this.log.error(
          `${prefix} REQUIRETLS is not supported by the server (RFC 8689). Details: ${err.message}`
        );
        break;

      // --- Envelope/Message errors ---
      case 'EENVELOPE':
        this.log.error(
          `${prefix} Invalid mail envelope. Check sender/recipient addresses. ` +
          `Details: ${err.message}`
        );
        break;

      case 'EMESSAGE':
        this.log.error(
          `${prefix} Message delivery error. The server rejected the message content. ` +
          `Details: ${err.message}`
        );
        break;

      case 'ESTREAM':
        this.log.error(
          `${prefix} Stream processing error while sending the message. Details: ${err.message}`
        );
        break;

      // --- Protocol errors ---
      case 'EPROTOCOL':
        this.log.error(
          `${prefix} Invalid SMTP server response. The server sent an unexpected reply. ` +
          `Details: ${err.message}`
        );
        break;

      // --- Resource/Config errors ---
      case 'EMAXLIMIT':
        this.log.warn(
          `${prefix} Connection pool limit reached. Will retry on next attempt. Details: ${err.message}`
        );
        break;

      case 'ECONFIG':
        this.log.error(
          `${prefix} Invalid nodemailer configuration. Details: ${err.message}`
        );
        break;

      // --- Fallback ---
      default:
        if (err.responseCode >= 500 && err.responseCode < 600) {
          this.log.error(
            `${prefix} SMTP server error (${err.responseCode}): ${err.message}`
          );
          if (err.responseCode === 535) {
            this.authFailed = true;
            this.log.error(`${prefix} SMTP sending is now disabled.`);
          }
        } else if (err.responseCode >= 400 && err.responseCode < 500) {
          this.log.warn(
            `${prefix} SMTP temporary failure (${err.responseCode}): ${err.message}. ` +
            `Will retry on next attempt.`
          );
        } else {
          this.log.error(`${prefix} Unexpected error: ${err.message}`);
        }
        break;
    }
  }
}

class ICloudSMTPPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config || {};
    this.api = api;
    this.accessories = [];
    this.validConfig = true;

    this.log.info(`${pluginPackage.name} v${pluginPackage.version} starting...`);
    this.log.info(`Dependency: nodemailer v${nodemailerVersion}`);

    try {
      this.validateConfig();
    } catch (err) {
      this.log.error(`Configuration error: ${err.message}`);
      this.validConfig = false;
    }

    if (this.validConfig) {
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
    }

    this.log.info('Platform initialized');

    api.on('didFinishLaunching', async () => {
      if (!this.validConfig) {
        return;
      }

      await this.emailService.verify();
      this.init();
    });
  }

  validateConfig() {
    if (!this.config.username || !this.config.password) {
      throw new Error('Missing iCloud credentials (username and/or password)');
    }

    if (!Array.isArray(this.config.switches) || this.config.switches.length === 0) {
      throw new Error('Switches must be a non-empty array');
    }

    for (const sw of this.config.switches) {
      if (!sw.id) {
        sw.id = this.generateFallbackId(sw);
        this.log.warn(
          `Switch "${sw.name}" has no "id" field. ` +
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

    return id.length >= 5 ? id : id.padEnd(5, '0');
  }

  configureAccessory(accessory) {
    this.accessories.push(accessory);
  }

  init() {
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
