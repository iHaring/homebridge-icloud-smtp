const { version } = require('./package.json');

class MailSwitchAccessory {
  constructor(
    log,
    api,
    accessory,
    swConfig,
    platformConfig,
    queue,
    transporter,
    authFailedCheck
  ) {
    this.log = log;
    this.api = api;
    this.accessory = accessory;
    this.swConfig = swConfig;
    this.platformConfig = platformConfig;
    this.queue = queue;

    this.transporter = transporter;
    this.isAuthFailed = authFailedCheck;

    this.lastSent = 0;

    this.service =
      accessory.getService(api.hap.Service.Switch) ||
      accessory.addService(api.hap.Service.Switch, swConfig.name);

    accessory.getService(api.hap.Service.AccessoryInformation)
      .setCharacteristic(api.hap.Characteristic.Manufacturer, 'homebridge-icloud-smtp')
      .setCharacteristic(api.hap.Characteristic.Model, swConfig.name)
      .setCharacteristic(api.hap.Characteristic.SerialNumber, accessory.UUID)
      .setCharacteristic(api.hap.Characteristic.FirmwareRevision, version);

    this.service
      .getCharacteristic(api.hap.Characteristic.On)
      .onSet(this.setState.bind(this))
      .onGet(() => false);
  }

  logPrefix() {
    return `[${this.swConfig.name}]`;
  }

  async setState(value) {
    if (!value) return;

    const now = Date.now();
    const cooldownMs = (this.swConfig.cooldown || 30) * 1000;

    if (now - this.lastSent < cooldownMs) {
      this.log.warn(this.logPrefix() + ' cooldown active');
      return this.reset();
    }

    this.lastSent = now;

    try {
      await this.queue.add(() => this.sendMail());
    } catch (e) {
      this.log.error(this.logPrefix() + ` queue error: ${e.message}`);
    }

    this.reset();
  }

  async sendMail() {

    if (this.isAuthFailed && this.isAuthFailed()) {
      this.log.error(
        this.logPrefix() +
        ' SMTP disabled due to authentication failure'
      );
      return;
    }

    try {

      // ✅ Fallback TO = username if missing
      const recipient = this.swConfig.to || this.platformConfig.username;

      const info = await this.transporter.sendMail({
        from: this.platformConfig.username,
        to: recipient,
        subject: this.swConfig.subject,
        text: this.swConfig.body
      });

      // ✅ Clean single log line
      this.log.info(
        `${this.logPrefix()} email sent → ${recipient}`
      );

      if (this.platformConfig.debug) {
        this.log.info(
          this.logPrefix() +
          ` SMTP response: ${info.response}`
        );
      }

    } catch (e) {

      const msg = e?.message || String(e);
      const code = e?.code || 'UNKNOWN';

      this.log.error(
        this.logPrefix() +
        ` SMTP error [${code}]: ${msg}`
      );

      if (code === 'EAUTH') {
        this.log.error(
          this.logPrefix() +
          ' Authentication failed (use Apple app-specific password)'
        );
      }
    }
  }

  reset() {
    setTimeout(() => {
      this.service.updateCharacteristic(
        this.api.hap.Characteristic.On,
        false
      );
    }, 500);
  }
}

module.exports = { MailSwitchAccessory };
