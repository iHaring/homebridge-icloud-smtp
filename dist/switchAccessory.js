
const nodemailer = require('nodemailer');

class MailSwitchAccessory {
  constructor(log, api, accessory, swConfig, platformConfig, queue) {
    this.log = log;
    this.api = api;
    this.accessory = accessory;
    this.swConfig = swConfig;
    this.platformConfig = platformConfig;
    this.queue = queue;
    this.lastSent = 0;

    this.service =
      accessory.getService(api.hap.Service.Switch) ||
      accessory.addService(api.hap.Service.Switch, swConfig.name);

    accessory.getService(api.hap.Service.AccessoryInformation)
      .setCharacteristic(api.hap.Characteristic.Manufacturer, 'Custom')
      .setCharacteristic(api.hap.Characteristic.Model, 'iCloud SMTP Switch')
      .setCharacteristic(api.hap.Characteristic.SerialNumber, swConfig.name);

    this.service
      .getCharacteristic(api.hap.Characteristic.On)
      .onSet(this.setState.bind(this))
      .onGet(() => false);

    this.transporter = nodemailer.createTransport({
      service: "iCloud",
      auth: {
        user: platformConfig.username,
        pass: platformConfig.password
      }
    });
  }

  logPrefix() {
    return `[${this.swConfig.name}]`;
  }

  async setState(value) {
    if (!value) return;

    const now = Date.now();
    const cooldownMs = (this.swConfig.cooldown || 30) * 1000;

    this.log.info(this.logPrefix() + ' triggered');

    if (now - this.lastSent < cooldownMs) {
      this.log.warn(this.logPrefix() + ' cooldown active');
      return this.reset();
    }

    this.lastSent = now;

    await this.queue.add(() => this.sendWithRetry());

    this.reset();
  }

  async sendWithRetry() {
    const retries = this.swConfig.retries || 2;

    for (let i = 1; i <= retries + 1; i++) {
      try {
        this.log.info(this.logPrefix() + ' sending attempt ' + i);

        await this.transporter.sendMail({
          from: this.platformConfig.username,
          to: this.swConfig.to,
          subject: this.swConfig.subject,
          text: this.swConfig.body
        });

        this.log.info(this.logPrefix() + ' email sent');
        return;
      } catch (e) {
        this.log.warn(this.logPrefix() + ' attempt ' + i + ' failed');
        if (i > retries) {
          this.log.error(this.logPrefix() + ' all retries failed');
        }
      }
    }
  }

  reset() {
    setTimeout(() => {
      this.service.updateCharacteristic(this.api.hap.Characteristic.On, false);
    }, 500);
  }
}

module.exports = { MailSwitchAccessory };
