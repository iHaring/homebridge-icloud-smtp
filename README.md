# homebridge-icloud-smtp

<a href="https://www.npmjs.com/package/homebridge-icloud-smtp">![npm](https://img.shields.io/npm/v/homebridge-icloud-smtp)</a>
![downloads](https://img.shields.io/npm/dm/homebridge-icloud-smtp)
<!--
![homebridge](https://img.shields.io/badge/homebridge-verified-green)
-->
Homebridge dynamic platform plugin that creates virtual HomeKit switches which send emails through iCloud SMTP when triggered.

## Features

- Create one or more HomeKit switches in Homebridge
- Send emails through your iCloud account
- Optional recipient override per switch
- Multiple recipients supported (comma-separated)
- Automatic fallback to sender address if no recipient is configured
- Per-switch cooldown protection
- Clean and lightweight architecture
- Optional debug logging

## Requirements

- Homebridge `^1.8.0 || ^2.0.0`
- Node.js `^22.10.0 || ^24.0.0`
- iCloud account
- Apple app-specific password

## Installation

Install from npm:

```bash
sudo npm install -g homebridge-icloud-smtp
```

Or install through the Homebridge UI:

1. Open Homebridge UI
2. Go to **Plugins**
3. Search for `homebridge-icloud-smtp`
4. Install the plugin

## Configuration

Example configuration:

```json
{
  "platform": "ICloudSMTP",
  "name": "iCloud SMTP",
  "username": "you@icloud.com",
  "password": "your-app-specific-password",
  "switches": [
    {
      "name": "Door Alert",
      "to": "notify@example.com,second@example.com",
      "subject": "Door Opened",
      "body": "The front door was opened.",
      "cooldown": 30
    },
    {
      "name": "Self Notification",
      "subject": "Test Email",
      "body": "This email is sent to the sender address automatically."
    }
  ]
}
```

## Option Reference

### Platform Options

| Option | Type | Required | Description |
|---|---|---|---|
| `platform` | string | Yes | Must be `ICloudSMTP` |
| `name` | string | No | Display name in Homebridge |
| `username` | string | Yes | iCloud email address used as sender |
| `password` | string | Yes | Apple app-specific password |
| `switches` | array | Yes | List of virtual email switches |

### Switch Options

| Option | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Switch name shown in HomeKit |
| `to` | string | No | Recipient email address(es). Multiple recipients supported via comma-separated values |
| `subject` | string | Yes | Email subject |
| `body` | string | No | Plain-text email body |
| `cooldown` | number | No | Minimum seconds between sends (default: `30`) |

## Recipient Behavior

- If `to` is omitted, the email is automatically sent to the configured `username`
- Multiple recipients are supported using comma-separated email addresses

Example:

```json
"to": "person1@example.com,person2@example.com"
```

## Apple App-Specific Password

Apple requires app-specific passwords for SMTP access from third-party applications.

Steps:

1. Sign in at https://account.apple.com
2. Open **Sign-In and Security**
3. Select **App-Specific Passwords**
4. Generate a new app-specific password
5. Use the generated password in the plugin configuration

Apple Support reference:

https://support.apple.com/en-us/102654

## How It Works

- The plugin registers a dynamic Homebridge platform (`ICloudSMTP`)
- Each configured switch appears as a HomeKit switch
- Turning a switch on sends an email
- The switch automatically resets to off after triggering
- Emails are sent using Nodemailer with the built-in iCloud SMTP service configuration

## Troubleshooting

### Authentication failed

- Ensure you are using an Apple app-specific password
- Do not use your Apple account password
- Regenerate the app-specific password if needed

### No email received

- Check Homebridge logs for SMTP errors
- Verify recipient addresses
- Check spam/junk folders
- Ensure cooldown timing is not blocking repeated sends

### Plugin does not start

- Verify `username` and `password` are configured
- Ensure at least one switch exists in `switches`

## Security Notes

- Treat your app-specific password as sensitive
- Do not commit credentials to Git repositories
- Prefer Homebridge UI secret fields when available

## Support

- GitHub Issues:
  https://github.com/iHaring/homebridge-icloud-smtp/issues

When opening issues, include:
- Homebridge version
- Node.js version
- Plugin version
- Relevant log output

## License

MIT
