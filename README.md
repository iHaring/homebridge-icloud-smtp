# homebridge-icloud-smtp

Homebridge dynamic platform plugin that creates virtual switches. Turning a switch on sends an email through iCloud SMTP.

## Features

- Create one or more HomeKit switches in Homebridge.
- Send an email when a switch is turned on.
- Per-switch cooldown to prevent repeated sends.
- Per-switch retry logic for temporary SMTP failures.
- Optional debug logging.

## Requirements

- Homebridge `^1.8.0 || ^2.0.0`
- Node.js `^22.10.0 || ^24.0.0`
- An iCloud account
- An Apple app-specific password (required for SMTP)

## Install

Install from npm:

```bash
sudo npm install -g homebridge-icloud-smtp
```

Or install from the Homebridge UI:

1. Open Homebridge UI.
2. Go to **Plugins**.
3. Search for `homebridge-icloud-smtp`.
4. Install the plugin.

## Configuration

Add the platform to your Homebridge config.

```json
{
  "platform": "ICloudSMTP",
  "name": "iCloud SMTP",
  "username": "you@icloud.com",
  "password": "your-app-specific-password",
  "debug": false,
  "switches": [
    {
      "name": "Door Alert",
      "to": "notify@example.com",
      "subject": "Door Opened",
      "body": "The front door was opened.",
      "cooldown": 30,
      "retries": 2
    }
  ]
}
```

### Option Reference

Platform options:

- `platform` (string, required): must be `ICloudSMTP`.
- `name` (string, recommended): display name in Homebridge.
- `username` (string, required): your iCloud email address.
- `password` (string, required): Apple app-specific password.
- `debug` (boolean, optional, default `false`): enable debug logs.
- `switches` (array, required): list of virtual mail switches.

Switch options:

- `name` (string, required): switch name shown in HomeKit.
- `to` (string, required): recipient email address.
- `subject` (string, required): email subject.
- `body` (string, required): plain-text email body.
- `cooldown` (number, optional, default `30`): minimum seconds between sends.
- `retries` (number, optional, default `2`): retry count after the first failed send.

## Apple App-Specific Password

Apple requires app-specific passwords for third-party SMTP access.

Steps:

1. Sign in at [account.apple.com](https://account.apple.com/).
2. Open **Sign-In and Security**.
3. Select **App-Specific Passwords**.
4. Generate a new app-specific password.
5. Use that value as the plugin `password`.

Reference: [Apple Support - Use app-specific passwords](https://support.apple.com/en-us/102654)

## How It Works

- The plugin registers a dynamic platform (`ICloudSMTP`).
- Each configured switch appears as a HomeKit switch accessory.
- Turning a switch on sends one email and then resets the switch to off.
- Emails are sent through `smtp.mail.me.com:587` using STARTTLS (`secure: false`).

## Troubleshooting

- **"Missing iCloud credentials"**
  - Ensure `username` and `password` are set in config.
- **"No switches defined"**
  - Add at least one entry in `switches`.
- **Authentication failures**
  - Verify you are using an app-specific password, not your Apple account password.
  - Regenerate the app-specific password and update config.
- **Switch turns on but no mail arrives**
  - Check Homebridge logs for retry/failure messages.
  - Verify recipient address and spam/junk folders.

## Security Notes

- Treat your app-specific password as a secret.
- Do not commit credentials to Git.
- Prefer Homebridge UI secret fields or environment-based secret handling where available.

## Support

- Create an issue: https://github.com/iHaring/homebridge-icloud-smtp/issues
- Include your Homebridge version, Node.js version, and relevant log output.

## License

MIT
