'use strict';

const Joi = require('joi');

const RESYNC_DELAY = 15 * 60;

// allowed configuration keys
const settingsSchema = {
    webhooks: Joi.string()
        .uri({
            scheme: ['http', 'https'],
            allowRelative: false
        })
        .allow('')
        .example('https://myservice.com/imap/webhooks')
        .description('Webhook URL'),

    webhookEvents: Joi.array().items(Joi.string().max(256).example('messageNew')),

    notifyHeaders: Joi.array().items(Joi.string().max(256).example('List-ID')),

    authServer: Joi.string()
        .uri({
            scheme: ['http', 'https'],
            allowRelative: false
        })
        .allow('')
        .example('https://myservice.com/authentication')
        .description('URL to fetch authentication data from')
        .label('AuthServer'),

    notifyText: Joi.boolean().truthy('Y', 'true', '1').falsy('N', 'false', 0).description('Include message text in webhook notification'),

    notifyTextSize: Joi.number().min(0),

    gmailClientId: Joi.string().allow('').max(256).description('Gmail OAuth2 Client ID'),
    gmailClientSecret: Joi.string().empty('').max(256).description('Gmail OAuth2 Client Secret'),
    gmailRedirectUrl: Joi.string()
        .allow('')
        .uri({ scheme: ['http', 'https'], allowRelative: false })
        .description('Gmail OAuth2 Callback URL'),

    logs: Joi.object({
        all: Joi.boolean().truthy('Y', 'true', '1').falsy('N', 'false', 0).default(false).description('Enable logs for all accounts'),
        resetLoggedAccounts: Joi.boolean().truthy('Y', 'true', '1').falsy('N', 'false', 0).default(false).description('Reconnect logged accounts'),
        accounts: Joi.array()
            .items(Joi.string().max(256))
            .default([])
            .example(['account-id-1', 'account-id-2'])
            .description('Enable logs for listed accounts')
            .label('LoggedAccounts'),
        maxLogLines: Joi.number().min(0).max(1000000).default(10000)
    }).label('LogSettings')
};

const addressSchema = Joi.object({
    name: Joi.string().max(256).example('Some Name'),
    address: Joi.string()
        .email({
            ignoreLength: false
        })
        .example('user@example.com')
        .required()
}).label('Address');

// generate a list of boolean values
const settingsQuerySchema = Object.fromEntries(
    Object.keys(Object.assign({ eventTypes: true }, settingsSchema)).map(key => [
        key,
        Joi.boolean().truthy('Y', 'true', '1').falsy('N', 'false', 0).default(false)
    ])
);

const imapSchema = {
    auth: Joi.object({
        user: Joi.string().max(256).required().example('myuser@gmail.com').description('Account username'),
        pass: Joi.string().max(256).example('verysecret').description('Account password'),
        accessToken: Joi.string().max(4096).description('Access Token for OAuth2')
    })
        .xor('pass', 'accessToken')
        .description('Authentication info')
        .label('Authentication'),

    useAuthServer: Joi.boolean().example(false).description('Set to true to use authentication server instead of username/password'),

    host: Joi.string().hostname().required().example('imap.gmail.com').description('Hostname to connect to'),
    port: Joi.number()
        .min(1)
        .max(64 * 1024)
        .required()
        .example(993)
        .description('Service port number'),
    secure: Joi.boolean().default(false).example(true).description('Should connection use TLS. Usually true for port 993'),
    tls: Joi.object({
        rejectUnauthorized: Joi.boolean().default(true).example(true).description('How to treat invalid certificates'),
        minVersion: Joi.string().max(256).example('TLSv1.2').description('Minimal TLS version')
    })
        .description('Optional TLS configuration')
        .label('TLS'),
    resyncDelay: Joi.number().example(RESYNC_DELAY).description('Full resync delay in seconds').default(RESYNC_DELAY)
};

const smtpSchema = {
    auth: Joi.object({
        user: Joi.string().max(256).required().example('myuser@gmail.com').description('Account username'),
        pass: Joi.string().max(256).example('verysecret').description('Account password'),
        accessToken: Joi.string().max(4096).description('Access Token for OAuth2')
    })
        .xor('pass', 'accessToken')
        .description('Authentication info')
        .label('Authentication'),

    useAuthServer: Joi.boolean().example(false).description('Set to true to use authentication server instead of username/password'),

    host: Joi.string().hostname().required().example('smtp.gmail.com').description('Hostname to connect to'),
    port: Joi.number()
        .min(1)
        .max(64 * 1024)
        .required()
        .example(587)
        .description('Service port number'),
    secure: Joi.boolean().default(false).example(false).description('Should connection use TLS. Usually true for port 465'),
    tls: Joi.object({
        rejectUnauthorized: Joi.boolean().default(true).example(true).description('How to treat invalid certificates'),
        minVersion: Joi.string().max(256).example('TLSv1.2').description('Minimal TLS version')
    })
        .description('Optional TLS configuration')
        .label('TLS')
};

const oauth2Schema = Joi.object({
    authorize: Joi.boolean().example(true).description('Return a redirect link to the OAuth2 consent screen'),
    provider: Joi.string().default('gmail').valid('gmail').description('OAuth provider'),
    auth: Joi.object({
        user: Joi.string().max(256).required().example('myuser@gmail.com').description('Account username')
    }),
    accessToken: Joi.string().max(1024).example('ya29.a0ARrdaM8a...'),
    refreshToken: Joi.string().max(1024).example('1//09Ie3CtORQYm...'),
    expires: Joi.date().iso().example('2021-03-22T13:13:31.000Z').description('Token expiration date')
})
    .xor('authorize', 'auth')
    .label('OAuth2Auth');

const attachmentSchema = Joi.object({
    id: Joi.string().example('AAAAAgAACrIyLjI').description('Attachment ID').label('AttachmentId'),
    contentType: Joi.string().example('image/gif').description('Mime type of the attachment'),
    encodedSize: Joi.number().example(48).description('Encoded size of the attachment. Actual file size is usually smaller depending on the encoding'),
    embedded: Joi.boolean().example(true).description('Is this image used in HTML img tag'),
    inline: Joi.boolean().example(true).description('Should this file be included in the message preview somehow'),
    contentId: Joi.string().example('<unique-image-id@localhost>').description('Usually used only for embedded images')
});

const messageEntrySchema = Joi.object({
    id: Joi.string().example('AAAAAgAACrI').description('Message ID').label('MessageEntryId'),
    uid: Joi.number().example(12345).description('UID of the message').label('MessageUid'),
    emailId: Joi.string().example('1694937972638499881').description('Globally unique ID (if server supports it)').label('MessageEmailId'),
    threadId: Joi.string().example('1694936993596975454').description('Thread ID (if server supports it)').label('MessageThreadId'),
    date: Joi.date().iso().example('2021-03-22T13:13:31.000Z').description('Date (internal)'),
    draft: Joi.boolean().example(false).description('Is this message marked as a draft'),
    unseen: Joi.boolean().example(true).description('Is this message unseen'),
    flagged: Joi.boolean().example(true).description('Is this message marked as flagged'),
    size: Joi.number().example(1040).description('Message size in bytes'),
    subject: Joi.string().example('What a wonderful message').description('Message subject (decoded into unicode, applies to other string values as well)'),

    from: addressSchema.example({ name: 'From Me', address: 'sender@example.com' }),

    to: Joi.array()
        .items(addressSchema)
        .description('List of addresses')
        .example([{ address: 'recipient@example.com' }])
        .label('AddressList'),

    cc: Joi.array().items(addressSchema).description('List of addresses').label('AddressList'),

    bcc: Joi.array().items(addressSchema).description('List of addresses').label('AddressList'),
    messageId: Joi.string().example('<test123@example.com>').description('Message ID'),
    inReplyTo: Joi.string().example('<7JBUMt0WOn+_==MOkaCOQ@mail.gmail.com>').description('Replied Message ID'),

    labels: Joi.array().items(Joi.string().example('\\Important')).description('Gmail labels').label('LabelList'),

    attachments: Joi.array().items(attachmentSchema).description('List of attachments').label('AttachmentList'),

    text: Joi.object({
        id: Joi.string().example('AAAAAgAACqiTkaExkaEykA').description('Pointer to message text content'),
        encodedSize: Joi.object({
            plain: Joi.number().example(1013).description('How many bytes for plain text'),
            html: Joi.number().example(1013).description('How many bytes for html content')
        }).description('Encoded message part sizes')
    }).label('TextInfo')
}).label('MessageListEntry');

const messageDetailsSchema = Joi.object({
    id: Joi.string().example('AAAAAgAACrI').description('Message ID').label('MessageEntryId'),
    uid: Joi.number().example(12345).description('UID of the message').label('MessageUid'),
    emailId: Joi.string().example('1694937972638499881').description('Globally unique ID (if server supports it)').label('MessageEmailId'),
    threadId: Joi.string().example('1694936993596975454').description('Thread ID (if server supports it)').label('MessageThreadId'),
    date: Joi.date().iso().example('2021-03-22T13:13:31.000Z').description('Date (internal)'),
    draft: Joi.boolean().example(false).description('Is this message marked as a draft'),
    unseen: Joi.boolean().example(true).description('Is this message unseen'),
    flagged: Joi.boolean().example(true).description('Is this message marked as flagged'),
    size: Joi.number().example(1040).description('Message size in bytes'),
    subject: Joi.string().example('What a wonderful message').description('Message subject (decoded into unicode, applies to other string values as well)'),

    from: addressSchema.example({ name: 'From Me', address: 'sender@example.com' }),
    sender: addressSchema.example({ name: 'From Me', address: 'sender@example.com' }),

    to: Joi.array()
        .items(addressSchema)
        .description('List of addresses')
        .example([{ address: 'recipient@example.com' }])
        .label('AddressList'),

    cc: Joi.array().items(addressSchema).description('List of addresses').label('AddressList'),

    bcc: Joi.array().items(addressSchema).description('List of addresses').label('AddressList'),
    messageId: Joi.string().example('<test123@example.com>').description('Message ID'),
    inReplyTo: Joi.string().example('<7JBUMt0WOn+_==MOkaCOQ@mail.gmail.com>').description('Replied Message ID'),

    flags: Joi.array().items(Joi.string().example('\\Seen')).description('IMAP flags').label('FlagList'),
    labels: Joi.array().items(Joi.string().example('\\Important')).description('Gmail labels').label('LabelList'),

    attachments: Joi.array().items(attachmentSchema).description('List of attachments').label('AttachmentList'),

    headers: Joi.object()
        .example({ from: ['From Me <sender@example.com>'], subject: ['What a wonderful message'] })
        .description('Object where header key is object key and value is an array'),

    text: Joi.object({
        id: Joi.string().example('AAAAAgAACqiTkaExkaEykA').description('Pointer to message text content'),
        encodedSize: Joi.object({
            plain: Joi.number().example(1013).description('How many bytes for plain text'),
            html: Joi.number().example(1013).description('How many bytes for html content')
        }).description('Encoded message part sizes'),
        plain: Joi.string().example('Hello from myself!').description('Plaintext content of the message'),
        html: Joi.string().example('<p>Hello from myself!</p>').description('HTML content of the message'),
        hasMore: Joi.boolean()
            .example(false)
            .description('If partial message content was requested then this value indicates if it includes all the content or there is more')
    }).label('TextInfo'),

    bounces: Joi.array()
        .items(
            Joi.object({
                message: Joi.string().max(256).required().example('AAAAAQAACnA').description('Bounce email ID'),
                recipient: Joi.string().email().example('recipient@example.com'),
                action: Joi.string().example('failed'),
                response: Joi.object({
                    message: Joi.string().example('550 5.1.1 No such user'),
                    status: Joi.string().example('5.1.1')
                }).label('BounceResponse'),
                date: Joi.date().iso().example('2021-03-22T13:13:31.000Z').description('Time the bounce was registered by EmailEngine')
            }).label('BounceEntry')
        )
        .label('BounceList')
}).label('MessageListEntry');

const messageListSchema = Joi.object({
    total: Joi.number().example(120).description('How many matching entries').label('TotalNumber'),
    page: Joi.number().example(0).description('Current page (0-based index)').label('PageNumber'),
    pages: Joi.number().example(24).description('Total page count').label('PagesNumber'),
    messages: Joi.array().items(messageEntrySchema).label('PageMessages')
}).label('MessageList');

const mailboxesSchema = Joi.array().items(
    Joi.object({
        path: Joi.string().required().example('Kalender/S&APw-nnip&AOQ-evad').description('Full path to mailbox').label('MailboxPath'),
        delimiter: Joi.string().example('/'),
        parentPath: Joi.string().required().example('Kalender').description('Full path to parent mailbox').label('MailboxParentPath'),
        name: Joi.string().required().example('Sünnipäevad').description('Maibox name').label('MailboxName'),
        listed: Joi.boolean().example(true).description('Was the mailbox found from the output of LIST command').label('MailboxListed'),
        subscribed: Joi.boolean().example(true).description('Was the mailbox found from the output of LSUB command').label('MailboxSubscribed'),
        specialUse: Joi.string()
            .example('\\Sent')
            .valid('\\All', '\\Archive', '\\Drafts', '\\Flagged', '\\Junk', '\\Sent', '\\Trash', '\\Inbox')
            .description('Special use flag of the mailbox if set')
            .label('MailboxSpecialUse'),
        messages: Joi.number().example(120).description('Count of messages in mailbox').label('MailboxMessages'),
        uidNext: Joi.number().example(121).description('Next expected UID').label('MailboxMUidNext')
    }).label('MailboxResponseItem')
);

const shortMailboxesSchema = Joi.array().items(
    Joi.object({
        path: Joi.string().required().example('Kalender/S&APw-nnip&AOQ-evad').description('Full path to mailbox').label('MailboxPath'),
        delimiter: Joi.string().example('/'),
        parentPath: Joi.string().required().example('Kalender').description('Full path to parent mailbox').label('MailboxParentPath'),
        name: Joi.string().required().example('Sünnipäevad').description('Maibox name').label('MailboxName'),
        listed: Joi.boolean().example(true).description('Was the mailbox found from the output of LIST command').label('MailboxListed'),
        subscribed: Joi.boolean().example(true).description('Was the mailbox found from the output of LSUB command').label('MailboxSubscribed'),
        specialUse: Joi.string()
            .example('\\Sent')
            .valid('\\All', '\\Archive', '\\Drafts', '\\Flagged', '\\Junk', '\\Sent', '\\Trash', '\\Inbox')
            .description('Special use flag of the mailbox if set')
            .label('MailboxSpecialUse')
    }).label('MailboxResponseItem')
);

module.exports = {
    settingsSchema,
    addressSchema,
    settingsQuerySchema,
    imapSchema,
    smtpSchema,
    oauth2Schema,
    attachmentSchema,
    messageEntrySchema,
    messageDetailsSchema,
    messageListSchema,
    mailboxesSchema,
    shortMailboxesSchema
};
