const { version } = require('./package.json');

class MailSwitchAccessory {
  constructor(log, api, accessory, swConfig, platformConfig, emailService) {
    this.log = log;
    this.api = api;
    this.accessory = accessory;
    this.swConfig = swConfig;
    this.platformConfig = platformConfig;
    this.emailService = emailService;

    this.lastSent = 0;

    this.service =
      accessory.getService(api.hap.Service.Switch) ||
      accessory.addService(api.hap.Service.Switch, swConfig.name);

    accessory.getService(api.hap.Service.AccessoryInformation)
      .setCharacteristic(api.hap.Characteristic.Manufacturer, 'Homebridge')
      .setCharacteristic(api.hap.Characteristic.Model, 'homebridge-icloud-smtp')
      .setCharacteristic(api.hap.Characteristic.SerialNumber, swConfig.id)
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
      await this.sendMail();
    } catch (e) {
      this.log.error(this.logPrefix() + ` send error: ${e.message}`);
    }

    this.reset();
  }

  async sendMail() {
    const recipient = this.swConfig.to || this.platformConfig.username;

    const info = await this.emailService.send({
      to: recipient,
      subject: this.swConfig.subject,
      text: this.swConfig.body,
      debugPrefix: this.logPrefix()
    });

    this.log.info(`${this.logPrefix()} email sent → ${recipient}`);

    if (info?.response) {
      this.log.debug(`${this.logPrefix()} SMTP response: ${info.response}`);
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
